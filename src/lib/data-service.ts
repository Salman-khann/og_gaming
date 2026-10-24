import { createClient } from './supabase/server';
import { ApiError } from './api';
import type { MatchRequest, Tournament, Registration } from '@/types';
import { guestApplications } from './team-applications';
import { createAdminClient } from './supabase/admin';

function queryError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === 'PGRST205' || error.code === '42P01')
    throw new ApiError(
      'The competition database has not been set up yet. Please contact OG Gaming.',
      503,
    );
  throw error;
}
export async function readArena(
  kind: 'matches' | 'tournaments',
  page = 1,
  registrationPage = 1,
  adminView = false,
) {
  const db = await createClient();
  if (kind === 'matches') {
    const {
      data: matches,
      error,
      count,
    } = await db
      .from('match_requests')
      .select(
        '*, creator:profiles!match_requests_creator_id_fkey(id,faceit_nickname,faceit_level,faceit_elo)',
        { count: 'exact' },
      )
      .in('status', ['open', 'matched'])
      .gt('scheduled_time', new Date().toISOString())
      .order('created_at', { ascending: false })
      .order('id')
      .range((page - 1) * 25, page * 25 - 1);
    queryError(error);
    return { matches: matches as MatchRequest[], has_more: page * 25 < (count || 0) };
  }
  const t = await db
    .from('tournaments')
    .select('*', { count: 'exact' })
    .order('start_date')
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  queryError(t.error);
  const ids = (t.data || []).map((event) => event.id);
  const entriesQuery = adminView
    ? db
        .from('registrations')
        .select(
          '*, tournament:tournaments(title),captain:profiles!registrations_captain_id_fkey(id,faceit_nickname,faceit_level,faceit_elo)',
          { count: 'exact' },
        )
    : db
        .from('public_registrations')
        .select('id,tournament_id,team_name,status,roster_details,created_at', { count: 'exact' });
  const [counts, r] = ids.length
    ? await Promise.all([
        db
          .from('public_tournament_counts')
          .select('tournament_id,registrations_count')
          .in('tournament_id', ids),
        entriesQuery
          .in('tournament_id', ids)
          .order('created_at', { ascending: false })
          .order('id')
          .range((registrationPage - 1) * 50, registrationPage * 50 - 1),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null, count: 0 },
      ];
  queryError(counts.error);
  queryError(r.error);
  const registrations = (r.data || []) as unknown as Registration[];
  if (!adminView) {
    for (const entry of await guestApplications((t.data || []).map((e) => e.id))) {
      const existing = registrations.findIndex((r) => r.id === entry.id);
      if (existing >= 0) registrations[existing] = entry;
      else registrations.push(entry);
    }
  }
  if (adminView && registrations.length) {
    const contacts = await createAdminClient()
      .from('registration_contacts')
      .select('registration_id,captain_name,email,phone,city,notes')
      .in(
        'registration_id',
        registrations.map((r) => r.id),
      );
    queryError(contacts.error);
    for (const entry of registrations)
      entry.contact = contacts.data?.find((c) => c.registration_id === entry.id) || null;
  }
  if (!adminView && t.data?.length) {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) {
      const own = await db
        .from('registrations')
        .select('*')
        .eq('captain_id', user.id)
        .in(
          'tournament_id',
          t.data.map((event) => event.id),
        )
        .limit(25);
      queryError(own.error);
      for (const registration of own.data || []) {
        const at = registrations.findIndex((row) => row.id === registration.id);
        if (at >= 0) registrations[at] = registration as Registration;
        else registrations.push(registration as Registration);
      }
    }
  }
  return {
    tournaments: (t.data || []).map((t) => ({
      ...t,
      registrations_count:
        (counts.data || []).find((row) => row.tournament_id === t.id)?.registrations_count || 0,
    })) as Tournament[],
    registrations,
    has_more: page * 25 < (t.count || 0),
    registrations_has_more: registrationPage * 50 < (r.count || 0),
  };
}
