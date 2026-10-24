BEGIN;
DO $$
DECLARE
 event uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid();
 entry jsonb; first_id uuid; second_id uuid; roster jsonb; i integer; denied boolean; game uuid; paths jsonb;
BEGIN
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(owner_id,'private-local-part@test.invalid','{}'),(staff,'staff@test.invalid','{}');
 IF (SELECT faceit_nickname FROM public.profiles WHERE id=owner_id)='private-local-part' THEN RAISE EXCEPTION 'Email-derived nickname leaked'; END IF;
 UPDATE public.profiles SET role='admin' WHERE id=staff;
 INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,max_teams)
 VALUES(event,'Security review fixture',event::text,now()+interval '2 days',now()+interval '1 day','upcoming',2);
 roster:=(SELECT jsonb_agg(jsonb_build_object('nickname','Player '||n,'game_id','private-profile-'||n)) FROM generate_series(1,5)n);
 SET LOCAL ROLE service_role;
 FOR i IN 1..20 LOOP
  entry:=public.submit_team_application(CASE WHEN i=1 THEN owner_id ELSE NULL END,event,jsonb_build_object('team_name','Unclaimed name','captain_name','Captain','phone','+15550000001','email','captain'||i||'@test.invalid','players',roster,'accepted_rules',true),repeat('a',64));
  IF i=1 THEN first_id:=(entry->>'id')::uuid; END IF;
  IF i=2 THEN second_id:=(entry->>'id')::uuid; END IF;
 END LOOP;
 denied:=false;
 BEGIN PERFORM public.submit_team_application(NULL,event,jsonb_build_object('team_name','Overflow','captain_name','Captain','phone','+15550000002','email','overflow@test.invalid','players',roster,'accepted_rules',true),repeat('b',64));
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='Too many pending applications. Try later.'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Pending submissions are not bounded'; END IF;
 UPDATE public.registrations SET status='approved' WHERE id=first_id;
 UPDATE public.registrations SET team_name='Second team',status='approved' WHERE id=second_id;
 denied:=false;
 BEGIN PERFORM public.submit_team_application(NULL,event,jsonb_build_object('team_name','Full','captain_name','Captain','phone','+15550000003','email','full@test.invalid','players',roster,'accepted_rules',true),repeat('c',64));
 EXCEPTION WHEN raise_exception THEN denied:=SQLERRM='Tournament entries are full.'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Approved capacity is not enforced'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SET LOCAL ROLE anon;
 IF (SELECT count(*) FROM public.public_registrations WHERE tournament_id=event)<>2 THEN RAISE EXCEPTION 'Public approved entries unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.public_registrations WHERE tournament_id=event AND roster_details::text LIKE '%private-profile%') THEN RAISE EXCEPTION 'Private roster details leaked'; END IF;
 IF (SELECT registrations_count FROM public.public_tournament_counts WHERE tournament_id=event)<>2 THEN RAISE EXCEPTION 'Public capacity count incorrect'; END IF;
 IF has_column_privilege('anon','public.profiles','role','SELECT') THEN RAISE EXCEPTION 'Anonymous role enumeration allowed'; END IF;
 denied:=false; BEGIN PERFORM * FROM public.registrations; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Private registrations accessible'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 SET LOCAL ROLE authenticated;
 IF (SELECT count(*) FROM public.registrations WHERE tournament_id=event)<>1 THEN RAISE EXCEPTION 'Owner isolation failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.registrations WHERE id=first_id AND roster_details::text LIKE '%private-profile%') THEN RAISE EXCEPTION 'Owner lost private application access'; END IF;
 RESET ROLE; SET LOCAL ROLE service_role;
 INSERT INTO public.tournament_matches(tournament_id,bracket,round,position,team_a,team_b,status,score_a,score_b,winner_id,node_key)
 VALUES(event,'winners',1,1,first_id,second_id,'completed',2,0,first_id,'W1-1') RETURNING id INTO game;
 INSERT INTO public.match_scorecards(match_id,map_number,storage_path,score_a,score_b,team_a,team_b,uploaded_by)
 VALUES(game,1,event::text||'/'||game::text||'/fixture.png',2,0,first_id,second_id,staff);
 paths:=public.admin_delete_tournament(staff,event,'Security review fixture');
 IF jsonb_array_length(paths)<>1 THEN RAISE EXCEPTION 'Deletion did not return private object paths'; END IF;
 IF EXISTS(SELECT 1 FROM public.registration_public_details WHERE tournament_id=event) THEN RAISE EXCEPTION 'Public projection survived deletion'; END IF;
 RESET ROLE;
END $$;
ROLLBACK;
