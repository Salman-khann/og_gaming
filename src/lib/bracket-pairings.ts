import { buildBracket } from './bracket-engine';
import type { TournamentMatch } from '@/types';
export type OpeningPairing = { team_a: string | null; team_b: string | null };

export function automaticPairings(teamIds: string[]): OpeningPairing[] {
  return buildBracket(teamIds, 'single').filter(match => match.bracket === 'winners' && match.round === 1).map(({ team_a, team_b }) => ({ team_a, team_b }));
}
export function currentPairings(matches: TournamentMatch[]): OpeningPairing[] {
  return matches.filter(match => (match.bracket || 'winners') === 'winners' && match.round === 1).sort((a, b) => a.position - b.position).map(({ team_a, team_b }) => ({ team_a, team_b }));
}
export function validatePairings(value: unknown, teamIds: string[]): OpeningPairing[] {
  if (teamIds.length < 2 || teamIds.length > 128 || new Set(teamIds).size !== teamIds.length) throw new Error('Choose 2–128 distinct eligible teams.');
  let size = 2;
  while (size < teamIds.length) size *= 2;
  if (!Array.isArray(value) || value.length !== size / 2) throw new Error('The number of opening matches does not match the entrant list.');
  const eligible = new Set(teamIds), selected = new Set<string>();
  const pairings = value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid matchup.');
    const pairing: OpeningPairing = { team_a: null, team_b: null };
    for (const side of ['team_a', 'team_b'] as const) {
      const id = item[side];
      if (id === null) continue;
      if (typeof id !== 'string' || !eligible.has(id)) throw new Error('Every selected team must be eligible for this tournament.');
      if (selected.has(id)) throw new Error('A team cannot appear in more than one slot.');
      selected.add(id); pairing[side] = id;
    }
    if (!pairing.team_a && !pairing.team_b) throw new Error('Match ' + (index + 1) + ' needs at least one team.');
    return pairing;
  });
  if (selected.size !== eligible.size) throw new Error('Assign every entrant exactly once.');
  return pairings;
}
export function buildPairedBracket(teamIds: string[], type: 'single' | 'double', value?: unknown) {
  const graph = buildBracket(teamIds, type);
  if (value === undefined) return graph;
  const pairings = validatePairings(value, teamIds);
  return graph.map(match => match.bracket === 'winners' && match.round === 1 ? { ...match, ...pairings[match.position - 1] } : match);
}
