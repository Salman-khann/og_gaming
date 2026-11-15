import { cleanupScorecardsAfterResponse } from '@/lib/storage-cleanup';
import { checkCaptainAccount } from '@/lib/account-applications';
import { verifiedUser } from '@/lib/auth-session';
import { verifyCaptcha } from '@/lib/captcha';
import { connection } from 'next/server';
import { readArena } from '@/lib/data-service';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiError,
  ApiError,
  requireProfile,
  sameOrigin,
  integer,
  money,
  textField,
  jsonObject,
  uuidField,
  dbError,
} from '@/lib/api';
import { applicationInput } from '@/lib/team-applications';
import { createClient } from '@/lib/supabase/server';
import { rememberApplication } from '@/lib/application-cookie';
import { newDeletionCredential } from '@/lib/match-ownership';
import { dispatchAfterResponse } from '@/lib/notifications';
import { rateLimit, rateLimitSubject } from '@/lib/rate-limit';
import { rejectBotField } from '@/lib/api-input';
const statuses = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
function tournamentFields(body: Record<string, unknown>) {
  const min = integer(body.min_level, 1, 10),
    max = integer(body.max_level, min, 10);
  const start = new Date(String(body.start_date)).getTime(),
    deadline = new Date(String(body.registration_deadline)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(deadline) || deadline > start)
    throw new ApiError('Registration deadline must be on or before the start date.');
  if (!statuses.includes(String(body.status))) throw new ApiError('Invalid tournament status.');
  const title = textField(body.title, 'title', 120);
  const slug = textField(body.slug, 'slug', 140);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new ApiError('Slug must contain lowercase letters, numbers, and hyphens.');
  const entryFee = money(body.entry_fee === undefined ? 0 : body.entry_fee);
  const earlyBirdFee = body.early_bird_fee == null ? null : money(body.early_bird_fee);
  const earlyBirdDeadline =
    body.early_bird_deadline == null ? null : new Date(String(body.early_bird_deadline)).getTime();
  if ((earlyBirdFee === null) !== (earlyBirdDeadline === null))
    throw new ApiError('Set both the early-bird fee and deadline, or disable early-bird pricing.');
  if (
    earlyBirdFee !== null &&
    (earlyBirdFee >= entryFee ||
      earlyBirdDeadline === null ||
      !Number.isFinite(earlyBirdDeadline) ||
      earlyBirdDeadline > deadline)
  )
    throw new ApiError(
      'Early-bird pricing must be lower than the entry fee and end on or before registration closes.',
    );
  const bracketType = body.bracket_type || 'single';
  if (!['single', 'double'].includes(String(bracketType)))
    throw new ApiError('Invalid bracket type.');
  return {
    title,
    slug,
    bracket_type: bracketType,
    entry_fee: entryFee,
    early_bird_fee: earlyBirdFee,
    early_bird_deadline:
      earlyBirdDeadline === null ? null : new Date(earlyBirdDeadline).toISOString(),
    payment_instructions: String(body.payment_instructions || '').slice(0, 2000),
    description: String(body.description || '').slice(0, 4000),
    game: textField(body.game, 'game', 80),
    format: textField(body.format, 'format', 100),
    min_level: min,
    max_level: max,
    max_teams: integer(body.max_teams, 2, 128),
    start_date: new Date(start).toISOString(),
    registration_deadline: new Date(deadline).toISOString(),
    status: body.status,
    prize_pool: String(body.prize_pool || '').slice(0, 200),
    rules: String(body.rules || '').slice(0, 8000),
  };
}
export async function GET(request: Request) {
  await connection();
  try {
    const params = new URL(request.url).searchParams,
      admin = params.get('admin') === '1';
    const adminActorId = admin ? (await requireProfile(true)).profile.id : undefined;
    return Response.json(
      await readArena(
        'tournaments',
        integer(params.get('page') || 1, 1, 10000),
        integer(params.get('registration_page') || 1, 1, 10000),
        admin,
        adminActorId,
      ),
      {
        headers: {
          'Cache-Control':
            !admin && !request.headers.has('cookie') && !request.headers.has('authorization')
              ? 'public, s-maxage=15, stale-while-revalidate=60'
              : 'no-store',
          Vary: 'Cookie, Authorization',
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await jsonObject(request);
    if (body.action === 'checkin') throw new ApiError('Tournament check-in has been removed.', 410);
    if (body.action === 'create') {
      const { db } = await requireProfile(true);
      const { data: tournament, error } = await db
        .from('tournaments')
        .insert(tournamentFields(body))
        .select()
        .single();
      if (error)
        throw error.code === '23505'
          ? new ApiError('Another tournament already uses that slug.', 409)
          : dbError(error);
      return Response.json({ success: true, tournament }, { status: 201 });
    }
    rejectBotField(body);
    const { event, application } = applicationInput(body);
    const id = uuidField(event, 'tournament'),
      session = await createClient();
    const user = await verifiedUser(session);
    if (user) await requireProfile(false, { db: session, user });
    checkCaptainAccount(user, application.email);
    await rateLimit(request, 'registration', 5, 300, user?.id);
    await rateLimitSubject('registration-phone', application.phone, 5, 3600);
    await rateLimitSubject('registration-email', application.email.toLowerCase(), 5, 3600);
    await verifyCaptcha(request, body.captcha_token, 'registration');
    const credential = newDeletionCredential();
    const { data: registration, error } = await createAdminClient().rpc('submit_team_application', {
      actor_id: user?.id || null,
      event_id: id,
      application,
      credential_hash: credential.hash,
    });
    if (error)
      throw error.code === '23505'
        ? new ApiError('This team or captain is already registered.', 409)
        : dbError(error);
    await rememberApplication(registration.id, credential.token);
    dispatchAfterResponse();
    return Response.json({ success: true, registration }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireProfile(true);
    const body = await jsonObject(request);
    if (body.action === 'verify_payment') {
      const { error } = await createAdminClient().rpc('set_registration_payment', {
        registration_id: uuidField(body.registration_id, 'registration'),
        next_payment: body.verified === false ? 'pending' : 'verified',
      });
      if (error) throw dbError(error);
    } else if (body.tournament_id) {
      const { error } = await db
        .from('tournaments')
        .update({ ...tournamentFields(body), updated_at: new Date().toISOString() })
        .eq('id', uuidField(body.tournament_id, 'tournament'))
        .select('id')
        .single();
      if (error)
        throw error.code === '23505'
          ? new ApiError('Another tournament already uses that slug.', 409)
          : dbError(error);
    } else {
      const id = uuidField(body.registration_id, 'registration');
      if (body.action !== undefined) throw new ApiError('Invalid registration action.');
      if (!['approved', 'rejected'].includes(String(body.status)))
        throw new ApiError('Invalid registration status.');
      const { error } = await db.rpc('review_arena_registration', {
        registration_id: id,
        next_status: body.status,
      });
      if (error)
        throw error.code === '23505'
          ? new ApiError('Another approved team already uses that name.', 409)
          : dbError(error);
    }
    dispatchAfterResponse();
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const { profile } = await requireProfile(true);
    const body = await jsonObject(request);
    const admin = createAdminClient();
    const { error } = await admin.rpc('admin_delete_tournament', {
      actor_id: profile.id,
      event_id: uuidField(body.tournament_id, 'tournament'),
      confirmation_title: textField(body.confirmation_title, 'confirmation title', 120),
    });
    if (error) throw dbError(error);
    cleanupScorecardsAfterResponse();
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
