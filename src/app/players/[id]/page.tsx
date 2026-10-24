import { Suspense } from 'react';
import { connection } from 'next/server';
import { Navbar } from '@/components/Navbar';
import { PlayerProfile } from '@/components/PlayerProfile';

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <main className="wrap arena-main">
            <p role="status">Loading player...</p>
          </main>
        }
      >
        <PlayerContent params={params} />
      </Suspense>
    </>
  );
}

async function PlayerContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <PlayerProfile playerId={id} />;
}
