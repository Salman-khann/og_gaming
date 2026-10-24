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
let currentUser = { id: 'admin', email: 'admin@example.test' }, verifiedId = 'admin', authError = null, cleanupError = null;
const attempts = [], revoked = [];
const passwordVerifier = load('src/lib/bracket-reset-password.ts', {
  'server-only': {},
  './api-input': input,
  '@supabase/supabase-js': { createClient: (url, key, options) => {
    assert.equal(url, 'https://project.supabase.co');
    assert.equal(key, 'test-public-key');
    assert.deepEqual(options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
    return { auth: {
      signInWithPassword: async credentials => {
        attempts.push(credentials);
        return authError ? { data: {}, error: authError } : credentials.password === 'account password'
          ? { data: { user: { id: verifiedId }, session: { access_token: 'temporary' } }, error: null }
          : { data: {}, error: { status: 400 } };
      },
      signOut: async options => { revoked.push(options); return { error: cleanupError }; },
    } };
  } },
});

const event = '10000000-0000-4000-8000-000000000001';
const { PATCH } = load('src/app/api/tournaments/bracket/route.ts', {
  '@/lib/supabase/server': {}, 'next/server': {},
  '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: [`${event}/match/image.png`], error: null }; }, storage: { from: () => ({ remove: async paths => { calls.push({ paths }); return { error: null }; } }) } }) },
  '@/lib/api': { ...input, requireProfile: async () => { if (!authenticated) throw new input.ApiError('Login required', 401); if (!permitted) throw new input.ApiError('Access denied', 403); return { db: { auth: { getUser: async () => ({ data: { user: currentUser }, error: null }) } }, profile: { id: 'admin' } }; }, apiError: error => Response.json({ error: error.message }, { status: error.status || 503 }) },
  '@/lib/bracket-pairings': {}, '@/lib/bracket-series': {}, '@/lib/bracket-schedule': {}, '@/lib/notifications': {},
  '@/lib/bracket-reset-password': passwordVerifier,
  '@/lib/rate-limit': { rateLimit: async () => { if (limited) throw new input.ApiError('Too many requests', 429); } },
  '@/lib/scorecard-image': { SCORECARD_BUCKET: 'match-scorecards' },
});
const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-public-key';
  const request = (password, origin = 'https://site.test') => new Request('https://site.test/api/tournaments/bracket', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ action: 'reset_bracket', tournament_id: event, password, email: 'attacker@example.test' }) });
  assert.equal((await PATCH(request('account password', 'https://foreign.test'))).status, 403);
  authenticated = false; assert.equal((await PATCH(request('account password'))).status, 401);
  authenticated = true; permitted = false; assert.equal((await PATCH(request('account password'))).status, 403);
  permitted = true;
  limited = true; assert.equal((await PATCH(request('account password'))).status, 429); limited = false;
  assert.equal(attempts.length, 0, 'Origin, authentication, role and rate limit precede password verification');
  for (const invalid of ['wrong', undefined, null, '', 'x'.repeat(129)]) assert.equal((await PATCH(request(invalid))).status, 403);
  currentUser = null; assert.equal((await PATCH(request('account password'))).status, 401);
  currentUser = { id: 'other', email: 'other@example.test' }; assert.equal((await PATCH(request('account password'))).status, 401);
  currentUser = { id: 'admin' }; assert.equal((await PATCH(request('account password'))).status, 403);
  currentUser = { id: 'admin', email: 'admin@example.test' };
  verifiedId = 'other'; assert.equal((await PATCH(request('account password'))).status, 403); verifiedId = 'admin';
  assert.deepEqual(revoked.at(-1), { scope: 'local' }, 'Only the temporary verification session is revoked');
  authError = { status: 503 }; assert.equal((await PATCH(request('account password'))).status, 503);
  authError = { status: 429 }; assert.equal((await PATCH(request('account password'))).status, 429); authError = null;
  cleanupError = { message: 'temporary failure' }; assert.equal((await PATCH(request('account password'))).status, 503); cleanupError = null;
  assert.equal(calls.length, 0, 'No mutation or storage access before account password verification succeeds');
  assert.equal((await PATCH(request('account password'))).status, 200);
  assert.deepEqual(attempts.at(-1), { email: 'admin@example.test', password: 'account password' }, 'Verify the session email, never a submitted email');
  assert.deepEqual(calls[0], { name: 'reset_competition_bracket', args: { event_id: event, actor_id: 'admin' } });
  assert.equal(calls.length, 2, 'Authorized reset also removes private scorecard files');
} finally {
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
}
console.log('Reset API passed: origin, login, admin role, rate limit, account password, matching identity, temporary session cleanup and authorized reset.');
