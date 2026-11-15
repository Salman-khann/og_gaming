BEGIN;
DO $$
DECLARE admin_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid(); event_id uuid:=gen_random_uuid(); entry_id uuid:=gen_random_uuid(); replacement uuid:=gen_random_uuid(); denied boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(admin_id,'cancel-admin@test.invalid','{}'),(player_id,'cancel-player@test.invalid','{}');
 UPDATE public.profiles SET role='admin' WHERE id=admin_id;
 INSERT INTO public.tournaments(id,title,slug,game,format,min_level,max_level,max_teams,start_date,registration_deadline,status)
 VALUES(event_id,'Cancellation fixture','cancel-fixture','CS2','5v5',1,10,16,now()+interval '20 days',now()+interval '10 days','upcoming');
 INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details) VALUES(entry_id,event_id,player_id,'Cancel team','[{},{},{},{},{}]');
 IF has_function_privilege('authenticated','public.cancel_team_registration(uuid,uuid)','execute') OR has_function_privilege('anon','public.cancel_team_registration(uuid,uuid)','execute') THEN RAISE EXCEPTION 'Cancellation exposed to browser roles'; END IF;
 denied:=false; BEGIN PERFORM public.cancel_team_registration(player_id,entry_id); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Non-admin cancellation allowed'; END IF;
 PERFORM public.cancel_team_registration(admin_id,entry_id);
 IF NOT EXISTS(SELECT 1 FROM public.registrations WHERE id=entry_id AND status='rejected' AND cancelled_at IS NOT NULL AND captain_id=player_id) THEN RAISE EXCEPTION 'Cancellation state or retention incorrect'; END IF;
 PERFORM public.cancel_team_registration(admin_id,entry_id);
 denied:=false; BEGIN UPDATE public.registrations SET status='approved' WHERE id=entry_id; EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Cancelled entry re-approved'; END IF;
 INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details) VALUES(replacement,event_id,player_id,'Replacement team','[{},{},{},{},{}]');
 INSERT INTO public.tournament_matches(tournament_id,bracket,node_key,round,position,team_a,status) VALUES(event_id,'winners','test-node',1,1,replacement,'pending');
 denied:=false; BEGIN PERFORM public.cancel_team_registration(admin_id,replacement); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied OR (SELECT cancelled_at IS NOT NULL FROM public.registrations WHERE id=replacement) THEN RAISE EXCEPTION 'Started bracket was changed'; END IF;
END $$;
ROLLBACK;
