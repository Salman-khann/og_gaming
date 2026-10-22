'use client';
import { useAuth } from './AuthProvider';
import { TournamentBracket } from './TournamentBracket';

export function TournamentBracketPage({ tournamentId }: { tournamentId: string }) {
  const { profile } = useAuth();
  const admin = profile?.role === 'admin';
  return <TournamentBracket key={tournamentId + ':' + admin} tournamentId={tournamentId} admin={admin} />;
}
