BEGIN;
DO $$
DECLARE
 staff uuid:=gen_random_uuid(); captain uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
 event uuid:=gen_random_uuid(); first_entry jsonb; second_entry jsonb; roster jsonb; flags jsonb; denied boolean;
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); game uuid; path text;
 old_completed uuid:=gen_random_uuid(); old_retained uuid:=gen_random_uuid(); pending uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(staff,'review-staff@test.invalid','{}'),(captain,'review-captain@test.invalid','{}'),(stranger,'review-stranger@test.invalid','{}');
 UPDATE public.profiles SET role='admin' WHERE id=staff;
 INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,max_teams)
 VALUES(event,'Third review fixture',event::text,now()+interval '2 days',now()+interval '1 day','upcoming',2);
 roster:=(SELECT jsonb_agg(jsonb_build_object('nickname','Shared '||n,'game_id','game-id-'||n)) FROM generate_series(1,5)n);
 SET LOCAL ROLE service_role;
 first_entry:=public.submit_team_application(captain,event,jsonb_build_object('team_name','First','captain_name','Captain','phone','+15551119999','email','first@test.invalid','players',roster,'accepted_rules',true),repeat('a',64));
 second_entry:=public.submit_team_application(NULL,event,jsonb_build_object('team_name','Second','captain_name','Other','phone','+15551119999','email','second@test.invalid','players',roster,'accepted_rules',true),repeat('b',64));
 UPDATE public.profiles SET role='banned',faceit_nickname='Shared 1' WHERE id=captain;
 flags:=public.registration_review_flags(staff,ARRAY[(second_entry->>'id')::uuid]);
 IF flags::text NOT LIKE '%Player name%' OR flags::text NOT LIKE '%game ID%' OR flags::text NOT LIKE '%Captain contact%' OR flags::text NOT LIKE '%banned account%' THEN RAISE EXCEPTION 'Missing roster/contact review warnings'; END IF;
 IF flags::text LIKE '%15551119999%' OR flags::text LIKE '%@test.invalid%' THEN RAISE EXCEPTION 'Review signal exposed raw contacts'; END IF;
 IF jsonb_array_length(flags->(second_entry->>'id'))>10 THEN RAISE EXCEPTION 'Unbounded review warning list'; END IF;
 denied:=false;BEGIN PERFORM public.registration_review_flags(stranger,ARRAY[(second_entry->>'id')::uuid]);EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied OR has_function_privilege('authenticated','public.registration_review_flags(uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'Review warnings not admin-only'; END IF;
 RESET ROLE;
 INSERT INTO public.registrations(id,tournament_id,team_name,roster_details,status) VALUES(a,event,'A','[{},{},{},{},{}]','approved'),(b,event,'B','[{},{},{},{},{}]','approved');
 SET LOCAL ROLE service_role;
 PERFORM public.create_competition_bracket(event,jsonb_build_array(jsonb_build_object('bracket','winners','key','W1-1','round',1,'position',1,'team_a',a,'team_b',b,'outcome_a','winner','outcome_b','winner')));
 SELECT id INTO game FROM public.tournament_matches WHERE tournament_id=event;
 PERFORM public.record_competition_result(game,2,0);
 path:=event::text||'/'||game::text||'/'||gen_random_uuid()::text||'.png';
 PERFORM public.save_match_scorecard(game,1,path,2,0,staff);
 PERFORM public.record_competition_result(game,2,1);
 IF EXISTS(SELECT 1 FROM public.match_scorecards WHERE match_id=game) OR NOT EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE object_path=path AND status='pending') THEN RAISE EXCEPTION 'Corrected result retained stale screenshot'; END IF;
 INSERT INTO public.storage_cleanup_jobs(id,bucket,object_path,status,completed_at)
 VALUES(old_completed,'match-scorecards','old-completed','completed',now()-interval '31 days'),(old_retained,'match-scorecards','old-retained','retained',now()-interval '31 days'),(pending,'match-scorecards','retry-needed','pending',now()-interval '31 days');
 PERFORM public.purge_old_operations();
 IF EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE id IN(old_completed,old_retained)) OR NOT EXISTS(SELECT 1 FROM public.storage_cleanup_jobs WHERE id=pending) THEN RAISE EXCEPTION 'Cleanup retention removed pending work or retained old completions'; END IF;
 RESET ROLE;
END $$;
ROLLBACK;
