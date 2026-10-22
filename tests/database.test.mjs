// Real Postgres in WASM, isolated in memory. No environment keys or network.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {testBrackets} from './bracket-database.mjs';
import {testPairingManagement} from './bracket-pairings-database.mjs';
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, aud text, role text, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `);
  const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort();
  for (const name of migrations) {
    let sql = readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
    // pg_cron is a hosted extension; the cleanup query itself is tested below.
    sql = sql.replace(/^CREATE EXTENSION IF NOT EXISTS pg_cron;\r?\n/gm, '').replace(/^SELECT cron\.schedule\([^\n]+\);\r?\n?/gm, '');
    try { await db.exec(sql); } catch (error) { throw new Error('Migration failed: ' + name, { cause: error }); }
  }
  for (const fixture of ['arena-database.sql', 'guest-matches.sql', 'tournament-management.sql', 'arena-security.sql','community.sql','operations.sql','audit-regressions.sql','feature-retirement.sql','open-team-applications.sql']) {
    await db.exec(readFileSync(new URL(fixture, import.meta.url), 'utf8'));
    console.log('Database fixture passed: ' + fixture);
  }
  assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.profiles')).rows[0].count, 0, 'Fixtures must roll back');
  const engine=ts.transpileModule(readFileSync(new URL('../src/lib/bracket-engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {buildBracket}=await import('data:text/javascript;base64,'+Buffer.from(engine).toString('base64'));
  await testBrackets(db,buildBracket);
  await testPairingManagement(db,buildBracket);
  console.log('All migrations, RLS, match expiry, ownership, capacity, payment and bracket checks passed in isolated Postgres.');
} catch (error) {
  console.error(error.message, error.cause?.message || '', error.where || error.cause?.where || '');
  process.exitCode = 1;
} finally { await db.close(); }
