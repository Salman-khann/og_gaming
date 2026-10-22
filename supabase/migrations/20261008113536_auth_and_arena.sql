-- Real accounts and concurrency-safe arena operations.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
CREATE OR REPLACE FUNCTION public.create_player_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, faceit_nickname, role)
  VALUES (NEW.id, left(coalesce(nullif(NEW.raw_user_meta_data->>'nickname', ''), nullif(NEW.raw_user_meta_data->>'preferred_username', ''), nullif(NEW.raw_user_meta_data->>'name', ''), nullif(split_part(NEW.email, '@', 1), ''), 'Player'), 40), 'player')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_player_profile();
INSERT INTO public.profiles (id, faceit_nickname)
SELECT id, left(coalesce(nullif(raw_user_meta_data->>'nickname', ''), split_part(email, '@', 1), 'Player'), 40)
FROM auth.users ON CONFLICT (id) DO NOTHING;
-- Profile roles and skill data are maintained by trusted operators only.
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
DROP POLICY IF EXISTS "Anyone can view active/upcoming tournaments" ON public.tournaments;
CREATE POLICY "Published tournaments or admin" ON public.tournaments FOR SELECT
USING (status <> 'draft' OR public.is_admin());
ALTER TABLE public.tournaments ADD CONSTRAINT valid_tournament_dates CHECK (registration_deadline <= start_date);
ALTER TABLE public.tournaments ADD CONSTRAINT valid_team_capacity CHECK (max_teams BETWEEN 2 AND 128);
CREATE UNIQUE INDEX registrations_captain_unique ON public.registrations (tournament_id, captain_id);
CREATE UNIQUE INDEX registrations_team_case_unique ON public.registrations (tournament_id, lower(team_name));
ALTER TABLE public.registrations ADD CONSTRAINT five_player_roster CHECK (jsonb_array_length(roster_details) = 5);
DROP POLICY IF EXISTS "Creators can update their match requests" ON public.match_requests;

CREATE OR REPLACE FUNCTION public.join_arena_match(match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.match_requests; p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() AND role <> 'banned';
  IF p.id IS NULL THEN RAISE EXCEPTION 'Please log in to join.'; END IF;
  SELECT * INTO m FROM public.match_requests WHERE id = match_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'open' OR jsonb_array_length(m.roster) >= m.target_players_count THEN RAISE EXCEPTION 'Match is full or closed.'; END IF;
  IF p.faceit_level < m.min_faceit_level OR p.faceit_level > m.max_faceit_level THEN RAISE EXCEPTION 'Your level does not meet this match requirement.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.roster) entry WHERE entry->>'id' = p.id::text) THEN RAISE EXCEPTION 'You are already in this match.'; END IF;
  UPDATE public.match_requests SET
    roster = m.roster || jsonb_build_array(jsonb_build_object('id', p.id, 'nickname', p.faceit_nickname, 'level', p.faceit_level, 'elo', p.faceit_elo, 'role', 'Player')),
    current_players_count = jsonb_array_length(m.roster) + 1,
    status = CASE WHEN jsonb_array_length(m.roster) + 1 >= m.target_players_count THEN 'matched' ELSE 'open' END,
    updated_at = now() WHERE id = m.id;
END;
$$;
CREATE OR REPLACE FUNCTION public.review_arena_registration(registration_id uuid, next_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.registrations; t public.tournaments;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  IF next_status NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Invalid status.'; END IF;
  -- Lock the tournament before the registration to serialize capacity checks.
  SELECT * INTO r FROM public.registrations WHERE id = registration_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = r.tournament_id FOR UPDATE;
  SELECT * INTO r FROM public.registrations WHERE id = registration_id FOR UPDATE;
  IF next_status = 'approved' AND r.status <> 'approved' THEN
    IF t.status NOT IN ('upcoming', 'ongoing') THEN RAISE EXCEPTION 'Tournament is not accepting teams.'; END IF;
    IF (SELECT count(*) FROM public.registrations WHERE tournament_id = t.id AND status = 'approved') >= t.max_teams THEN RAISE EXCEPTION 'Tournament is at capacity.'; END IF;
  END IF;
  UPDATE public.registrations SET status = next_status,
    checked_in = CASE WHEN next_status = 'rejected' THEN false ELSE checked_in END,
    checked_in_at = CASE WHEN next_status = 'rejected' THEN NULL ELSE checked_in_at END,
    updated_at = now() WHERE id = r.id;
END;
$$;
CREATE OR REPLACE FUNCTION public.toggle_arena_checkin(registration_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.registrations;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  SELECT * INTO r FROM public.registrations WHERE id = registration_id FOR UPDATE;
  IF r.id IS NULL OR r.status <> 'approved' THEN RAISE EXCEPTION 'Only approved teams can check in.'; END IF;
  UPDATE public.registrations SET checked_in = NOT r.checked_in,
    checked_in_at = CASE WHEN r.checked_in THEN NULL ELSE now() END,
    updated_at = now() WHERE id = r.id;
END;
$$;
REVOKE ALL ON FUNCTION public.join_arena_match(uuid), public.review_arena_registration(uuid, text), public.toggle_arena_checkin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_arena_match(uuid), public.review_arena_registration(uuid, text), public.toggle_arena_checkin(uuid) TO authenticated;
-- Verified rosters are inserted through the server using the service role.
DROP POLICY IF EXISTS "Captains can register their teams" ON public.registrations;
-- Prevent capacity reductions below the current approved count.
CREATE OR REPLACE FUNCTION public.check_tournament_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.max_teams < (SELECT count(*) FROM public.registrations WHERE tournament_id = NEW.id AND status = 'approved') THEN
    RAISE EXCEPTION 'Capacity cannot be smaller than the approved team count.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tournament_capacity BEFORE UPDATE ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.check_tournament_capacity();

CREATE OR REPLACE FUNCTION public.validate_arena_roster() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.tournaments;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id = NEW.tournament_id FOR UPDATE;
  IF TG_OP = 'INSERT' AND (t.status <> 'upcoming' OR t.registration_deadline <= now()) THEN
    RAISE EXCEPTION 'Registration is closed.';
  END IF;
  IF NEW.status = 'approved' AND
    (SELECT count(*) FROM public.registrations WHERE tournament_id = t.id AND status = 'approved' AND id <> NEW.id) >= t.max_teams THEN
    RAISE EXCEPTION 'Tournament is at capacity.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER registration_capacity BEFORE INSERT OR UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.validate_arena_roster();

CREATE OR REPLACE FUNCTION public.initialize_arena_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = NEW.creator_id AND role <> 'banned';
  IF p.id IS NULL OR p.faceit_level NOT BETWEEN NEW.min_faceit_level AND NEW.max_faceit_level THEN
    RAISE EXCEPTION 'Creator does not meet the match requirements.';
  END IF;
  NEW.roster = jsonb_build_array(jsonb_build_object('id', p.id, 'nickname', p.faceit_nickname, 'level', p.faceit_level, 'elo', p.faceit_elo, 'role', 'Captain'));
  NEW.current_players_count = 1;
  NEW.status = 'open';
  RETURN NEW;
END;
$$;
ALTER TABLE public.match_requests ADD CONSTRAINT match_capacity CHECK (target_players_count BETWEEN 2 AND 10);
CREATE TRIGGER match_initial_roster BEFORE INSERT ON public.match_requests
FOR EACH ROW EXECUTE FUNCTION public.initialize_arena_match();
