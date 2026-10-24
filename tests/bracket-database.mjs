import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testBrackets(db,buildBracket){
 const permissions=(await db.query("SELECT has_function_privilege('anon','public.clear_competition_result(uuid)','EXECUTE') AS anon, has_function_privilege('authenticated','public.clear_competition_result(uuid)','EXECUTE') AS member, has_function_privilege('service_role','public.clear_competition_result(uuid)','EXECUTE') AS server")).rows[0];
 assert.deepEqual(permissions,{anon:false,member:false,server:true});
 for(const size of [2,3,5,8,16,20,128])for(const kind of ['single','double'])for(const reset of (kind==='double'?[false,true]:[false])){
  await db.exec('BEGIN');
  try{
   const event=randomUUID();
   await db.query("INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,bracket_type,max_teams) VALUES($1,'Graph test',$3,now()+interval '2 days',now()+interval '1 day','upcoming',$2,128)",[event,kind,event]);
   const entrants=[];
   for(let i=0;i<size;i++){
    const captain=randomUUID(),entry=randomUUID();entrants.push(entry);
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[captain,captain+'@test.invalid',{}]);
    await db.query("INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details,status,checked_in) VALUES($1,$2,$3,$4,'[{},{},{},{},{}]','approved',false)",[entry,event,captain,'Team '+i]);
   }
   await db.exec('SET LOCAL ROLE service_role');
   await db.query('SELECT public.create_competition_bracket($1,$2)',[event,JSON.stringify(buildBracket(entrants,kind))]);
   const losses=new Map(entrants.map(id=>[id,0]));let played=0;
   for(;;){
    const {rows}=await db.query("SELECT * FROM public.tournament_matches WHERE tournament_id=$1 AND status='pending' AND team_a IS NOT NULL AND team_b IS NOT NULL ORDER BY CASE bracket WHEN 'winners' THEN 0 WHEN 'losers' THEN 1 WHEN 'final' THEN 2 ELSE 3 END,round,position LIMIT 1",[event]);
    if(!rows.length)break;
    const game=rows[0];assert.notEqual(game.team_a,game.team_b,'A team cannot play itself');
    const bWins=game.bracket==='final'&&reset;
    const snapshot=(await db.query('SELECT * FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY id',[event])).rows;
    await db.query('SELECT public.record_competition_result($1,$2,$3)',[game.id,bWins?1:2,bWins?2:1]);
    if([2,5,20].includes(size)){
     await db.query('SELECT public.clear_competition_result($1)',[game.id]);
     assert.deepEqual((await db.query('SELECT * FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY id',[event])).rows,snapshot,'Clearing must restore the exact graph, including automatic byes, finalists and reset');
     assert.equal((await db.query('SELECT status FROM public.tournaments WHERE id=$1',[event])).rows[0].status,'ongoing');
     await db.query('SELECT public.record_competition_result($1,$2,$3)',[game.id,bWins?1:2,bWins?2:1]);
    }
    const loser=bWins?game.team_a:game.team_b;losses.set(loser,losses.get(loser)+1);played++;
    assert.ok(played<=2*size,'Progression must finish');
   }
   const champion=(await db.query("SELECT winner_id FROM public.tournament_matches WHERE tournament_id=$1 ORDER BY CASE bracket WHEN 'reset' THEN 0 WHEN 'final' THEN 1 ELSE 2 END,round DESC LIMIT 1",[event])).rows[0].winner_id;
   assert.ok(champion);
   assert.equal((await db.query('SELECT status FROM public.tournaments WHERE id=$1',[event])).rows[0].status,'completed');
   for(const [id,count]of losses)if(id!==champion)assert.equal(count,kind==='double'?2:1,kind+' entrants must lose the correct number of times');
   if(kind==='double')assert.equal((await db.query("SELECT status FROM public.tournament_matches WHERE tournament_id=$1 AND bracket='reset'",[event])).rows[0].status,reset?'completed':'bye');
   assert.equal(played,kind==='single'?size-1:2*size-2+(reset?1:0));
   if(size>2 || kind==='double'){
    const first=(await db.query("SELECT id FROM public.tournament_matches WHERE tournament_id=$1 AND bracket='winners' AND round=1 AND status='completed' LIMIT 1",[event])).rows[0];
    await db.exec('SAVEPOINT clear_locked');
    await assert.rejects(db.query('SELECT public.clear_competition_result($1)',[first.id]),/later match has finished/);
    await db.exec('ROLLBACK TO SAVEPOINT clear_locked; RELEASE SAVEPOINT clear_locked');
   }
  }finally{await db.exec('ROLLBACK');}
 }
 console.log('Actual SQL bracket progression passed for 2, 3, 5, 8, 16, 20 and 128 entrants: single, double, byes and reset finals.');
}
