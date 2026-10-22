BEGIN;
DO $$
DECLARE admin_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid(); event uuid:=gen_random_uuid(); other_event uuid:=gen_random_uuid(); entry uuid:=gen_random_uuid(); opponent uuid:=gen_random_uuid(); old_entry uuid:=gen_random_uuid(); report jsonb; denied boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(admin_id,admin_id::text||'@test.invalid','{}'),(player_id,player_id::text||'@test.invalid','{}');
 UPDATE public.profiles SET role='admin' WHERE id=admin_id;
 INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,entry_fee,max_teams)
 VALUES(event,'Delete fixture',event::text,now()+interval '2 days',now()+interval '1 day','upcoming',500,8),(other_event,'Keep fixture',other_event::text,now()+interval '2 days',now()+interval '1 day','upcoming',0,8);
 INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details) VALUES(entry,event,admin_id,'Recent verified','[{},{},{},{},{}]'),(opponent,event,player_id,'Recent pending','[{},{},{},{},{}]'),(old_entry,other_event,NULL,'Old guest','[{},{},{},{},{}]');
 UPDATE public.registrations SET created_at=now()-interval '45 days' WHERE id=old_entry;
 SET LOCAL ROLE service_role;
 PERFORM public.set_registration_payment(entry,'verified');
 UPDATE public.registrations SET status='approved',checked_in=true WHERE id=entry;
 INSERT INTO public.registration_contacts(registration_id,captain_name,email,phone,delete_token_hash) VALUES(entry,'Captain','captain@test.invalid','+923000000099',repeat('a',64));
 report:=public.admin_dashboard_report(30,NULL);
 IF (report->>'registrations')::integer<>2 OR (report->>'verified_fees')::numeric<>500 OR (report->>'unverified_fees')::numeric<>500 OR (report->>'checked_in')::integer<>1 OR (report->>'pending')::integer<>1 THEN RAISE EXCEPTION 'Period counts or fee totals are wrong: %',report; END IF;
 IF jsonb_array_length(report->'series')<>30 OR (SELECT sum((x->>'entries')::integer) FROM jsonb_array_elements(report->'series') x)<>2 THEN RAISE EXCEPTION 'Daily series is not zero-filled or disagrees with totals'; END IF;
 IF (public.admin_dashboard_report(90,other_event)->>'registrations')::integer<>1 OR (public.admin_dashboard_report(7,other_event)->>'registrations')::integer<>0 THEN RAISE EXCEPTION 'Event or date filtering failed'; END IF;
 denied:=false;BEGIN PERFORM public.admin_dashboard_report(8,NULL); EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid period accepted';END IF;
 denied:=false;BEGIN PERFORM public.admin_delete_tournament(player_id,event,'Delete fixture');EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Non-admin deletion accepted';END IF;
 denied:=false;BEGIN PERFORM public.admin_delete_tournament(admin_id,event,'Wrong title');EXCEPTION WHEN raise_exception THEN denied:=true;END;
 IF NOT denied OR NOT EXISTS(SELECT 1 FROM public.registrations WHERE id=entry) THEN RAISE EXCEPTION 'Confirmation failed to protect tournament';END IF;
 INSERT INTO public.tournament_matches(tournament_id,round,position,team_a,team_b) VALUES(event,1,1,entry,opponent);
 PERFORM public.admin_delete_tournament(admin_id,event,'Delete fixture');
 IF EXISTS(SELECT 1 FROM public.tournaments WHERE id=event) OR EXISTS(SELECT 1 FROM public.registrations WHERE tournament_id=event) OR EXISTS(SELECT 1 FROM public.registration_contacts WHERE registration_id=entry) OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event) THEN RAISE EXCEPTION 'Deletion did not remove dependants';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tournaments WHERE id=other_event) OR NOT EXISTS(SELECT 1 FROM public.registrations WHERE id=old_entry) THEN RAISE EXCEPTION 'Deletion touched another event'; END IF;
 RESET ROLE;
 IF has_function_privilege('anon','public.admin_dashboard_report(integer,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.admin_delete_tournament(uuid,uuid,text)','EXECUTE') OR has_function_privilege('authenticated','public.admin_dashboard_report(integer,uuid)','EXECUTE') OR has_function_privilege('anon','public.admin_delete_tournament(uuid,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Privileged reporting/deletion RPC is exposed';END IF;
END $$;
ROLLBACK;
