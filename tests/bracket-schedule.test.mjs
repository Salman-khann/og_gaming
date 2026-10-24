import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function load(file) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const { buildBracket } = await load('src/lib/bracket-engine.ts');
const { scheduleMatches, validateSchedule, matchTimeLabel } = await load('src/lib/bracket-schedule.ts');
const { validBracketResetPassword } = await load('src/lib/bracket-reset-password.ts');
assert.equal(validBracketResetPassword('correct 🔐 password', 'correct 🔐 password'), true);
for (const value of ['', undefined, null, 'wrong', 'correct', 'x'.repeat(1025)]) assert.equal(validBracketResetPassword(value, 'correct 🔐 password'), false);
assert.equal(validBracketResetPassword('anything', ''), false);
const config = { start_date: '2026-11-16', days: [0, 1, 2, 3, 4, 5, 6] };
assert.equal(validateSchedule(null), null);
for (const value of [undefined, {}, { ...config, days: [] }, { ...config, days: [1, 1] }, { ...config, days: [7] }, { ...config, days: ['1'] }, { ...config, start_date: '2026-02-30' }]) assert.throws(() => validateSchedule(value));
for (const size of [2, 3, 5, 20, 128]) for (const type of ['single', 'double']) {
  const games = buildBracket(Array.from({ length: size }, (_, i) => 'team' + i), type).map(node => ({ ...node, node_key: node.key, id: node.key, status: !node.source_a && !node.team_b ? 'bye' : 'pending' }));
  const times = scheduleMatches(games, config);
  assert.deepEqual(scheduleMatches([...games].reverse(), config), times, 'API row order must not change dates');
  assert.deepEqual(scheduleMatches(games.map(game => game.status === 'bye' ? game : { ...game, status: 'completed' }), config), times, 'Results must not move slots');
  assert.equal(new Set(Object.values(times)).size, games.filter(game => game.status !== 'bye').length);
  for (const game of games) {
    if (game.status === 'bye') { assert.equal(times[game.id], undefined); continue; }
    for (const key of [game.source_a, game.source_b].filter(Boolean)) {
      if (times[key]) assert.ok(times[key] < times[game.id], 'A match must follow both feeder matches');
    }
    assert.match(times[game.id], /T(?:15:00|18:30):00\.000Z$/);
  }
  if (size === 20 && type === 'double') {
    const slots = Object.values(times);
    assert.equal(slots.length, 39);
    assert.equal(slots[0], '2026-11-16T15:00:00.000Z');
    assert.equal(slots[37], '2026-12-04T18:30:00.000Z');
    assert.equal(slots[38], '2026-12-05T15:00:00.000Z');
    const weekdays = Object.values(scheduleMatches(games, { ...config, days: [1, 2, 3, 4, 5] }));
    assert.equal(weekdays.at(-1), '2026-12-11T15:00:00.000Z');
    assert.ok(weekdays.every(time => ![0, 6].includes(new Date(time).getUTCDay())));
    assert.deepEqual(scheduleMatches(games.map(game => game.bracket === 'reset' ? { ...game, status: 'bye' } : game), config), Object.fromEntries(Object.entries(times).slice(0, -1)));
  }
}
assert.match(matchTimeLabel('2026-11-16T15:00:00.000Z'), /8:00 pm PKT/i);
console.log('Automatic schedules passed: 2–128 teams, dependency order, fixed PKT slots, weekends, optional weekdays, byes, reset and stable results.');
