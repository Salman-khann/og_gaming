import { Suspense } from 'react';
import { connection } from 'next/server';
import { Navbar } from '@/components/Navbar';
import { PlayerProfile } from '@/components/PlayerProfile';
import { permanentRedirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

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
  if (/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) {
    const result = await createAdminClient()
      .from('profiles')
      .select('public_slug')
      .or('id.eq.' + id + ',faceit_id.eq.' + id)
      .neq('role', 'banned')
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error('Unable to load player address.');
    if (result.data?.public_slug) permanentRedirect('/players/' + result.data.public_slug);
  }
  return <PlayerProfile playerId={id} />;
}
