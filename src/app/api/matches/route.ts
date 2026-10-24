import { verifyCaptcha } from '@/lib/captcha';
import { readArena } from '@/lib/data-service';
import {
  apiError,
  ApiError,
  requireProfile,
  sameOrigin,
  integer,
  textField,
  jsonObject,
  uuidField,
  dbError,
} from '@/lib/api';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone, futureMatchTime } from '@/lib/match-input';
import { cookies } from 'next/headers';
import { issueDeletionCookie, newDeletionCredential, ownsPost } from '@/lib/match-ownership';
import { connection } from 'next/server';
import { ownedRoster } from '@/lib/community';
import { rateLimit, rateLimitSubject } from '@/lib/rate-limit';
import { rejectBotField } from '@/lib/api-input';
import { dispatchAfterResponse } from '@/lib/notifications';
export async function GET(request: Request) {
  await connection();
  try {
    const result = await readArena(
      'matches',
      integer(new URL(request.url).searchParams.get('page') || 1, 1, 10000),
    );
    const jar = await cookies();
    const ids = (result.matches || []).filter((m) => jar.has('og_match_' + m.id)).map((m) => m.id);
    const hashes = ids.length
      ? await createAdminClient()
          .from('match_contacts')
          .select('match_id,delete_token_hash')
          .in('match_id', ids)
      : { data: [] };
    const matches = (result.matches || []).map((m) => ({
      ...m,
      can_delete: ownsPost(
        jar.get('og_match_' + m.id)?.value,
        hashes.data?.find((h) => h.match_id === m.id)?.delete_token_hash || null,
      ),
    }));
    return Response.json(
      { matches, has_more: result.has_more },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await jsonObject(request);
    if (body.action === 'join_team') {
      const { profile } = await requireProfile();
      await rateLimit(request, 'team-join', 10, 60, profile.id);
      const teamId = uuidField(body.team_id, 'team');
      await ownedRoster(profile.id, teamId);
      const { error } = await createAdminClient().rpc('join_arena_team', {
        actor_id: profile.id,
        match_id: uuidField(body.match_id, 'match'),
        squad_id: teamId,
      });
      if (error) throw dbError(error);
      return Response.json({ success: true });
    }
    if (body.action === 'join') {
      const { db, profile } = await requireProfile();
      await rateLimit(request, 'match-join', 20, 60, profile.id);
      const { error } = await db.rpc('join_arena_match', {
        match_id: uuidField(body.match_id, 'match'),
      });
      if (error) throw dbError(error);
      return Response.json({ success: true });
    }
    if (!['solo_lfg', 'team_vs_team', 'gather_5v5'].includes(String(body.type)))
      throw new ApiError('Invalid match type.');
    rejectBotField(body);
    let phone: string, scheduledTime: string;
    try {
      phone = normalizePhone(body.contact_phone);
      scheduledTime = futureMatchTime(body.scheduled_time);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'Invalid match details.');
    }
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    const profile = user ? (await requireProfile(false, { db: session, user })).profile : null;
    const db = createAdminClient();
    const min = integer(body.min_faceit_level, 1, 10),
      max = integer(body.max_faceit_level, min, 10);
    await rateLimit(request, 'match-post', 5, 3600, profile?.id);
    await rateLimitSubject('match-post-phone', phone, 5, 3600);
    await verifyCaptcha(request, body.captcha_token, 'match-post');
    const teamId = body.type === 'team_vs_team' ? uuidField(body.team_id, 'verified team') : null;
    if (teamId) {
      if (!profile) throw new ApiError('Sign in to post a team scrim.', 401);
      await ownedRoster(profile.id, teamId);
    }
    const credential = newDeletionCredential();
    const { data: match, error } = await db.rpc(teamId ? 'post_team_match' : 'post_arena_match', {
      ...(teamId ? { squad_id: teamId } : {}),
      host_phone: phone,
      payload: {
        delete_token_hash: credential.hash,
        creator_id: profile?.id || null,
        host_name:
          profile?.faceit_nickname ||
          (typeof body.host_name === 'string' ? body.host_name.trim().slice(0, 40) : null),
        title: textField(body.title, 'title', 100),
        type: body.type,
        description: typeof body.description === 'string' ? body.description.slice(0, 2000) : null,
        scheduled_time: scheduledTime,
        min_faceit_level: min,
        max_faceit_level: max,
        target_players_count: integer(body.target_players_count ?? 10, 2, 10),
      },
    });
    if (error)
      throw new ApiError(
        error.code === 'P0001'
          ? error.message
          : 'Unable to create match. Check the details and try again.',
      );
    await issueDeletionCookie(match.id, scheduledTime, credential.token);
    dispatchAfterResponse();
    return Response.json({ success: true, match }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const id = uuidField((await jsonObject(request)).match_id, 'match');
    const admin = createAdminClient();
    const { data: match } = await admin
      .from('match_requests')
      .select('id,creator_id')
      .eq('id', id)
      .single();
    if (!match) throw new ApiError('This post has already been removed.', 404);
    const jar = await cookies();
    const { data: contact } = await admin
      .from('match_contacts')
      .select('delete_token_hash')
      .eq('match_id', id)
      .maybeSingle();
    let allowed = ownsPost(jar.get('og_match_' + id)?.value, contact?.delete_token_hash || null);
    if (!allowed) {
      const session = await createClient();
      const {
        data: { user },
      } = await session.auth.getUser();
      if (user) {
        const { profile } = await requireProfile();
        allowed = profile.role === 'admin' || profile.id === match.creator_id;
      }
    }
    if (!allowed)
      throw new ApiError('Only the host or an administrator can delete this post.', 403);
    const { error } = await admin.rpc('delete_arena_post', { post_id: id });
    if (error) throw new ApiError('Unable to delete this post.', 503);
    jar.set('og_match_' + id, '', { path: '/api/matches', maxAge: 0 });
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
