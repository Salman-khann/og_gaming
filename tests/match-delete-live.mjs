import { loadTestEnvironment } from '../scripts/lib/test-environment.mjs';
loadTestEnvironment();
// Run manually: node tests/match-delete-live.mjs http://localhost:3101
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.argv[2] || 'http://localhost:3101';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local test server.');
let id, cookie;
const headers = { 'Content-Type': 'application/json', Origin: base };
async function remove(value) { return fetch(base + '/api/matches', { method: 'DELETE', headers: { ...headers, ...(value ? { Cookie: value } : {}) }, body: JSON.stringify({ match_id: id }) }); }
try {
  const created = await fetch(base + '/api/matches', { method: 'POST', headers, body: JSON.stringify({ title: 'Temporary deletion check ' + randomUUID(), type: 'gather_5v5', contact_phone: '+19995550123', scheduled_time: new Date(Date.now() + 3600000).toISOString(), min_faceit_level: 1, max_faceit_level: 10, target_players_count: 10 }) });
  const body = await created.json();
  assert.equal(created.status, 201, body.error);
  id = body.match.id;
  cookie = created.headers.getSetCookie().find(value => value.startsWith('og_match_' + id + '='))?.split(';')[0];
  assert.ok(cookie, 'Host deletion cookie missing');
  const publicList = await (await fetch(base + '/api/matches')).json();
  assert.equal(publicList.matches.find(m => m.id === id)?.can_delete, false);
  const ownedList = await (await fetch(base + '/api/matches', { headers: { Cookie: cookie } })).json();
  assert.equal(ownedList.matches.find(m => m.id === id)?.can_delete, true);
  assert.equal((await remove()).status, 403, 'Stranger could delete the post');
  assert.equal((await remove(cookie.split('=')[0] + '=' + '0'.repeat(64))).status, 403, 'Forged cookie could delete the post');
  assert.equal((await remove(cookie)).status, 200, 'Host could not delete their post');
  const after = await (await fetch(base + '/api/matches')).json();
  assert.ok(!after.matches.some(m => m.id === id));
  const protectedBracket = await fetch(base + '/api/tournaments/bracket', { method: 'POST', headers, body: JSON.stringify({ tournament_id: randomUUID() }) });
  assert.equal(protectedBracket.status, 401);
  const tournaments = await (await fetch(base + '/api/tournaments')).json();
  if (tournaments.tournaments?.length) {
    const bracket = await fetch(base + '/api/tournaments/bracket?tournament_id=' + tournaments.tournaments[0].id);
    assert.equal(bracket.status, 200);
    assert.ok(Array.isArray((await bracket.json()).matches));
  }
  console.log('Guest creation, ownership cookie, unauthorized deletion, owner deletion and bracket API checks passed.');
} finally {
  if (id && cookie) await remove(cookie);
}
