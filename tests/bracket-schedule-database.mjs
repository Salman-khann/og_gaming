import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testScheduleSettings(db, buildBracket) {
  await db.exec('BEGIN');
  try {
    const event = randomUUID(), otherEvent = randomUUID(), admin = randomUUID(), player = randomUUID(), teams = [randomUUID(), randomUUID()];
    for (const id of [admin, player]) await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,'{}')", [id, id + '@test.invalid']);
    await db.query("UPDATE public.profiles SET role='admin' WHERE id=$1", [admin]);
    for (const id of [event, otherEvent]) await db.query("INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status) VALUES($1,'Schedule test',$2,now()+interval '2 days',now()+interval '1 day','upcoming')", [id, id]);
    const config = { start_date: '2026-11-16', days: [0, 1, 2, 3, 4, 5, 6] };
    for (const value of [{}, { ...config, days: [] }, { ...config, days: [1, 1] }, { ...config, days: [1.5] }, { ...config, days: ['1'] }, { ...config, start_date: '2026-02-30' }]) {
      assert.equal((await db.query('SELECT public.valid_bracket_schedule($1) AS valid', [JSON.stringify(value)])).rows[0].valid, false);
    }
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [player]);
    await db.exec('SET LOCAL ROLE authenticated');
    assert.equal((await db.query('UPDATE public.tournaments SET bracket_schedule=$1 WHERE id=$2 RETURNING id', [JSON.stringify(config), event])).rows.length, 0, 'Players cannot change schedules');
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [admin]);
    await db.exec('SET LOCAL ROLE authenticated');
    assert.equal((await db.query('UPDATE public.tournaments SET bracket_schedule=$1 WHERE id=$2 RETURNING id', [JSON.stringify(config), event])).rows.length, 1);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT bracket_schedule FROM public.tournaments WHERE id=$1', [otherEvent])).rows[0].bracket_schedule, null, 'Schedules stay scoped to one event');
    for (const id of teams) await db.query("INSERT INTO public.registrations(id,tournament_id,team_name,roster_details,status,checked_in,no_show) VALUES($1,$2,$3,'[{},{},{},{},{}]','approved',false,true)", [id, event, id]);
    await db.exec('SET LOCAL ROLE service_role');
    assert.equal((await db.query('SELECT public.release_tournament_no_shows() AS changed')).rows[0].changed, 0);
    await db.query('SELECT public.create_competition_bracket($1,$2)', [event, JSON.stringify(buildBracket(teams, 'single'))]);
    const match = (await db.query('SELECT id FROM public.tournament_matches WHERE tournament_id=$1', [event])).rows[0];
    await db.query('SELECT public.record_competition_result($1,2,0)', [match.id]);
    await db.exec('RESET ROLE; SET LOCAL ROLE authenticated; SAVEPOINT schedule_lock');
    await assert.rejects(db.query('UPDATE public.tournaments SET bracket_schedule=NULL WHERE id=$1', [event]), /schedule is locked/i);
    await db.exec('ROLLBACK TO SAVEPOINT schedule_lock; RESET ROLE');
    assert.deepEqual((await db.query('SELECT bracket_schedule FROM public.tournaments WHERE id=$1', [event])).rows[0].bracket_schedule, config);
    for (const role of ['anon', 'authenticated', 'service_role']) for (const rpc of ['toggle_arena_checkin', 'checkin_team_application']) {
      assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed', [role, `public.${rpc}(uuid)`])).rows[0].allowed, false);
    }
    for (const role of ['anon', 'authenticated']) assert.equal((await db.query("SELECT has_function_privilege($1,'public.reset_competition_bracket(uuid,uuid)','EXECUTE') AS allowed", [role])).rows[0].allowed, false);
    await db.exec('SET LOCAL ROLE service_role; SAVEPOINT reset_permissions');
    await assert.rejects(db.query('SELECT public.reset_competition_bracket($1,$2)', [event, player]), /Administrator/);
    await db.exec('ROLLBACK TO SAVEPOINT reset_permissions');
    const path = `${event}/${match.id}/${randomUUID()}.png`;
    await db.query('SELECT public.save_match_scorecard($1,1,$2,2,0,$3)', [match.id, path, admin]);
    assert.deepEqual((await db.query('SELECT public.reset_competition_bracket($1,$2) AS paths', [event, admin])).rows[0].paths, [path]);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.tournament_matches WHERE tournament_id=$1', [event])).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.match_scorecards WHERE match_id=$1', [match.id])).rows[0].n, 0);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.registrations WHERE tournament_id=$1', [event])).rows[0].n, 2);
    assert.deepEqual((await db.query('SELECT status,bracket_schedule FROM public.tournaments WHERE id=$1', [event])).rows[0], { status: 'upcoming', bracket_schedule: config });
    assert.equal((await db.query('SELECT bracket_schedule FROM public.tournaments WHERE id=$1', [otherEvent])).rows[0].bracket_schedule, null);
    await db.query('SELECT public.create_competition_bracket($1,$2)', [event, JSON.stringify(buildBracket(teams, 'single'))]);
  } finally { await db.exec('ROLLBACK'); }
  console.log('Schedule and reset persistence passed: permissions, per-event settings, result locks, no check-in, scorecard cleanup and fresh generation.');
}
