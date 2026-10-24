import type { TournamentMatch } from '@/types';

export function validSeriesScore(a: number, b: number) {
  return (
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    ((a === 2 && (b === 0 || b === 1)) || (b === 2 && (a === 0 || a === 1)))
  );
}

export function resultLocked(match: TournamentMatch, matches: TournamentMatch[]) {
  if (!match.node_key) return false;
  const seen = new Set([match.node_key]);
  for (let changed = true; changed;) {
    changed = false;
    for (const next of matches) {
      if (
        next.node_key &&
        !seen.has(next.node_key) &&
        [next.source_a, next.source_b].some((key) => key && seen.has(key))
      ) {
        if (next.status === 'completed') return true;
        seen.add(next.node_key);
        changed = true;
      }
    }
  }
  return false;
}

export function teamLosses(id: string, matches: TournamentMatch[]) {
  return matches.filter(
    (m) =>
      m.status === 'completed' &&
      m.winner_id &&
      m.winner_id !== id &&
      (m.team_a === id || m.team_b === id),
  ).length;
}
