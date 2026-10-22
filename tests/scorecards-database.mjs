import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function testScorecards(db,buildBracket) {
  assert.equal((await db.query("SELECT has_table_privilege('anon','public.match_scorecards','SELECT') AS allowed")).rows[0].allowed,false);
  assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.save_match_scorecard(uuid,integer,text,integer,integer,uuid)','EXECUTE') AS allowed")).rows[0].allowed,false);
  await db.exec('BEGIN');
  try {
    const admin=randomUUID(),member=randomUUID(),event=randomUUID();
    for(const id of [admin,member]) await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,id+'@test.invalid',{}]);
    await db.query("UPDATE public.profiles SET role='admin' WHERE id=$1",[admin]);
    await db.query("INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,bracket_type,max_teams) VALUES($1,'Scorecards',$2,now()+interval '2 days',now()+interval '1 day','upcoming','double',2)",[event,event]);
    const teams=[randomUUID(),randomUUID()];
    for(const id of teams) await db.query("INSERT INTO public.registrations(id,tournament_id,team_name,roster_details,status,checked_in) VALUES($1,$2,$3,'[{},{},{},{},{}]','approved',true)",[id,event,id]);
    await db.exec('SET LOCAL ROLE service_role');
    await db.query('SELECT public.create_competition_bracket($1,$2)',[event,JSON.stringify(buildBracket(teams,'double'))]);
    const match=(await db.query("SELECT id FROM public.tournament_matches WHERE tournament_id=$1 AND bracket='winners'",[event])).rows[0].id;
    const path=()=>`${event}/${match}/${randomUUID()}.png`;
    const save=(map,file,a=2,b=1,actor=admin)=>db.query('SELECT public.save_match_scorecard($1,$2,$3,$4,$5,$6) AS previous',[match,map,file,a,b,actor]);
    async function reject(run,pattern){await db.exec('SAVEPOINT bad_scorecard');try{await assert.rejects(run(),pattern);}finally{await db.exec('ROLLBACK TO SAVEPOINT bad_scorecard; RELEASE SAVEPOINT bad_scorecard');}}
    await reject(()=>save(1,path()),/result changed/);
    await db.query('SELECT public.record_competition_result($1,2,1)',[match]);
    await reject(()=>save(1,path(),2,1,member),/Administrator/);
    await reject(()=>save(1,`${randomUUID()}/${match}/${randomUUID()}.png`),/Invalid scorecard/);
    await reject(()=>save(6,path()),/screenshot position/);
    const old=path();await save(1,old);await save(2,path());await save(3,path());await save(4,path());await save(5,path());
    assert.equal((await save(1,path())).rows[0].previous,old);
    assert.ok((await save(2,null)).rows[0].previous);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.match_scorecards WHERE match_id=$1',[match])).rows[0].n,4);
    await db.query('SELECT public.record_competition_result($1,2,0)',[match]);
    await reject(()=>save(1,path()),/result changed/);
    await reject(()=>save(6,path(),2,0),/screenshot position/);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.match_scorecards s JOIN public.tournament_matches m ON m.id=s.match_id WHERE m.id=$1 AND s.score_a=m.score_a AND s.score_b=m.score_b',[match])).rows[0].n,0,'Old screenshots must not match a corrected result');
    await save(1,path(),2,0);
    await save(5,path(),2,0);
    await db.query('SELECT public.clear_competition_result($1)',[match]);
    await reject(()=>save(1,path(),2,0),/result changed/);
  } finally { await db.exec('ROLLBACK'); }
  console.log('Scorecards passed in Postgres: private metadata, admin uploads, five-image limits, replacement, removal and stale-result rejection.');
}
