-- Run against the configured Supabase project. All test records roll back.
BEGIN;
DO $$
DECLARE
  captain uuid := gen_random_uuid();
  player uuid := gen_random_uuid();
  match_id uuid := gen_random_uuid();
  tournament_id uuid := gen_random_uuid();
  registration_id uuid := gen_random_uuid();
  denied boolean;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data)
  VALUES (captain, 'authenticated', 'authenticated', captain::text || '@test.invalid', '{"nickname":"Test captain"}'),
         (player, 'authenticated', 'authenticated', player::text || '@test.invalid', '{"nickname":"Test player"}');
  IF (SELECT count(*) FROM public.profiles WHERE id IN (captain, player)) <> 2 THEN RAISE EXCEPTION 'Profile trigger failed'; END IF;
  UPDATE public.profiles SET role = 'admin' WHERE id = captain;
  PERFORM set_config('request.jwt.claim.sub', captain::text, true);
  SET LOCAL ROLE authenticated;
  RESET ROLE;
  INSERT INTO public.match_requests (id, creator_id, title, target_players_count, scheduled_time) VALUES (match_id, captain, 'Rollback match test', 2, now() + interval '1 day');
  SET LOCAL ROLE authenticated;
  INSERT INTO public.tournaments (id, title, slug, start_date, registration_deadline, status)
  VALUES (tournament_id, 'Rollback tournament test', tournament_id::text, now() + interval '2 days', now() + interval '1 day', 'draft');
  UPDATE public.tournaments SET status = 'upcoming' WHERE id = tournament_id;
  UPDATE public.tournaments SET status = 'draft' WHERE id = tournament_id;
  PERFORM set_config('request.jwt.claim.sub', player::text, true);
  IF EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id) THEN RAISE EXCEPTION 'Draft leaked to player'; END IF;
  PERFORM public.join_arena_match(match_id);
  IF NOT EXISTS (SELECT 1 FROM public.match_requests WHERE id = match_id AND status = 'matched' AND current_players_count = 2 AND jsonb_array_length(roster) = 2) THEN RAISE EXCEPTION 'Join did not fill match'; END IF;
  denied := false;
  BEGIN PERFORM public.join_arena_match(match_id); EXCEPTION WHEN raise_exception THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Full match accepted another join'; END IF;
  denied := false;
  BEGIN UPDATE public.profiles SET role = 'admin' WHERE id = player; EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Player could edit roles'; END IF;
  denied := false;
  BEGIN PERFORM public.review_arena_registration(registration_id, 'approved'); EXCEPTION WHEN raise_exception THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Player could review registrations'; END IF;
  RESET ROLE;
  UPDATE public.tournaments SET status = 'upcoming' WHERE id = tournament_id;
  INSERT INTO public.registrations (id, tournament_id, captain_id, team_name, roster_details)
  VALUES (registration_id, tournament_id, player, 'Rollback team', '[{},{},{},{},{}]');
  PERFORM set_config('request.jwt.claim.sub', captain::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.review_arena_registration(registration_id, 'approved');
  PERFORM public.toggle_arena_checkin(registration_id);
  IF NOT EXISTS (SELECT 1 FROM public.registrations WHERE id = registration_id AND status = 'approved' AND checked_in) THEN RAISE EXCEPTION 'Admin approval/check-in failed'; END IF;
  PERFORM public.review_arena_registration(registration_id, 'rejected');
  IF EXISTS (SELECT 1 FROM public.registrations WHERE id = registration_id AND checked_in) THEN RAISE EXCEPTION 'Rejected team retained check-in'; END IF;
  RESET ROLE;
END $$;
ROLLBACK;
