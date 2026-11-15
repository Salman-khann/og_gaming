import { Suspense } from 'react';
import Link from 'next/link';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { readTournamentDetail } from '@/lib/tournament-detail';
import { Navbar } from '@/components/Navbar';
import { TournamentDetail } from '@/components/TournamentDetail';
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
  const { slug } = await params;
  const result = await readTournamentDetail(slug);
  if (!result) notFound();
  const { tournament, entries, viewerId } = result;
  return (
    <main className="wrap arena-main">
      <Link className="text-link" href="/tournaments">
        ← All tournaments
      </Link>
      <p className="eyebrow">OG GAMING / EVENT</p>
      <h1>{tournament.title}</h1>
      <TournamentDetail tournament={tournament} registrations={entries} viewerId={viewerId} />
    </main>
  );
}
