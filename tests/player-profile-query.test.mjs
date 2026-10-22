import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

async function compile(source) {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const input = await compile(readFileSync(new URL('../src/lib/api-input.ts', import.meta.url), 'utf8'));
const accountId = '11111111-1111-4111-8111-111111111111';
const faceitId = '22222222-2222-4222-8222-222222222222';
const profile = { id: accountId, faceit_id: faceitId, faceit_nickname: 'VerifiedPlayer', role: 'player', faceit_level: 8, faceit_elo: 1800 };
const stats = { faceit_id: faceitId, nickname: 'VerifiedPlayer', level: 8, elo: 1800, matches: 100, wins: 60, win_rate: 60, kd_ratio: 1.2, headshot_rate: 50 };
const filters = [];
// Exercise the real Supabase query encoder, mocking only the HTTP boundary.
const db = createClient('https://database.test', 'test-only', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async request => {
    const url = new URL(typeof request === 'string' ? request : request.url);
    const table = url.pathname.split('/').at(-1);
    if (table === 'profiles') {
      const found = url.searchParams.get('id') === 'eq.' + accountId || url.searchParams.get('faceit_id') === 'eq.' + faceitId;
      return Response.json(found ? [profile] : []);
    }
    if (table === 'faceit_leaderboard') return Response.json(url.searchParams.get('faceit_id') === 'eq.' + faceitId ? [stats] : []);
    const column = table === 'match_history' ? 'roster' : 'roster_details';
    const expected = table === 'match_history' ? [{ id: accountId }] : [{ faceit_id: faceitId }];
    const filter = url.searchParams.get(column);
    filters.push({ table, filter });
    if (filter !== 'cs.' + JSON.stringify(expected)) return Response.json({ code: '22P02', message: 'invalid input syntax for type json' }, { status: 400 });
    return Response.json([]);
  } },
});
globalThis.playerQueryTest = { ...input, db, apiError: error => Response.json({ error: error.message }, { status: error.status || 503 }) };
try {
  const source = readFileSync(new URL('../src/app/api/players/route.ts', import.meta.url), 'utf8')
    .replace("import { connection } from 'next/server';", 'const connection=async()=>{};')
    .replace("import {apiError,ApiError,integer,uuidField} from '@/lib/api';", 'const {apiError,ApiError,integer,uuidField}=globalThis.playerQueryTest;')
    .replace("import {createClient} from '@/lib/supabase/server';", 'const createClient=async()=>globalThis.playerQueryTest.db;')
    .replace("import {refreshLeaderboardPlayer} from '@/lib/leaderboard';", 'const refreshLeaderboardPlayer=async()=>{};');
  const { GET } = await compile(source);
  for (const id of [accountId, faceitId]) {
    const response = await GET(new Request('https://og.test/api/players?player_id=' + id));
    assert.equal(response.status, 200, 'both account and FACEIT links must load without invalid JSON filters');
    const data = await response.json();
    assert.equal(data.player.faceit_nickname, 'VerifiedPlayer');
    assert.equal(data.stats.matches, 100);
    assert.deepEqual(data.history, []);
    assert.deepEqual(data.tournaments, []);
    assert.equal('role' in data.player, false);
  }
  assert.equal(filters.length, 4, 'both JSONB filters must run for each link');
  assert.equal((await GET(new Request('https://og.test/api/players?player_id=invalid'))).status, 400);
} finally { delete globalThis.playerQueryTest; }
console.log('Player profile regression passed using the real query encoder: local/FACEIT links, JSONB history filters, statistics and invalid IDs.');
