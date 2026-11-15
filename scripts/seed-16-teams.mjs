import { loadTestEnvironment, productionProjects } from './lib/test-environment.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

// Load test environment if .env.test.local exists; otherwise use current environment with safety check
if (existsSync('.env.test.local') || process.env.OG_TEST_ENV_FILE) {
  loadTestEnvironment();
} else if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

// PRODUCTION SAFETY CHECK:
// Refuse to write to production database unless explicitly overridden with --force-production
let hostname = '';
try {
  hostname = new URL(supabaseUrl).hostname;
} catch {}

if (productionProjects.has(hostname) && !process.argv.includes('--force-production')) {
  console.error(
    '\n[SAFETY BLOCKED] Refusing to seed test data into the live production database (' +
      hostname +
      ').\n' +
      'To seed locally, configure a local or test Supabase instance in .env.test.local.\n' +
      'If you intentionally want to seed into this database, pass --force-production.\n',
  );
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDouble = process.argv.includes('--double');
const bracketType = isDouble ? 'double' : 'single';
const slug =
  process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1] || 'cs2-championship-16-teams';
const title =
  process.argv.find((a) => a.startsWith('--title='))?.split('=')[1] ||
  `CS2 16-Team Championship (${bracketType === 'double' ? 'Double' : 'Single'} Elimination)`;
const description = `Tournament with 16 seeded teams competing in a 5v5 BO3 ${bracketType === 'double' ? 'Double' : 'Single'} Elimination bracket.`;

export const SEEDED_16_TEAMS = [
  { seed: 1, name: 'Phoenix Gaming' },
  { seed: 2, name: 'Nightfall Esports' },
  { seed: 3, name: 'Vanguard Elite' },
  { seed: 4, name: 'Reapers CS' },
  { seed: 5, name: 'Inferno Squad' },
  { seed: 6, name: 'Eclipse Gaming' },
  { seed: 7, name: 'Titans Esports' },
  { seed: 8, name: 'Stormbreakers' },
  { seed: 9, name: 'Shadow Wolves' },
  { seed: 10, name: 'Nova Gaming' },
  { seed: 11, name: 'Ironclad Clan' },
  { seed: 12, name: 'Vipers Crew' },
  { seed: 13, name: 'Falcons Esports' },
  { seed: 14, name: 'Crimson Fury' },
  { seed: 15, name: 'Apex Strikers' },
  { seed: 16, name: 'Renegades KHI' },
];

function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function main() {
  console.log(`Setting up 16-team seeded tournament: "${title}" [${slug}]...`);

  let event = check(
    await db
      .from('tournaments')
      .select('id,description,bracket_type')
      .eq('slug', slug)
      .maybeSingle(),
  );

  const now = Date.now();
  if (!event) {
    event = check(
      await db
        .from('tournaments')
        .insert({
          title,
          slug,
          description,
          game: 'Counter-Strike 2',
          format: `5v5 BO3 ${bracketType === 'double' ? 'Double' : 'Single'} Elimination`,
          bracket_type: bracketType,
          max_teams: 16,
          min_level: 1,
          max_level: 10,
          entry_fee: 0,
          status: 'upcoming',
          start_date: new Date(now + 86400000).toISOString(),
          registration_deadline: new Date(now + 3600000).toISOString(),
          rules:
            '16 seeded teams. 5v5 BO3. Standard competitive map pool. All registered teams must be checked in before bracket commencement.',
        })
        .select('id')
        .single(),
    );
    console.log(`Created tournament record (ID: ${event.id})`);
  } else {
    console.log(`Found existing tournament record (ID: ${event.id})`);
  }

  const existing = check(
    await db
      .from('registrations')
      .select('id,team_name,status,checked_in')
      .eq('tournament_id', event.id),
  );

  const names = SEEDED_16_TEAMS.map((t) => t.name);
  const missing = SEEDED_16_TEAMS.filter((t) => !existing.some((r) => r.team_name === t.name));

  if (missing.length) {
    check(
      await db.from('registrations').insert(
        missing.map((team, index) => ({
          id: randomUUID(),
          tournament_id: event.id,
          captain_id: null,
          team_name: team.name,
          roster_details: Array.from({ length: 5 }, (_, i) => ({
            nickname: `${team.name.split(' ')[0]}P${i + 1}`,
          })),
          status: 'approved',
          checked_in: true,
          checked_in_at: new Date().toISOString(),
          no_show: false,
          avg_faceit_level: Math.max(1, 11 - Math.ceil(team.seed / 2)),
          created_at: new Date(now + team.seed * 1000).toISOString(),
        })),
      ),
    );
    console.log(`Inserted ${missing.length} missing team registrations.`);
  }

  const entrants = check(
    await db
      .from('registrations')
      .select('id,team_name,status,checked_in,created_at')
      .eq('tournament_id', event.id)
      .order('created_at')
      .order('id'),
  );

  console.log(`Total confirmed entrants: ${entrants.length}`);

  let matches = check(
    await db
      .from('tournament_matches')
      .select('id,status,team_a,team_b')
      .eq('tournament_id', event.id),
  );

  if (!matches.length) {
    console.log('Building seeded bracket graph...');
    const compiled = ts.transpileModule(
      readFileSync(new URL('../src/lib/bracket-engine.ts', import.meta.url), 'utf8'),
      { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
    ).outputText;
    const { buildBracket } = await import(
      'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
    );

    const teamIds = entrants.map((t) => t.id);
    const graph = buildBracket(teamIds, bracketType);

    check(
      await db.rpc('create_competition_bracket', {
        event_id: event.id,
        graph,
      }),
    );

    matches = check(
      await db
        .from('tournament_matches')
        .select('id,status,team_a,team_b')
        .eq('tournament_id', event.id),
    );
    console.log(`Bracket generated with ${matches.length} matches.`);
  } else {
    console.log(`Bracket already active with ${matches.length} matches.`);
  }

  console.log(
    JSON.stringify(
      {
        tournament_id: event.id,
        slug,
        bracket_type: bracketType,
        teams: entrants.length,
        matches: matches.length,
        url: `/tournaments/${slug}/bracket`,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && process.argv[1].endsWith('seed-16-teams.mjs')) {
  main().catch((err) => {
    console.error('Error seeding tournament:', err);
    process.exit(1);
  });
}
