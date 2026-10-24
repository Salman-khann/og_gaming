-- Isolated payment and bracket fixtures; every record rolls back.
BEGIN;
DO $$
DECLARE event uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid(); captain uuid; registration uuid; first_registration uuid; game public.tournament_matches; denied boolean; i integer;
BEGIN
  INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data) VALUES(admin_id,'authenticated','authenticated',admin_id::text||'@test.invalid','{}');
  UPDATE public.profiles SET role='admin' WHERE id=admin_id;
  PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
  INSERT INTO public.tournaments(id,title,slug,start_date,registration_deadline,status,entry_fee,max_teams)
  VALUES(event,'Rollback payment/bracket test',event::text,now()+interval '2 days',now()+interval '1 day','upcoming',1500,8);
  FOR i IN 1..5 LOOP
    captain:=gen_random_uuid(); registration:=gen_random_uuid();
    INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data) VALUES(captain,'authenticated','authenticated',captain::text||'@test.invalid','{}');
    INSERT INTO public.registrations(id,tournament_id,captain_id,team_name,roster_details,avg_faceit_level)
    VALUES(registration,event,captain,'Rollback team '||i,'[{},{},{},{},{}]',11-i);
    IF i=1 THEN first_registration:=registration; END IF;
    IF (SELECT payment_status FROM public.registrations WHERE id=registration)<>'pending' THEN RAISE EXCEPTION 'Paid entry not pending'; END IF;
    SET LOCAL ROLE authenticated;
    denied:=false;
    BEGIN PERFORM public.review_arena_registration(registration,'approved'); EXCEPTION WHEN raise_exception THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Unpaid team approved'; END IF;
    RESET ROLE;
    SET LOCAL ROLE service_role;
    PERFORM public.set_registration_payment(registration,'verified');
    RESET ROLE;
    SET LOCAL ROLE authenticated;
    PERFORM public.review_arena_registration(registration,'approved');
    RESET ROLE;
  END LOOP;
  denied:=false;
  BEGIN UPDATE public.tournaments SET entry_fee=2000 WHERE id=event; EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Entry fee changed after registration'; END IF;
  SET LOCAL ROLE anon;
  denied:=false;
  BEGIN PERFORM public.generate_tournament_bracket(event); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous bracket mutation'; END IF;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  PERFORM public.generate_tournament_bracket(event);
  IF (SELECT count(*) FROM public.tournament_matches WHERE tournament_id=event)<>7 THEN RAISE EXCEPTION 'Five teams require seven bracket slots'; END IF;
  IF (SELECT count(*) FROM public.tournament_matches WHERE tournament_id=event AND status='bye')<>3 THEN RAISE EXCEPTION 'Incorrect byes'; END IF;
  IF (SELECT status FROM public.tournaments WHERE id=event)<>'ongoing' THEN RAISE EXCEPTION 'Registration not closed'; END IF;
  denied:=false;
  BEGIN PERFORM public.generate_tournament_bracket(event); EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Duplicate bracket'; END IF;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  denied:=false;
  BEGIN PERFORM public.review_arena_registration(first_registration,'rejected'); EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Eligibility changed after generation'; END IF;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  FOR game IN SELECT * FROM public.tournament_matches WHERE tournament_id=event AND status='pending' ORDER BY round,position LOOP
    -- Later rounds are loaded again after earlier winners advance.
    SELECT * INTO game FROM public.tournament_matches WHERE id=game.id;
    IF game.team_a IS NULL OR game.team_b IS NULL THEN RAISE EXCEPTION 'Winner did not advance'; END IF;
    denied:=false;
    BEGIN PERFORM public.record_tournament_result(game.id,10,10); EXCEPTION WHEN raise_exception THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Draw accepted'; END IF;
    PERFORM public.record_tournament_result(game.id,13,7);
  END LOOP;
  IF (SELECT status FROM public.tournaments WHERE id=event)<>'completed' THEN RAISE EXCEPTION 'Tournament did not complete'; END IF;
  IF (SELECT winner_id FROM public.tournament_matches WHERE tournament_id=event AND round=3) IS NULL THEN RAISE EXCEPTION 'Missing champion'; END IF;
  SELECT * INTO game FROM public.tournament_matches WHERE tournament_id=event AND round=1 AND status='completed' LIMIT 1;
  denied:=false;
  BEGIN PERFORM public.record_tournament_result(game.id,7,13); EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Earlier result changed after next round finished'; END IF;
  RESET ROLE;
  UPDATE public.tournaments SET status='draft' WHERE id=event;
  PERFORM set_config('request.jwt.claim.sub','',true);
  SET LOCAL ROLE anon;
  IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event) THEN RAISE EXCEPTION 'Draft bracket leaked'; END IF;
  RESET ROLE;
END $$;
ROLLBACK;
