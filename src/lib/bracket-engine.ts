export type BracketNode = {
  key: string;
  bracket: 'winners' | 'losers' | 'final' | 'reset';
  round: number;
  position: number;
  team_a: string | null;
  team_b: string | null;
  source_a: string | null;
  source_b: string | null;
  outcome_a: 'winner' | 'loser';
  outcome_b: 'winner' | 'loser';
};
export function buildBracket(teams: string[], type: 'single' | 'double'): BracketNode[] {
  if (teams.length < 2 || teams.length > 128 || new Set(teams).size !== teams.length)
    throw new Error('A bracket needs 2–128 unique teams.');
  const nodes: BracketNode[] = [];
  type Entry = { key: string; outcome: 'winner' | 'loser' };
  const winner = (match: BracketNode): Entry => ({ key: match.key, outcome: 'winner' });
  const loser = (match: BracketNode): Entry => ({ key: match.key, outcome: 'loser' });
  function match(
    bracket: BracketNode['bracket'],
    round: number,
    position: number,
    a: Entry,
    b: Entry,
  ) {
    const value: BracketNode = {
      key: `${bracket}:${round}:${position}`,
      bracket,
      round,
      position,
      team_a: null,
      team_b: null,
      source_a: a.key,
      source_b: b.key,
      outcome_a: a.outcome,
      outcome_b: b.outcome,
    };
    nodes.push(value);
    return value;
  }
  // Everyone plays in the opening round. Only an odd entrant needs a bye.
  const opening: BracketNode[] = [];
  for (let i = 0; i < teams.length; i += 2) {
    const value: BracketNode = {
      key: `winners:1:${i / 2 + 1}`,
      bracket: 'winners',
      round: 1,
      position: i / 2 + 1,
      team_a: teams[i],
      team_b: teams[i + 1] || null,
      source_a: null,
      source_b: null,
      outcome_a: 'winner',
      outcome_b: 'winner',
    };
    nodes.push(value);
    opening.push(value);
  }
  let upper = opening.map(winner),
    lower = opening.filter((m) => m.team_b).map(loser);
  let upperRound = 1,
    lowerRound = 0;
  function reduceLower(target: number) {
    while (lower.length > target) {
      lowerRound++;
      const next: Entry[] = [];
      for (let i = 0; i + 1 < lower.length; i += 2)
        next.push(winner(match('losers', lowerRound, i / 2 + 1, lower[i], lower[i + 1])));
      // Carry an unmatched entrant forward by reference, without a fake match.
      if (lower.length % 2) next.push(lower[lower.length - 1]);
      lower = next;
    }
  }
  while (upper.length > 1) {
    upperRound++;
    const next: Entry[] = [],
      drops: Entry[] = [];
    for (let i = 0; i + 1 < upper.length; i += 2) {
      const game = match('winners', upperRound, i / 2 + 1, upper[i], upper[i + 1]);
      next.push(winner(game));
      drops.push(loser(game));
    }
    if (upper.length % 2) next.push(upper[upper.length - 1]);
    upper = next;
    if (type === 'double') {
      reduceLower(drops.length);
      // Pair new drop-ins against surviving lower-bracket teams, reversing the
      // drop-in order to delay immediate repeat opponents when possible.
      lowerRound++;
      const survivors: Entry[] = [];
      for (let i = 0; i < drops.length; i++) {
        const drop = drops[drops.length - 1 - i];
        survivors.push(
          lower[i] ? winner(match('losers', lowerRound, i + 1, lower[i], drop)) : drop,
        );
      }
      lower = survivors;
    }
  }
  if (type === 'single') return nodes;
  reduceLower(1);
  const final = match('final', 1, 1, upper[0], lower[0]);
  match('reset', 1, 1, winner(final), loser(final));
  return nodes;
}

export function balanceTeams<T extends { id: string; elo: number | null }>(
  players: T[],
): { a: T[]; b: T[]; difference: number } {
  if (players.length !== 10 || players.some((p) => p.elo == null || !Number.isFinite(p.elo)))
    throw new Error('Ten verified ELO values are required to balance teams.');
  let best: T[] = [],
    smallest = Infinity;
  const total = players.reduce((sum, p) => sum + p.elo!, 0);
  // At ten players there are only 252 equal-size partitions. Keep player one
  // on A to remove symmetric duplicates; evaluate every remaining possibility.
  for (let mask = 1; mask < 1024; mask += 2) {
    const a = players.filter((_, i) => mask & (1 << i));
    if (a.length !== 5) continue;
    const difference = Math.abs(total - 2 * a.reduce((sum, p) => sum + p.elo!, 0));
    if (difference < smallest) {
      smallest = difference;
      best = a;
    }
  }
  const ids = new Set(best.map((p) => p.id));
  return { a: best, b: players.filter((p) => !ids.has(p.id)), difference: smallest };
}
