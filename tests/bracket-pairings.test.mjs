import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64');
const engineUrl = moduleUrl(readFileSync(new URL('../src/lib/bracket-engine.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/bracket-pairings.ts', import.meta.url), 'utf8').replace("'./bracket-engine'", JSON.stringify(engineUrl));
const { automaticPairings, validatePairings, buildPairedBracket } = await import(moduleUrl(source));
for (const count of [2, 3, 5, 8, 16, 128]) {
  const ids = Array.from({ length: count }, (_, i) => 'team-' + i), automatic = automaticPairings(ids);
  assert.deepEqual(validatePairings(automatic, ids), automatic);
  // Reverse all assigned teams while preserving the number and placement of byes.
  const reversed = [...ids].reverse();
  const custom = automatic.map(pair => ({ team_a: pair.team_a ? reversed.shift() : null, team_b: pair.team_b ? reversed.shift() : null }));
  for (const type of ['single', 'double']) {
    const autoGraph = buildPairedBracket(ids, type), customGraph = buildPairedBracket(ids, type, custom);
    assert.deepEqual(customGraph.filter(m => m.bracket === 'winners' && m.round === 1).map(({ team_a, team_b }) => ({ team_a, team_b })), custom);
    assert.deepEqual(customGraph.map(({ key, source_a, source_b, outcome_a, outcome_b }) => ({ key, source_a, source_b, outcome_a, outcome_b })), autoGraph.map(({ key, source_a, source_b, outcome_a, outcome_b }) => ({ key, source_a, source_b, outcome_a, outcome_b })));
  }
}
for (const bad of [null, {}, [], [{ team_a: 'a', team_b: 'a' }], [{ team_a: 'a', team_b: 'outside' }], [{ team_a: null, team_b: null }], [{ team_a: 'a', team_b: null }], [{ team_a: 'a' }]]) assert.throws(() => validatePairings(bad, ['a', 'b']));
assert.deepEqual(validatePairings([{ team_a: 'b', team_b: 'a' }], ['a', 'b']), [{ team_a: 'b', team_b: 'a' }]);
console.log('Custom bracket pairings passed: 2–128 entrants, exact matchups, preserved progression and invalid selection rejection.');
