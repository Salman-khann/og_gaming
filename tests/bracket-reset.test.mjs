import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => name in overrides ? overrides[name] : require(name), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const input = load('src/lib/api-input.ts');
let authenticated = true, permitted = true, calls = [], limited = false;
const event = '10000000-0000-4000-8000-000000000001';
const { PATCH } = load('src/app/api/tournaments/bracket/route.ts', {
  '@/lib/supabase/server': {}, 'next/server': {},
  '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: [`${event}/match/image.png`], error: null }; }, storage: { from: () => ({ remove: async paths => { calls.push({ paths }); return { error: null }; } }) } }) },
  '@/lib/api': { ...input, requireProfile: async () => { if (!authenticated) throw new input.ApiError('Login required', 401); if (!permitted) throw new input.ApiError('Access denied', 403); return { db: {}, profile: { id: 'admin' } }; }, apiError: error => Response.json({ error: error.message }, { status: error.status || 503 }) },
  '@/lib/bracket-pairings': {}, '@/lib/bracket-series': {}, '@/lib/bracket-schedule': {}, '@/lib/notifications': {},
  '@/lib/bracket-reset-password': load('src/lib/bracket-reset-password.ts'),
  '@/lib/rate-limit': { rateLimit: async () => { if (limited) throw new input.ApiError('Too many requests', 429); } },
  '@/lib/scorecard-image': { SCORECARD_BUCKET: 'match-scorecards' },
});
const previous = process.env.BRACKET_RESET_PASSWORD;
try {
  process.env.BRACKET_RESET_PASSWORD = 'test reset secret';
  const request = (password, origin = 'https://site.test') => new Request('https://site.test/api/tournaments/bracket', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ action: 'reset_bracket', tournament_id: event, password }) });
  assert.equal((await PATCH(request('test reset secret', 'https://foreign.test'))).status, 403);
  authenticated = false; assert.equal((await PATCH(request('test reset secret'))).status, 401);
  authenticated = true; permitted = false; assert.equal((await PATCH(request('test reset secret'))).status, 403);
  permitted = true; assert.equal((await PATCH(request('wrong'))).status, 403);
  assert.equal((await PATCH(request(undefined))).status, 403);
  limited = true; assert.equal((await PATCH(request('test reset secret'))).status, 429); limited = false;
  delete process.env.BRACKET_RESET_PASSWORD;
  assert.equal((await PATCH(request('anything'))).status, 503);
  assert.equal(calls.length, 0, 'No mutation or storage access before authorization succeeds');
  process.env.BRACKET_RESET_PASSWORD = 'test reset secret';
  assert.equal((await PATCH(request('test reset secret'))).status, 200);
  assert.deepEqual(calls[0], { name: 'reset_competition_bracket', args: { event_id: event, actor_id: 'admin' } });
  assert.equal(calls.length, 2, 'Authorized reset also removes private scorecard files');
} finally { if (previous === undefined) delete process.env.BRACKET_RESET_PASSWORD; else process.env.BRACKET_RESET_PASSWORD = previous; }
console.log('Reset API passed: origin, login, admin role, rate limit, configured password and authorized cleanup.');
