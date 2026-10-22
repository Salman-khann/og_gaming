import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/faceit.ts', import.meta.url), 'utf8').replace("import 'server-only';", ''), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { normalizeFaceitNickname, verifyFaceitPlayer } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
assert.equal(normalizeFaceitNickname(' https://www.faceit.com/en/players/Test-Player/stats/cs2 '), 'Test-Player');
assert.equal(normalizeFaceitNickname('faceit.com/en/players/Test-Player'), 'Test-Player');
assert.equal(normalizeFaceitNickname('@Test-Player'), 'Test-Player');
for (const value of ['', 'some name', 'https://example.com/en/players/a', 'https://faceit.com/en/teams/a']) assert.throws(() => normalizeFaceitNickname(value));
const originalFetch = globalThis.fetch, previousKey = process.env.FACEIT_API_KEY;
process.env.FACEIT_API_KEY = 'test-only';
const player = { player_id: 'verified-id', nickname: 'ExactName', games: { cs2: { skill_level: 6, faceit_elo: 1400 } } };
const calls = [];
try {
  globalThis.fetch = async url => {
    calls.push(url);
    if (url.includes('/search/')) return Response.json({ items: [{ player_id: 'wrong-id', nickname: 'ExactNameSimilar' }, { player_id: 'verified-id', nickname: 'ExactName' }] });
    if (url.includes('/players?')) return new Response('{}', { status: 404 });
    assert.ok(url.endsWith('/players/verified-id'));
    return Response.json(player);
  };
  assert.equal((await verifyFaceitPlayer('exactname')).id, 'verified-id');
  assert.equal(calls.length, 3);
  assert.equal((await verifyFaceitPlayer('https://faceit.com/en/players/ExactName')).level, 6);
  assert.equal(calls.length, 3, 'normalized profiles should share the cached verification');
  await assert.rejects(verifyFaceitPlayer('Unknown'), /Unknown.*not found/);
  globalThis.fetch = async () => Response.json({ ...player, nickname: 'NoCS2', games: {} });
  await assert.rejects(verifyFaceitPlayer('NoCS2'), /NoCS2.*CS2/);
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  await assert.rejects(verifyFaceitPlayer('Unauthorized'), /credentials/);
  globalThis.fetch = async () => new Response('{}', { status: 429 });
  await assert.rejects(verifyFaceitPlayer('RateLimited'), /too many requests/);
  let concurrentCalls = 0;
  globalThis.fetch = async () => {
    concurrentCalls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return Response.json({ ...player, nickname: 'Concurrent' });
  };
  const concurrent = await Promise.all([verifyFaceitPlayer('Concurrent'), verifyFaceitPlayer('concurrent')]);
  assert.equal(concurrentCalls, 1, 'simultaneous lookups must share one provider request');
  assert.equal(concurrent[0].id, concurrent[1].id);
  globalThis.fetch = async () => Response.json({ ...player, games: { cs2: { skill_level: 11, faceit_elo: 1400 } } });
  await assert.rejects(verifyFaceitPlayer('InvalidLevel'), /CS2/);
  globalThis.fetch = async () => Response.json({ ...player, games: { cs2: { skill_level: 6 } } });
  await assert.rejects(verifyFaceitPlayer('MissingElo'), /CS2/);
} finally {
  globalThis.fetch = originalFetch;
  if (previousKey === undefined) delete process.env.FACEIT_API_KEY; else process.env.FACEIT_API_KEY = previousKey;
}
console.log('FACEIT profile normalization, exact search fallback, CS2 eligibility and API error tests passed.');
