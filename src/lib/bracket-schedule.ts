import type { TournamentMatch } from '@/types';

export type BracketSchedule = { start_date: string; days: number[] };
export const MATCH_SLOTS = ['20:00', '23:30'] as const;
export const PLAY_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function validateSchedule(value: unknown): BracketSchedule | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Choose a schedule start date and play days.');
  const { start_date, days } = value as Record<string, unknown>;
  if (
    typeof start_date !== 'string' ||
    !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(start_date) ||
    start_date > '9998-12-31'
  )
    throw new Error('Choose a valid schedule start date.');
  const date = new Date(start_date + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start_date)
    throw new Error('Choose a valid schedule start date.');
  if (
    !Array.isArray(days) ||
    !days.length ||
    days.length > 7 ||
    days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(days).size !== days.length
  )
    throw new Error('Select at least one play day, without duplicates.');
  return { start_date, days: [...days].sort((a, b) => a - b) };
}

// Schedule the graph in dependency order; unfinished rounds already get dates.
// Results and API row ordering do not change the assigned slots. Byes use none.
export function scheduleMatches(
  matches: TournamentMatch[],
  schedule: BracketSchedule | null,
): Record<string, string> {
  if (!schedule) return {};
  const config = validateSchedule(schedule)!;
  const nodes = new Map(
    matches.filter((match) => match.node_key).map((match) => [match.node_key!, match]),
  );
  const stages = new Map<string, number>(),
    visiting = new Set<string>();
  function stage(match: TournamentMatch): number {
    if (stages.has(match.id)) return stages.get(match.id)!;
    if (visiting.has(match.id))
      throw new Error('The bracket contains circular match dependencies.');
    visiting.add(match.id);
    const sources = [match.source_a, match.source_b].filter((key): key is string => !!key);
    const depth = sources.length
      ? Math.max(
          ...sources.map((key) => {
            const source = nodes.get(key);
            if (!source) throw new Error('A bracket match dependency is missing.');
            return stage(source);
          }),
        ) + 1
      : match.round;
    visiting.delete(match.id);
    stages.set(match.id, depth);
    return depth;
  }
  const order = { winners: 0, losers: 1, final: 2, reset: 3 };
  const games = matches
    .filter((match) => match.status !== 'bye')
    .sort(
      (a, b) =>
        stage(a) - stage(b) ||
        order[a.bracket || 'winners'] - order[b.bracket || 'winners'] ||
        a.round - b.round ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    );
  const date = new Date(config.start_date + 'T00:00:00Z'),
    result: Record<string, string> = {};
  games.forEach((match, index) => {
    if (index && index % MATCH_SLOTS.length === 0) date.setUTCDate(date.getUTCDate() + 1);
    while (!config.days.includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
    result[match.id] = new Date(
      date.toISOString().slice(0, 10) + 'T' + MATCH_SLOTS[index % MATCH_SLOTS.length] + ':00+05:00',
    ).toISOString();
  });
  return result;
}

export function matchTimeLabel(iso: string) {
  return (
    new Date(iso).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' PKT'
  );
}

export function matchDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-PK', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function matchClockLabel(iso: string) {
  return (
    new Date(iso).toLocaleTimeString('en-PK', {
      timeZone: 'Asia/Karachi',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' PKT'
  );
}
