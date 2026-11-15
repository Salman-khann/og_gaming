import 'server-only';
import { verifiedUser } from './auth-session';
import { recoverGuestApplications } from './account-applications';
import { createClient } from './supabase/server';
import { guestApplications } from './team-applications';
import type { Tournament, Registration } from '@/types';

export async function readTournamentDetail(slug: string) {
  const db = await createClient();
  const { data, error } = await db.from('tournaments').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error('Unable to load the event.');
  if (!data) return null;
  const [registrations, counts, session, guests] = await Promise.all([
    db.from('public_registrations').select('*').eq('tournament_id', data.id).limit(128),
    db
      .from('public_tournament_counts')
      .select('registrations_count')
      .eq('tournament_id', data.id)
      .maybeSingle(),
    verifiedUser(db),
    guestApplications([data.id]),
  ]);
  if (registrations.error || counts.error) throw new Error('Unable to load event entries.');
  const entries = (registrations.data || []) as Registration[];
  const merge = (rows: Registration[]) => {
    for (const row of rows) {
      const at = entries.findIndex((entry) => entry.id === row.id);
      if (at >= 0) entries[at] = row;
      else entries.push(row);
    }
  };
  merge(guests);
  const user = session;
  if (user) {
    await recoverGuestApplications(db);
    const own = await db
      .from('registrations')
      .select('*')
      .eq('tournament_id', data.id)
      .is('cancelled_at', null)
      .eq('captain_id', user.id);
    if (own.error) throw new Error('Unable to load your application.');
    merge((own.data || []).map((row) => ({ ...row, can_manage: true })));
  }
  return {
    viewerId: user?.id || null,
    tournament: {
      ...data,
      registrations_count: counts.data?.registrations_count || 0,
    } as Tournament,
    entries,
  };
}
