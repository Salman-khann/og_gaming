import { connection } from 'next/server';
import {
  apiError,
  ApiError,
  requireProfile,
  sameOrigin,
  jsonObject,
  textField,
  uuidField,
  integer,
} from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';
import { communityAction } from '@/lib/community';
import { dispatchAfterResponse } from '@/lib/notifications';
import { youtubeEmbed } from '@/lib/community-media';
export async function GET(request: Request) {
  await connection();
  try {
    await requireProfile(true);
    const db = createAdminClient();
    const params = new URL(request.url).searchParams,
      section = params.get('section') || 'players';
    const page = integer(params.get('page') || 1, 1, 10000),
      from = (page - 1) * 25;
    if (section === 'tournament_options') {
      const { data, error, count } = await db
        .from('tournaments')
        .select('id,title', { count: 'exact' })
        .order('start_date', { ascending: false })
        .order('id')
        .range(from, from + 24);
      if (error) throw error;
      return Response.json(
        { items: data || [], total: count },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (section === 'analytics') {
      const days = integer(params.get('days') || 30, 7, 90);
      if (![7, 30, 90].includes(days)) throw new ApiError('Choose 7, 30 or 90 days.');
      const event = params.get('tournament');
      const { data, error } = await db.rpc('admin_dashboard_report', {
        period_days: days,
        event_id: event ? uuidField(event, 'tournament') : null,
      });
      if (error) throw error;
      return Response.json({ analytics: data }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (section === 'teams' && params.get('source') !== 'squads') {
      let query = db
        .from('registrations')
        .select(
          'id,team_name,status,checked_in,payment_status,created_at,roster_details,tournament:tournaments(title)',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + 24);
      const search = params.get('search')?.trim();
      if (search) query = query.ilike('team_name', '%' + search.replace(/[\\%_]/g, '') + '%');
      const { data, error, count } = await query;
      if (error) throw error;
      return Response.json(
        { items: data || [], page, total: count },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const tables: Record<string, string> = {
      players: 'profiles',
      notifications: 'notifications_log',
      content: 'site_content',
      teams: 'teams',
    };
    const table = tables[section];
    if (!table) throw new ApiError('Unknown admin section.');
    let query = db
      .from(table)
      .select(
        section === 'players'
          ? 'id,faceit_id,faceit_nickname,faceit_level,faceit_elo,role,created_at,last_active_at'
          : section === 'teams'
            ? 'id,name,created_at,members:team_members(nickname,status)'
            : section === 'notifications'
              ? 'id,channel,event_type,payload,status,error_message,created_at,attempts'
              : '*',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + 24);
    const search = params.get('search')?.trim();
    if (search && section === 'players')
      query = query.ilike('faceit_nickname', '%' + search.replace(/[\\%_]/g, '') + '%');
    if (search && section === 'teams')
      query = query.ilike('name', '%' + search.replace(/[\\%_]/g, '') + '%');
    if (section === 'notifications') {
      const status = params.get('status'),
        kind = params.get('kind');
      if (status && !['pending', 'sent', 'failed'].includes(status))
        throw new ApiError('Invalid delivery status.');
      if (kind && !['registrations', 'match_requests'].includes(kind))
        throw new ApiError('Invalid activity type.');
      if (status) query = query.eq('status', status);
      if (kind) query = query.like('event_type', kind + ':%');
    }
    const { data, error, count } = await query;
    if (error) throw error;
    return Response.json(
      {
        items: data || [],
        page,
        total: count,
        ...(section === 'notifications'
          ? {
              deliveryConfigured: !!(
                (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) ||
                (process.env.RESEND_API_KEY &&
                  process.env.ADMIN_EMAIL &&
                  process.env.NOTIFICATION_FROM_EMAIL)
              ),
            }
          : {}),
      },
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
    const { profile } = await requireProfile(true);
    const db = createAdminClient();
    if (body.action === 'set_role')
      await communityAction(profile.id, 'set_role', {
        user_id: uuidField(body.user_id, 'player'),
        role: textField(body.role, 'role', 10),
      });
    else if (body.action === 'save_content') {
      if (!['sponsor', 'gallery', 'stream'].includes(String(body.kind)))
        throw new ApiError('Invalid content type.');
      const url = safeUrl(body.url);
      const image = body.image_url ? safeUrl(body.image_url) : null;
      if (body.kind === 'gallery' && !image)
        throw new ApiError('Add an HTTPS image URL for the gallery.');
      if (body.kind === 'stream' && !youtubeEmbed(url))
        throw new ApiError('Use a valid YouTube video, share, Shorts, live or embed URL.');
      const values = {
        kind: body.kind,
        title: textField(body.title, 'title', 120),
        url,
        image_url: image,
        published: body.published === true,
      };
      const { error } = body.id
        ? await db.from('site_content').update(values).eq('id', uuidField(body.id, 'content'))
        : await db.from('site_content').insert(values);
      if (error) throw error;
    } else if (body.action === 'retry_notice') {
      const { error } = await db
        .from('notifications_log')
        .update({
          status: 'pending',
          attempts: 0,
          available_at: new Date().toISOString(),
          lease_until: null,
        })
        .eq('id', uuidField(body.id, 'notification'))
        .eq('status', 'failed');
      if (error) throw error;
      dispatchAfterResponse();
    } else if (body.action === 'unpublish_content') {
      const { error } = await db
        .from('site_content')
        .update({ published: false })
        .eq('id', uuidField(body.id, 'content'));
      if (error) throw error;
    } else throw new ApiError('Unknown administrator action.');
    return Response.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
function safeUrl(value: unknown) {
  const raw = textField(value, 'URL', 2048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError('Enter a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new ApiError('Enter a public HTTPS URL.');
  return url.toString();
}
