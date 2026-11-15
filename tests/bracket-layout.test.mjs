import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function load(path) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const { buildBracket } = await load('../src/lib/bracket-engine.ts');
const { layoutBracket, bracketChampion, bracketScale, BRACKET_CARD_WIDTH, BRACKET_CARD_HEIGHT } = await load('../src/lib/bracket-layout.ts');
// A 20-team upper bracket should fit ordinary desktops, while phones keep readable cards.
const twentyTeams = buildBracket(Array.from({ length: 20 }, (_, i) => 'team-' + i), 'double');
const upperWidth = layoutBracket(twentyTeams.filter(match => match.bracket === 'winners')).width;
for (const viewport of [1440, 1920, 2560]) {
  const available = viewport - Math.min(64, viewport * .04) - 32;
  assert.ok(upperWidth * bracketScale(available, upperWidth) <= available + .01, 'All upper rounds fit on desktop');
}
for (const laneName of ['winners', 'losers']) for (const available of [1335, 1824, 2464]) {
  const responsive = layoutBracket(twentyTeams.filter(match => match.bracket === laneName), BRACKET_CARD_HEIGHT, available);
  assert.ok(responsive.width * bracketScale(available, responsive.width) <= available + .01, 'Upper and lower rounds fit desktop width');
  assert.ok(responsive.cardWidth >= 196 && responsive.cardWidth <= BRACKET_CARD_WIDTH);
  for (const placement of responsive.placements) assert.ok(placement.x + responsive.cardWidth <= responsive.width);
}
assert.equal(bracketScale(0, upperWidth), 1, 'Server rendering does not guess a viewport');
assert.equal(bracketScale(326, upperWidth), .9, 'Mobile retains readable names and schedules');
assert.equal(bracketScale(1000, 3000), .8, 'Large draws remain legible instead of shrinking without a limit');
const lane = match => ['final', 'reset'].includes(match.bracket) ? 'finals' : match.bracket;
const asMatches = nodes => nodes.map(node => ({ ...node, id: node.key, node_key: node.key, winner_id: null, status: 'pending', score_a: null, score_b: null }));
for (const count of [2, 3, 5, 8, 16, 31, 64, 128]) for (const type of ['single', 'double']) {
  const matches = asMatches(buildBracket(Array.from({ length: count }, (_, index) => 'team-' + index), type));
  for (const group of ['winners', 'losers', 'finals']) {
    const games = matches.filter(match => lane(match) === group);
    if (!games.length) continue;
    const layout = layoutBracket([...games].reverse());
    assert.equal(layout.placements.length, games.length, 'every generated match must appear once');
    assert.equal(new Set(layout.placements.map(item => item.match.id)).size, games.length);
    const sourceKeys = new Set(games.map(match => match.node_key));
    const expectedConnections = games.reduce((total, match) => total + [...new Set([match.source_a, match.source_b])].filter(key => key && sourceKeys.has(key)).length, 0);
    assert.equal(layout.connections.length, expectedConnections, 'connectors must follow real source matches in this lane');
    for (const column of layout.columns) {
      const placed = layout.placements.filter(item => item.x === column.x).sort((a, b) => a.y - b.y);
      for (let index = 1; index < placed.length; index++) assert.ok(placed[index].y >= placed[index - 1].y + BRACKET_CARD_HEIGHT, 'match cards may not overlap');
    }
    for (const item of layout.placements) {
      assert.ok(Number.isFinite(item.x) && Number.isFinite(item.y));
      assert.ok(item.x >= 0 && item.y >= 0);
      assert.ok(item.x + BRACKET_CARD_WIDTH <= layout.width);
      assert.ok(item.y + BRACKET_CARD_HEIGHT <= layout.height);
      const parents = [...new Set([item.match.source_a, item.match.source_b])].map(key => layout.placements.find(parent => parent.match.node_key === key)).filter(Boolean);
      if (parents.length === 2) assert.equal(item.y, (parents[0].y + parents[1].y) / 2, 'the next round must be centered between its source matches');
    }
  }
}
const legacy = asMatches(buildBracket(Array.from({ length: 8 }, (_, i) => 'team-' + i), 'single')).map(match => {
  const old = { ...match }; delete old.source_a; delete old.source_b; delete old.node_key; return old;
});
assert.equal(layoutBracket(legacy).connections.length, 6, 'older single-elimination matches still receive connectors');
const final = { bracket: 'final', winner_id: 'upper-champion', round: 1 }, reset = { bracket: 'reset', winner_id: null, status: 'pending', round: 1 };
assert.equal(bracketChampion([final, reset]), null, 'do not declare a champion before a required reset');
assert.equal(bracketChampion([final, { ...reset, status: 'bye' }]), 'upper-champion');
assert.equal(bracketChampion([final, { ...reset, winner_id: 'reset-champion' }]), 'reset-champion');
assert.equal(bracketChampion([{ bracket: 'winners', round: 3, winner_id: 'single-champion' }]), 'single-champion');
assert.ok(Number.isFinite(layoutBracket([]).height));
console.log('Bracket layout passed for 2–128 teams: source connectors, centered rounds, no overlapping cards, legacy matches and championship/reset outcomes.');
