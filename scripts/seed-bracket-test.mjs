// Creates one labelled fixture in the configured database. Re-runs preserve scores.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';

process.loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });
const compact = process.argv.includes('--compact');
const slug = 'cs2-double-elimination-test-20-teams' + (compact ? '-compact' : '');
const description = 'TEST TOURNAMENT: 20 sample teams for testing BO3 scoring, winners and losers brackets, second-loss elimination and the reset final.';
const names = ['Phoenix','Nightfall','Vanguard','Reapers','Inferno','Eclipse','Titans','Stormbreakers','Shadow Wolves','Nova','Ironclad','Vipers','Falcons','Crimson','Apex','Renegades','Sentinels','Thunder','Ghosts','Dragons'].map(name => 'Test ' + name);
function check(result) { if (result.error) throw new Error(result.error.message); return result.data; }

let event = check(await db.from('tournaments').select('id,description,bracket_type').eq('slug',slug).maybeSingle());
if (event && (event.description !== description || event.bracket_type !== 'double')) throw new Error('The fixture slug belongs to another tournament. Nothing was changed.');
if (!event) {
  const now = Date.now();
  event = check(await db.from('tournaments').insert({
    title:compact ? 'CS2 Double Elimination — 20-Team Compact Test' : 'CS2 Double Elimination — 20-Team Test', slug, description,
    game:'Counter-Strike 2', format:'5v5 BO3 Double Elimination', bracket_type:'double',
    max_teams:20, min_level:1, max_level:10, entry_fee:0, status:'upcoming',
    start_date:new Date(now + 86400000).toISOString(),
    registration_deadline:new Date(now + 3600000).toISOString(),
    rules:'Test event with fictional teams. All matches are BO3. First loss drops a team to the losers bracket; second loss eliminates it. A reset final is played if the losers finalist wins the first grand final.',
  }).select('id').single());
}
const existing = check(await db.from('registrations').select('id,team_name,status,checked_in').eq('tournament_id',event.id));
if (existing.some(team => !names.includes(team.team_name))) throw new Error('Unexpected entries found. Nothing else was changed.');
const missing = names.filter(name => !existing.some(team => team.team_name === name));
if (missing.length) check(await db.from('registrations').insert(missing.map((team_name,index) => ({
  id:randomUUID(), tournament_id:event.id, captain_id:null, team_name,
  roster_details:Array.from({length:5},(_,i)=>({nickname:team_name.replace('Test ','') + ' Player ' + (i+1)})),
  status:'approved', checked_in:true, checked_in_at:new Date().toISOString(),
  no_show:false, avg_faceit_level:null,
  created_at:new Date(Date.now() + index).toISOString(),
}))));
const entrants = check(await db.from('registrations').select('id,team_name,status,checked_in').eq('tournament_id',event.id).order('created_at').order('id'));
if (entrants.length !== 20 || entrants.some(t=>t.status !== 'approved' || !t.checked_in)) throw new Error('The fixture requires exactly 20 approved, checked-in teams.');
let matches = check(await db.from('tournament_matches').select('id,status,team_a,team_b').eq('tournament_id',event.id));
if (!matches.length) {
  const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/bracket-engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const { buildBracket } = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  check(await db.rpc('create_competition_bracket',{event_id:event.id,graph:buildBracket(entrants.map(t=>t.id),'double')}));
  matches = check(await db.from('tournament_matches').select('id,status,team_a,team_b').eq('tournament_id',event.id));
}
console.log(JSON.stringify({tournament_id:event.id,teams:entrants.length,matches:matches.length,ready:matches.filter(m=>m.status==='pending'&&m.team_a&&m.team_b).length,url:'http://localhost:3000/tournaments/'+slug+'/bracket'}));
