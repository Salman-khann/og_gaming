import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/steam-openid.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { STEAM_ENDPOINT, steamLoginUrl, steamAssertion, steamVerificationIsValid } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const now = Date.parse('2026-10-08T12:00:00Z');
const callback = 'http://localhost:3000/api/auth/steam/callback?state=abc';
const params = new URLSearchParams({ 'openid.ns': 'http://specs.openid.net/auth/2.0', 'openid.mode': 'id_res', 'openid.op_endpoint': STEAM_ENDPOINT, 'openid.return_to': callback, 'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198012345678', 'openid.identity': 'https://steamcommunity.com/openid/id/76561198012345678', 'openid.response_nonce': '2026-10-08T11:59:30Zrandom', 'openid.assoc_handle': 'handle', 'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle', 'openid.sig': 'signature', state: 'abc' });
assert.equal(steamLoginUrl(callback).searchParams.get('openid.return_to'), callback);
assert.equal(steamAssertion(params, callback, now).steamId, '76561198012345678');
assert.equal(steamAssertion(params, callback, now).body.get('openid.mode'), 'check_authentication');
for (const [key, value] of [['openid.op_endpoint', 'https://attacker.example'], ['openid.return_to', 'http://localhost:3000/api/auth/steam/callback?state=other'], ['openid.claimed_id', 'https://attacker.example/76561198012345678'], ['openid.identity', 'https://steamcommunity.com/openid/id/76561198087654321'], ['openid.signed', 'claimed_id'], ['openid.response_nonce', '2026-10-08T11:50:00Zold'], ['openid.response_nonce', '2026-10-08T12:02:00Zfuture'], ['openid.sig', '']]) {
  const invalid = new URLSearchParams(params); invalid.set(key, value);
  assert.throws(() => steamAssertion(invalid, callback, now), key);
}
const duplicate = new URLSearchParams(params); duplicate.append('state', 'other');
assert.throws(() => steamAssertion(duplicate, callback, now));
assert.equal(steamVerificationIsValid('ns:test\nis_valid:true\n'), true);
for (const body of ['is_valid:false\n', 'is_valid:truex', 'is_valid:true\nis_valid:false', 'error:is_valid:true']) assert.equal(steamVerificationIsValid(body), false);
console.log('Steam assertion tests passed: forged IDs, endpoint, callback, unsigned claims, duplicate parameters, expired/future nonces, and invalid verification rejected.');
