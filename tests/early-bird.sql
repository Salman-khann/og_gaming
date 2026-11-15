BEGIN;
DO $$
DECLARE event uuid := gen_random_uuid(); entry jsonb; later jsonb; roster jsonb := '[]'; i integer; denied boolean := false;
BEGIN
 INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,entry_fee,early_bird_fee,early_bird_deadline)
 VALUES(event,'Early bird fixture',event::text,now()+interval '3 hours',now()+interval '2 hours','upcoming',2000,1500,now()+interval '1 hour');
 FOR i IN 1..5 LOOP roster := roster || jsonb_build_array(jsonb_build_object('nickname','Player '||i)); END LOOP;
 SET LOCAL ROLE service_role;
 entry := public.submit_team_application(NULL,event,jsonb_build_object('team_name','Early team','captain_name','Captain','phone','+923000000091','email','early@test.invalid','players',roster,'accepted_rules',true),repeat('d',64));
 IF (entry->>'amount_due')::numeric <> 1500 OR entry->>'payment_status' <> 'pending' THEN RAISE EXCEPTION 'Early price not applied'; END IF;
 UPDATE public.tournaments SET early_bird_deadline=now()-interval '1 second' WHERE id=event;
 later := public.submit_team_application(NULL,event,jsonb_build_object('team_name','Later team','captain_name','Captain','phone','+923000000092','email','later@test.invalid','players',roster,'accepted_rules',true),repeat('e',64));
 IF (later->>'amount_due')::numeric <> 2000 THEN RAISE EXCEPTION 'Expired offer still applied'; END IF;
 IF (SELECT amount_due FROM public.registrations WHERE id=(entry->>'id')::uuid) <> 1500 THEN RAISE EXCEPTION 'Existing price changed'; END IF;
 BEGIN
   UPDATE public.tournaments SET early_bird_fee=2001 WHERE id=event;
 EXCEPTION WHEN check_violation THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid discount accepted'; END IF;
 UPDATE public.tournaments SET early_bird_fee=0,early_bird_deadline=now()+interval '1 hour' WHERE id=event;
 later := public.submit_team_application(NULL,event,jsonb_build_object('team_name','Free team','captain_name','Captain','phone','+923000000093','email','free@test.invalid','players',roster,'accepted_rules',true),repeat('f',64));
 IF (later->>'amount_due')::numeric <> 0 OR later->>'payment_status' <> 'not_required' THEN RAISE EXCEPTION 'Free early entry incorrect'; END IF;
 UPDATE public.registrations SET status='approved' WHERE id=(later->>'id')::uuid;
 RESET ROLE;
END $$;
ROLLBACK;
