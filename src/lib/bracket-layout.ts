import type { TournamentMatch } from '@/types';

export const BRACKET_CARD_WIDTH = 264;
export const BRACKET_CARD_HEIGHT = 152;
const PITCH = 172,
  GAP = 40,
  HEADER = 46,
  PORT = 66;
export type BracketPlacement = { match: TournamentMatch; x: number; y: number };

export function bracketScale(availableWidth: number, canvasWidth: number) {
  if (availableWidth <= 0 || canvasWidth <= 0) return 1;
  // Fit desktop rounds together; keep names and schedules legible on phones.
  const minimum = availableWidth >= 900 ? 0.8 : 0.9;
  return Math.max(minimum, Math.min(1, availableWidth / canvasWidth));
}

export function layoutBracket(
  matches: TournamentMatch[],
  cardHeight = BRACKET_CARD_HEIGHT,
  availableWidth = 0,
) {
  const pitch = Math.max(PITCH, cardHeight + 20);
  const keys = [
    ...new Set(matches.map((match) => (match.bracket === 'reset' ? 'reset' : String(match.round)))),
  ].sort((a, b) => (a === 'reset' ? 1 : b === 'reset' ? -1 : Number(a) - Number(b)));
  const cardWidth =
    availableWidth >= 900 && keys.length > 0
      ? Math.max(
          196,
          Math.min(
            BRACKET_CARD_WIDTH,
            (availableWidth / 0.9 - 12 * (keys.length - 1)) / keys.length,
          ),
        )
      : BRACKET_CARD_WIDTH;
  const gap = cardWidth < BRACKET_CARD_WIDTH ? 12 : GAP;
  const firstCount = Math.max(
    1,
    matches.filter(
      (match) => (match.bracket === 'reset' ? 'reset' : String(match.round)) === keys[0],
    ).length,
  );
  const placements: BracketPlacement[] = [];
  const nodes = new Map<string, BracketPlacement>();
  const columns = keys.map((key, column) => {
    const games = matches
      .filter((match) => (match.bracket === 'reset' ? 'reset' : String(match.round)) === key)
      .sort((a, b) => a.position - b.position);
    let previousY = -pitch;
    games.forEach((match, index) => {
      const sources = [
        ...new Set([match.source_a, match.source_b].filter((source): source is string => !!source)),
      ]
        .map((source) => nodes.get(source))
        .filter((source): source is BracketPlacement => !!source);
      const centered = sources.length
        ? sources.reduce((sum, source) => sum + source.y, 0) / sources.length
        : HEADER + (((index + 0.5) * firstCount) / games.length - 0.5) * pitch;
      const placement = {
        match,
        x: column * (cardWidth + gap),
        y: Math.max(HEADER, previousY + pitch, centered),
      };
      previousY = placement.y;
      placements.push(placement);
      nodes.set(
        match.node_key || `${match.bracket || 'winners'}:${match.round}:${match.position}`,
        placement,
      );
    });
    return {
      key,
      x: column * (cardWidth + gap),
      matchCount: games.length,
      bracket: games[0]?.bracket,
    };
  });
  const connections = placements.flatMap((target) => {
    const explicit = [
      ...new Set(
        [target.match.source_a, target.match.source_b].filter(
          (source): source is string => !!source,
        ),
      ),
    ];
    // Older single-elimination brackets have no source keys. Their positions
    // still identify the two entrants from the preceding round.
    const sources = explicit.length
      ? explicit
          .map((key) => nodes.get(key))
          .filter((source): source is BracketPlacement => !!source)
      : placements.filter(
          (source) =>
            (target.match.bracket || 'winners') === 'winners' &&
            source.match.bracket === target.match.bracket &&
            source.match.round === target.match.round - 1 &&
            [target.match.position * 2 - 1, target.match.position * 2].includes(
              source.match.position,
            ),
        );
    return sources
      .filter((source) => source.x < target.x)
      .map((source) => ({
        key: source.match.id + ':' + target.match.id,
        completed: !!source.match.winner_id,
        path: `M ${source.x + cardWidth} ${source.y + PORT} H ${source.x + cardWidth + gap / 2} V ${target.y + PORT} H ${target.x}`,
      }));
  });
  return {
    columns,
    placements,
    connections,
    cardWidth,
    width: Math.max(cardWidth, columns.length * (cardWidth + gap) - gap),
    height:
      Math.max(HEADER + cardHeight, ...placements.map((placement) => placement.y + cardHeight)) +
      24,
  };
}

export function bracketChampion(matches: TournamentMatch[]) {
  const reset = matches.find((match) => match.bracket === 'reset');
  const final = matches.find((match) => match.bracket === 'final');
  if (reset?.winner_id) return reset.winner_id;
  if (final) return !reset || reset.status === 'bye' ? final.winner_id : null;
  return (
    matches
      .filter((match) => (match.bracket || 'winners') === 'winners')
      .sort((a, b) => b.round - a.round)[0]?.winner_id || null
  );
}
