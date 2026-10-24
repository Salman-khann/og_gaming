import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import * as net from 'node:net';
import ts from 'typescript';
import { inspectText, inspectEnvironment, forbiddenTrackedPath } from '../scripts/security-check.mjs';

const env = { NODE_ENV: 'production', RATE_LIMIT_SECRET: 'a'.repeat(64), VERCEL: '1' };
const counts = new Map(), calls = [];
let serviceError = false;
function load(file, mocks = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, URL, Buffer, process: { env }, require: name => {
    if (name === 'server-only') return {};
    if (name === 'node:crypto') return crypto;
    if (name === 'node:net') return net;
    if (name in mocks) return mocks[name];
    throw new Error('Unknown dependency: ' + name);
  } });
  return exports;
}
const input = load('api-input.ts');
const address = load('request-address.ts');
const { rateLimit, rateLimitSubject } = load('rate-limit.ts', {
  './api-input': input, './request-address': address,
  './supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => {
    assert.equal(name, 'consume_rate_limit'); calls.push(args);
    if (serviceError) return { data: null, error: {} };
    const count = (counts.get(args.bucket_key) || 0) + 1;
    counts.set(args.bucket_key, count);
    return { data: count <= args.allowed, error: null };
  } }) },
});
const request = (ip, extra = {}) => new Request('https://og.test/api', { headers: { ...(ip ? { 'x-vercel-forwarded-for': ip } : {}), ...extra } });
assert.equal(address.trustedClientAddress(request('::ffff:192.0.2.1')), '192.0.2.1');
assert.equal(address.trustedClientAddress(request('2001:0db8:0:0:0:0:0:1')), '2001:db8::1');
for (const bad of ['spoofed', '192.0.2.1, 192.0.2.2']) assert.equal(address.trustedClientAddress(request(bad)), null);
await assert.rejects(rateLimit(request(null, { 'x-forwarded-for': '192.0.2.1' }), 'spoof', 1), error => error.status === 503);
await rateLimit(request('192.0.2.1'), 'guest', 1, 300);
await assert.rejects(rateLimit(request('192.0.2.1'), 'guest', 1, 300), error => error.status === 429 && error.headers['Retry-After'] === '300');
await rateLimit(request('192.0.2.2'), 'guest', 1, 300);
await rateLimit(request('192.0.2.1'), 'account', 1, 60, 'player-1');
await assert.rejects(rateLimit(request('192.0.2.2'), 'account', 1, 60, 'player-1'), error => error.status === 429);
for (let i = 0; i < 20; i++) await rateLimit(request('192.0.2.1'), 'multi-account', 1, 60, 'account-' + i);
await assert.rejects(rateLimit(request('192.0.2.1'), 'multi-account', 1, 60, 'new-account'), error => error.status === 429);
await rateLimitSubject('phone', '+923001234567', 1, 3600);
await assert.rejects(rateLimitSubject('phone', '+923001234567', 1, 3600), error => error.status === 429);
assert.ok(calls.every(call => /^[a-f0-9]{64}$/.test(call.bucket_key)), 'database buckets contain keyed hashes, never raw contacts/IPs');
env.TRUSTED_CLIENT_IP_HEADER = 'x-client-ip'; delete env.VERCEL;
assert.equal(address.trustedClientAddress(request(null, { 'x-client-ip': '192.0.2.9' })), '192.0.2.9');
delete env.RATE_LIMIT_SECRET;
await assert.rejects(rateLimitSubject('missing-secret', 'subject', 1), error => error.status === 503);
env.RATE_LIMIT_SECRET = 'a'.repeat(64); serviceError = true;
await assert.rejects(rateLimitSubject('service-down', 'subject', 1), error => error.status === 503);
input.rejectBotField({}); input.rejectBotField({ company_website: '' }); input.rejectBotField({ company_website: null });
for (const value of ['https://spam.test', [], {}, true]) assert.throws(() => input.rejectBotField({ company_website: value }));

const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'), 'signature'].join('.');
assert.ok(inspectText(token).includes('Supabase service-role JWT'));
assert.ok(inspectText('sb_' + 'secret_' + 'x'.repeat(40)).includes('Supabase secret key'));
assert.ok(inspectText('const privateValue = ' + 'known-sensitive-value', ['known-sensitive-value']).length);
for (const path of ['id_rsa', '.ssh/id_ed25519', 'deploy/id_ecdsa']) assert.equal(forbiddenTrackedPath(path), true);
assert.equal(forbiddenTrackedPath('deploy/id_ed25519.pub'), false);
assert.deepEqual(inspectText('process.env.SUPABASE_SERVICE_ROLE_KEY'), []);
assert.ok(inspectEnvironment({ NEXT_PUBLIC_SERVICE_ROLE_KEY: 'x'.repeat(40) }).length);
assert.ok(inspectEnvironment({ NEXT_PUBLIC_SUPABASE_ANON_KEY: token }).length);
assert.deepEqual(inspectEnvironment({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }), []);
assert.ok(inspectEnvironment({}, true).length >= 4);
for (const path of ['.env.local', 'public/.env.production', 'db.dump', 'backups/copy.sql', 'private.ogbackup']) assert.equal(forbiddenTrackedPath(path), true);
for (const path of ['.env.example', 'supabase/migrations/initial.sql', 'docs/DEPLOYMENT.md']) assert.equal(forbiddenTrackedPath(path), false);
console.log('Security controls passed: layered limits, spoofed IPs, private bucket keys, service failures, bot traps and secret exposure checks.');
