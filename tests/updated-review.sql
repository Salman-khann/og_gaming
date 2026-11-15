BEGIN;
DO $$
DECLARE
 actor uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); squad uuid; first_squad uuid;
 response jsonb; all_ids uuid[]:='{}'; item jsonb; page_no integer:=1; i integer;
 event uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); game uuid;
 active_path text; replacement_path text; old_job uuid; claim uuid:=gen_random_uuid(); newer_claim uuid:=gen_random_uuid(); denied boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(actor,'review-actor@test.invalid','{}'),(other_id,'review-other@test.invalid','{}');
 UPDATE public.profiles SET faceit_id='review-faceit',role='admin' WHERE id=actor;
 -- Legacy/imported rosters exceeding the old global 500-row read must still page completely.
 FOR i IN 1..103 LOOP
  INSERT INTO public.teams(name,captain_id) VALUES('Review team '||i,actor) RETURNING id INTO squad;
  IF i=1 THEN first_squad:=squad; END IF;
  INSERT INTO public.team_members(team_id,faceit_id,nickname,status)
   SELECT squad,'member-'||i||'-'||n,'Member '||n,'invited' FROM generate_series(1,5)n;
 END LOOP;
 INSERT INTO public.teams(name,captain_id) VALUES('Inviting team',other_id) RETURNING id INTO squad;
 INSERT INTO public.team_members(team_id,faceit_id,nickname) VALUES(squad,'review-faceit','Invitation');
 INSERT INTO public.teams(name,captain_id) VALUES('Accepted team',other_id) RETURNING id INTO squad;
 INSERT INTO public.team_members(team_id,user_id,faceit_id,nickname,status) VALUES(squad,actor,'review-faceit','Accepted','accepted');
 INSERT INTO public.teams(name,captain_id) VALUES('Unrelated team',other_id);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 LOOP
  response:=public.read_my_teams(page_no,25);
  IF (response->>'total')::integer<>105 OR jsonb_array_length(response->'teams')>25 THEN RAISE EXCEPTION 'Team paging/count failed'; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(response->'teams') LOOP all_ids:=array_append(all_ids,(item->>'id')::uuid); END LOOP;
  IF page_no=1 AND jsonb_array_length(response->'members')<>125 THEN RAISE EXCEPTION 'Page roster is incomplete'; END IF;
  EXIT WHEN NOT (response->>'has_more')::boolean;
  page_no:=page_no+1;
 END LOOP;
 IF cardinality(all_ids)<>105 OR (SELECT count(DISTINCT id) FROM unnest(all_ids)id)<>105 THEN RAISE EXCEPTION 'Team pagination skipped/duplicated teams'; END IF;
 RESET ROLE;
 IF has_function_privilege('anon','public.read_my_teams(integer,integer)','EXECUTE') OR has_table_privilege('authenticated','public.storage_cleanup_jobs','SELECT') THEN RAISE EXCEPTION 'Private RPC/queue exposed'; END IF;

 INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,max_teams)
 VALUES(event,'Cleanup fixture',event::text,now()+interval '2 days',now()+interval '1 day','upcoming',2);
 INSERT INTO public.registrations(id,tournament_id,team_name,roster_details,status)
 VALUES(a,event,'A','[{},{},{},{},{}]','approved'),(b,event,'B','[{},{},{},{},{}]','approved');
 INSERT INTO public.tournament_matches(tournament_id,bracket,round,position,team_a,team_b,status,score_a,score_b,winner_id,node_key)
 VALUES(event,'winners',1,1,a,b,'completed',2,0,a,'W1-1') RETURNING id INTO game;
 active_path:=event::text||'/'||game::text||'/'||gen_random_uuid()::text||'.png';
 replacement_path:=event::text||'/'||game::text||'/'||gen_random_uuid()::text||'.png';
 SET LOCAL ROLE service_role;
 PERFORM public.queue_scorecard_cleanup(active_path,0);
 PERFORM public.save_match_scorecard(game,1,active_path,2,0,actor);
 IF EXISTS(SELECT 1 FROM public.claim_scorecard_cleanup(20,claim)) THEN RAISE EXCEPTION 'Worker claimed a referenced object'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE object_path=active_path AND status='retained') THEN RAISE EXCEPTION 'Referenced job not retained'; END IF;
 PERFORM public.save_match_scorecard(game,1,replacement_path,2,0,actor);
 SELECT id INTO old_job FROM public.claim_scorecard_cleanup(20,claim) WHERE object_path=active_path;
 IF old_job IS NULL THEN RAISE EXCEPTION 'Replacement lost the old path'; END IF;
 IF EXISTS(SELECT 1 FROM public.claim_scorecard_cleanup(20,newer_claim)) THEN RAISE EXCEPTION 'Leased job claimed twice'; END IF;
 denied:=false;
 BEGIN PERFORM public.save_match_scorecard(game,1,active_path,2,0,actor);
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM LIKE '%expired%'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Reference raced deletion lease'; END IF;
 PERFORM public.finish_scorecard_cleanup(old_job,claim,false);
 IF EXISTS(SELECT 1 FROM public.claim_scorecard_cleanup(20,newer_claim)) THEN RAISE EXCEPTION 'Retry backoff ignored'; END IF;
 UPDATE public.storage_cleanup_jobs SET next_attempt_at=now()-interval '1 second' WHERE id=old_job;
 PERFORM public.claim_scorecard_cleanup(20,newer_claim);
 PERFORM public.finish_scorecard_cleanup(old_job,claim,true);
 IF NOT EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE id=old_job AND status='processing') THEN RAISE EXCEPTION 'Stale worker acknowledged new lease'; END IF;
 PERFORM public.finish_scorecard_cleanup(old_job,newer_claim,true);
 IF NOT EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE id=old_job AND status='completed' AND attempt_count=2) THEN RAISE EXCEPTION 'Retry completion failed'; END IF;
 PERFORM public.admin_delete_tournament(actor,event,'Cleanup fixture');
 IF NOT EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE object_path=replacement_path AND status='pending') THEN RAISE EXCEPTION 'Tournament deletion lost cleanup path'; END IF;
 IF EXISTS(SELECT 1 FROM public.tournaments WHERE id=event) THEN RAISE EXCEPTION 'Fixture tournament survived deletion'; END IF;
 RESET ROLE;
END $$;
ROLLBACK;
