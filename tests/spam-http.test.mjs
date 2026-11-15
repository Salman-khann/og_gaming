import { loadTestEnvironment } from '../scripts/lib/test-environment.mjs';
loadTestEnvironment();
// Only use a local server launched with TRUSTED_CLIENT_IP_HEADER=x-og-test-client-ip.
// Invalid titles ensure rate-limit checks never create posts or send notifications.
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
const base = process.argv[2] || 'http://127.0.0.1:3107';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local test server only.');
const post = (path, body, ip) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'x-og-test-client-ip': ip }, body: JSON.stringify(body),
});
for (const [path, body] of [
  ['/api/auth', { action: 'signup', company_website: 'https://spam.invalid' }],
  ['/api/matches', { type: 'gather_5v5', company_website: 'https://spam.invalid' }],
  ['/api/tournaments', { company_website: 'https://spam.invalid' }],
]) {
  const response = await post(path, body, '192.0.2.1');
  assert.equal(response.status, 400, path);
  assert.equal((await response.json()).error, 'Unable to submit this form.');
}
const ip = '2001:db8::' + randomInt(1, 65535).toString(16);
const phone = '0300' + String(randomInt(0, 10000000)).padStart(7, '0');
const body = { type: 'gather_5v5', contact_phone: phone, scheduled_time: new Date(Date.now() + 3600000).toISOString(), min_faceit_level: 1, max_faceit_level: 10, title: '' };
for (let i = 0; i < 5; i++) {
  const response = await post('/api/matches', body, ip);
  assert.equal(response.status, 400, 'invalid title must prevent creation');
  assert.equal((await response.json()).error, 'Invalid title.');
}
let response = await post('/api/matches', body, ip);
assert.equal(response.status, 429);
assert.equal(response.headers.get('retry-after'), '3600');
assert.equal(response.headers.get('cache-control'), 'no-store');
response = await post('/api/matches', body, '2001:db8:1::' + randomInt(1, 65535).toString(16));
assert.equal(response.status, 429, 'changing networks cannot bypass the contact limit');
console.log('Local HTTP spam checks passed: three bot traps, shared database limits, Retry-After and rotating-IP rejection; no posts created.');
