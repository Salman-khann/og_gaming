'use client';
import { useEffect } from 'react';
import { ArenaLoading } from './ui/arena-loading';
import type { Tournament, Registration } from '@/types';
import { useAuth } from './AuthProvider';
import { TournamentsView } from './TournamentsView';
import { useRouter } from 'next/navigation';
export function TournamentDetail({
  tournament,
  registrations,
  viewerId,
}: {
  tournament: Tournament;
  registrations: Registration[];
  viewerId: string | null;
}) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const identity = profile?.id || null;
  useEffect(() => {
    if (loading || viewerId === identity) return;
    // A restored/preloaded event can contain a previous anonymous response.
    // Re-read its private application after the current account is established.
    router.refresh();
  }, [loading, identity, viewerId, router]);
  if (loading || viewerId !== identity) return <ArenaLoading />;
  return (
    <TournamentsView
      detail
      tournaments={[tournament]}
      registrations={registrations}
      currentProfile={profile}
      onRegistrationCreated={() => router.refresh()}
    />
  );
}
