import type { TournamentMatch } from '@/types';

export const BRACKET_CARD_WIDTH = 248;
export const BRACKET_CARD_HEIGHT = 92;
const PITCH = 144, GAP = 88, HEADER = 52, PORT = 58;
export type BracketPlacement = { match: TournamentMatch; x: number; y: number };

export function layoutBracket(matches: TournamentMatch[]) {
  const keys = [...new Set(matches.map(match => match.bracket === 'reset' ? 'reset' : String(match.round)))].sort((a, b) => a === 'reset' ? 1 : b === 'reset' ? -1 : Number(a) - Number(b));
  const firstCount = Math.max(1, matches.filter(match => (match.bracket === 'reset' ? 'reset' : String(match.round)) === keys[0]).length);
  const placements: BracketPlacement[] = [];
  const nodes = new Map<string, BracketPlacement>();
  const columns = keys.map((key, column) => {
    const games = matches.filter(match => (match.bracket === 'reset' ? 'reset' : String(match.round)) === key).sort((a, b) => a.position - b.position);
    let previousY = -PITCH;
    games.forEach((match, index) => {
      const sources = [...new Set([match.source_a, match.source_b].filter((source): source is string => !!source))].map(source => nodes.get(source)).filter((source): source is BracketPlacement => !!source);
      const centered = sources.length ? sources.reduce((sum, source) => sum + source.y, 0) / sources.length : HEADER + ((index + .5) * firstCount / games.length - .5) * PITCH;
      const placement = { match, x: column * (BRACKET_CARD_WIDTH + GAP), y: Math.max(HEADER, previousY + PITCH, centered) };
      previousY = placement.y;
      placements.push(placement);
      nodes.set(match.node_key || `${match.bracket || 'winners'}:${match.round}:${match.position}`, placement);
    });
    return { key, x: column * (BRACKET_CARD_WIDTH + GAP), matchCount: games.length, bracket: games[0]?.bracket };
  });
  const connections = placements.flatMap(target => {
    const explicit = [...new Set([target.match.source_a, target.match.source_b].filter((source): source is string => !!source))];
    // Older single-elimination brackets have no source keys. Their positions
    // still identify the two entrants from the preceding round.
    const sources = explicit.length ? explicit.map(key => nodes.get(key)).filter((source): source is BracketPlacement => !!source) : placements.filter(source => (target.match.bracket || 'winners') === 'winners' && source.match.bracket === target.match.bracket && source.match.round === target.match.round - 1 && [target.match.position * 2 - 1, target.match.position * 2].includes(source.match.position));
    return sources.filter(source => source.x < target.x).map(source => ({
      key: source.match.id + ':' + target.match.id,
      completed: !!source.match.winner_id,
      path: `M ${source.x + BRACKET_CARD_WIDTH} ${source.y + PORT} H ${source.x + BRACKET_CARD_WIDTH + GAP / 2} V ${target.y + PORT} H ${target.x}`,
    }));
  });
  return { columns, placements, connections, width: Math.max(BRACKET_CARD_WIDTH, columns.length * (BRACKET_CARD_WIDTH + GAP) - GAP), height: Math.max(HEADER + BRACKET_CARD_HEIGHT, ...placements.map(placement => placement.y + BRACKET_CARD_HEIGHT)) + 24 };
}

export function bracketChampion(matches: TournamentMatch[]) {
  const reset = matches.find(match => match.bracket === 'reset');
  const final = matches.find(match => match.bracket === 'final');
  if (reset?.winner_id) return reset.winner_id;
  if (final) return !reset || reset.status === 'bye' ? final.winner_id : null;
  return matches.filter(match => (match.bracket || 'winners') === 'winners').sort((a, b) => b.round - a.round)[0]?.winner_id || null;
}
