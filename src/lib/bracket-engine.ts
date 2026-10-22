export type BracketNode = {
  key: string; bracket: 'winners' | 'losers' | 'final' | 'reset'; round: number; position: number;
  team_a: string | null; team_b: string | null;
  source_a: string | null; source_b: string | null; outcome_a: 'winner' | 'loser'; outcome_b: 'winner' | 'loser';
};
export function buildBracket(teams: string[], type: 'single' | 'double'): BracketNode[] {
  if (teams.length < 2 || teams.length > 128 || new Set(teams).size !== teams.length) throw new Error('A bracket needs 2–128 unique teams.');
  let size = 2;
  while (size < teams.length) size *= 2;
  const rounds = Math.log2(size), nodes: BracketNode[] = [], winners: BracketNode[][] = [];
  let seeds = [1, 2];
  while (seeds.length < size) seeds = seeds.flatMap(seed => [seed, seeds.length * 2 + 1 - seed]);
  function node(bracket: BracketNode['bracket'], round: number, position: number, a: string | null, b: string | null, outcomeA: 'winner' | 'loser' = 'winner', outcomeB: 'winner' | 'loser' = 'winner', direct = false) {
    const value: BracketNode = { key: `${bracket}:${round}:${position}`, bracket, round, position, team_a: direct ? a : null, team_b: direct ? b : null, source_a: direct ? null : a, source_b: direct ? null : b, outcome_a: outcomeA, outcome_b: outcomeB };
    nodes.push(value); return value;
  }
  for (let r = 1; r <= rounds; r++) {
    const row: BracketNode[] = [];
    for (let p = 1; p <= size / 2 ** r; p++) row.push(r === 1
      ? node('winners', r, p, teams[seeds[2 * p - 2] - 1] || null, teams[seeds[2 * p - 1] - 1] || null, 'winner', 'winner', true)
      : node('winners', r, p, winners[r - 2][2 * p - 2].key, winners[r - 2][2 * p - 1].key));
    winners.push(row);
  }
  if (type === 'single') return nodes;
  let losers: BracketNode[];
  if (rounds === 1) losers = [winners[0][0]];
  else {
    losers = Array.from({ length: size / 4 }, (_, i) => node('losers', 1, i + 1, winners[0][2 * i].key, winners[0][2 * i + 1].key, 'loser', 'loser'));
    for (let r = 2; r <= rounds; r++) {
      // Reverse each drop-in row to delay repeat pairings across the two paths.
      losers = losers.map((previous, i) => node('losers', 2 * r - 2, i + 1, previous.key, winners[r - 1][winners[r - 1].length - 1 - i].key, 'winner', 'loser'));
      if (r < rounds) losers = Array.from({ length: losers.length / 2 }, (_, i) => node('losers', 2 * r - 1, i + 1, losers[2 * i].key, losers[2 * i + 1].key));
    }
  }
  const final = node('final', 1, 1, winners[rounds - 1][0].key, losers[0].key, 'winner', rounds === 1 ? 'loser' : 'winner');
  node('reset', 1, 1, final.key, final.key, 'winner', 'loser');
  return nodes;
}

export function balanceTeams<T extends { id: string; elo: number | null }>(players: T[]): { a: T[]; b: T[]; difference: number } {
  if (players.length !== 10 || players.some(p => p.elo == null || !Number.isFinite(p.elo))) throw new Error('Ten verified ELO values are required to balance teams.');
  let best: T[] = [], smallest = Infinity;
  const total = players.reduce((sum, p) => sum + p.elo!, 0);
  // At ten players there are only 252 equal-size partitions. Keep player one
  // on A to remove symmetric duplicates; evaluate every remaining possibility.
  for (let mask = 1; mask < 1024; mask += 2) {
    const a = players.filter((_, i) => mask & (1 << i));
    if (a.length !== 5) continue;
    const difference = Math.abs(total - 2 * a.reduce((sum, p) => sum + p.elo!, 0));
    if (difference < smallest) { smallest = difference; best = a; }
  }
  const ids = new Set(best.map(p => p.id));
  return { a: best, b: players.filter(p => !ids.has(p.id)), difference: smallest };
}
