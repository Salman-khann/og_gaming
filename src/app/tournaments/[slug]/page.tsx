import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { TournamentDetail } from '@/components/TournamentDetail';
import type { Tournament, Registration } from '@/types';
import { guestApplications } from '@/lib/team-applications';
export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <main className="wrap arena-main">
            <p role="status">Loading event...</p>
          </main>
        }
      >
        <EventContent params={params} />
      </Suspense>
    </>
  );
}
async function EventContent({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params,
    db = await createClient();
  const { data, error } = await db.from('tournaments').select('*').eq('slug', slug).single();
  if (error || !data) notFound();
  const { data: registrations, error: registrationError } = await db
    .from('public_registrations')
    .select('*')
    .eq('tournament_id', data.id)
    .limit(128);
  if (registrationError) throw new Error('Unable to load event entries.');
  const counts = await db
    .from('public_tournament_counts')
    .select('registrations_count')
    .eq('tournament_id', data.id)
    .maybeSingle();
  if (counts.error) throw new Error('Unable to load event capacity.');
  const tournament = {
    ...data,
    registrations_count: counts.data?.registrations_count || 0,
  } as Tournament;
  const entries = (registrations || []) as Registration[];
  for (const own of await guestApplications([data.id])) {
    const at = entries.findIndex((r) => r.id === own.id);
    if (at >= 0) entries[at] = own;
    else entries.push(own);
  }
  const {
    data: { user },
  } = await db.auth.getUser();
  if (user) {
    const own = await db
      .from('registrations')
      .select('*')
      .eq('tournament_id', data.id)
      .eq('captain_id', user.id);
    if (own.error) throw new Error('Unable to load your application.');
    for (const row of own.data || []) {
      const at = entries.findIndex((r) => r.id === row.id);
      if (at >= 0) entries[at] = row;
      else entries.push(row);
    }
  }
  return (
    <main className="wrap arena-main">
      <Link className="text-link" href="/tournaments">
        ← All tournaments
      </Link>
      <p className="eyebrow">OG GAMING / EVENT</p>
      <h1>{tournament.title}</h1>
      <TournamentDetail tournament={tournament} registrations={entries} />
    </main>
  );
}
