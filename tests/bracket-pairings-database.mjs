import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testPairingManagement(db, buildBracket) {
  const permission = await db.query("SELECT has_function_privilege('anon','public.set_competition_pairings(uuid,jsonb)','EXECUTE') AS anon, has_function_privilege('authenticated','public.set_competition_pairings(uuid,jsonb)','EXECUTE') AS member, has_function_privilege('service_role','public.set_competition_pairings(uuid,jsonb)','EXECUTE') AS server");
  assert.deepEqual(permission.rows[0], { anon: false, member: false, server: true });
  for (const type of ['single', 'double']) {
    await db.exec('BEGIN');
    try {
      const event = randomUUID(), ids = [];
      await db.query("INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,bracket_type,max_teams) VALUES($1,'Pairing test',$3,now()+interval '2 days',now()+interval '1 day','upcoming',$2,8)", [event, type, event]);
      for (let index = 0; index < 5; index++) {
        const user = randomUUID(), team = randomUUID(); ids.push(team);
        await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)', [user, user + '@test.invalid', {}]);
        await db.query("INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details,status,checked_in) VALUES($1,$2,$3,$4,'[{},{},{},{},{}]','approved',true)", [team, event, user, 'Pairing team ' + index]);
      }
      await db.exec('SET LOCAL ROLE service_role');
      await db.query('SELECT public.create_competition_bracket($1,$2)', [event, JSON.stringify(buildBracket(ids, type))]);
      const original = (await db.query('SELECT id,node_key,source_a,source_b FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY node_key', [event])).rows;
      const pairs = [{ team_a: ids[0], team_b: ids[1] }, { team_a: ids[2], team_b: ids[3] }, { team_a: ids[4], team_b: null }];
      await db.query('SELECT public.set_competition_pairings($1,$2)', [event, JSON.stringify(pairs)]);
      const opening = (await db.query("SELECT team_a,team_b,status,winner_id FROM public.tournament_matches WHERE tournament_id=$1 AND bracket='winners' AND round=1 ORDER BY position", [event])).rows;
      assert.deepEqual(opening.map(({ team_a, team_b }) => ({ team_a, team_b })), pairs);
      assert.equal(opening[0].status, 'pending');
      assert.equal(opening[2].status, 'bye');
      assert.equal(opening[2].winner_id, ids[4]);
      assert.deepEqual((await db.query('SELECT id,node_key,source_a,source_b FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY node_key', [event])).rows, original, 'editing pairings preserves every match ID and source link');
      async function reject(value, pattern) {
        const before = (await db.query('SELECT * FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY id', [event])).rows;
        await db.exec('SAVEPOINT rejected_pairings');
        try {
          await assert.rejects(db.query('SELECT public.set_competition_pairings($1,$2)', [event, JSON.stringify(value)]), pattern);
        } finally { await db.exec('ROLLBACK TO SAVEPOINT rejected_pairings; RELEASE SAVEPOINT rejected_pairings'); }
        assert.deepEqual((await db.query('SELECT * FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY id', [event])).rows, before, 'rejected changes must preserve all bracket data');
      }
      await reject([{ team_a: ids[0], team_b: ids[0] }, ...pairs.slice(1)], /exactly once/);
      await reject([{ team_a: randomUUID(), team_b: ids[1] }, ...pairs.slice(1)], /exactly once/);
      await reject(pairs.slice(1), /number of opening/);
      await reject([{ team_a: null, team_b: null }, ...pairs.slice(1)], /at least one team/);
      await db.query('UPDATE public.registrations SET no_show=true WHERE id=$1', [ids[4]]);
      await reject(pairs, /no longer eligible/);
      await db.query('UPDATE public.registrations SET no_show=false WHERE id=$1', [ids[4]]);
      const ready = (await db.query("SELECT id FROM public.tournament_matches WHERE tournament_id=$1 AND status='pending' AND team_a IS NOT NULL AND team_b IS NOT NULL ORDER BY round,position LIMIT 1", [event])).rows[0];
      await db.query('SELECT public.record_competition_result($1,13,7)', [ready.id]);
      await reject(pairs, /scores have already been recorded/);
    } finally { await db.exec('ROLLBACK'); }
  }
  console.log('Admin bracket pairings passed in Postgres: permissions, custom opponents, recalculated byes, graph preservation, duplicate/foreign/ineligible rejection and score locks.');
}
