ALTER TABLE public.match_requests ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE public.match_requests ADD COLUMN host_name text;
REVOKE INSERT ON public.match_requests FROM authenticated, anon;
DROP POLICY "Players create their own matches" ON public.match_requests;
DROP POLICY "Anyone can view open match requests" ON public.match_requests;
CREATE POLICY "Upcoming matches" ON public.match_requests FOR SELECT TO anon, authenticated USING (scheduled_time > now());

CREATE OR REPLACE FUNCTION public.initialize_arena_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.profiles;
BEGIN
  IF NEW.scheduled_time IS NULL OR NEW.scheduled_time <= now() THEN RAISE EXCEPTION 'A future match time is required.'; END IF;
  IF NEW.creator_id IS NOT NULL THEN
    SELECT * INTO p FROM public.profiles WHERE id = NEW.creator_id AND role <> 'banned';
    IF p.id IS NULL THEN RAISE EXCEPTION 'This account cannot post matches.'; END IF;
    NEW.host_name = p.faceit_nickname;
    NEW.roster = jsonb_build_array(jsonb_build_object('id', p.id, 'nickname', p.faceit_nickname, 'level', CASE WHEN p.faceit_id IS NOT NULL THEN p.faceit_level ELSE NULL END, 'elo', CASE WHEN p.faceit_id IS NOT NULL THEN p.faceit_elo ELSE NULL END, 'role', 'Captain'));
  ELSE
    NEW.host_name = left(coalesce(nullif(trim(NEW.host_name), ''), 'Guest host'), 40);
    NEW.roster = jsonb_build_array(jsonb_build_object('id', NEW.id, 'nickname', NEW.host_name, 'level', NULL, 'elo', NULL, 'role', 'Captain'));
  END IF;
  NEW.current_players_count = 1;
  NEW.status = 'open';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_arena_match() FROM PUBLIC, anon, authenticated;

-- Also refuse expired joins during the short interval before physical cleanup.
CREATE OR REPLACE FUNCTION public.reject_expired_match_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.scheduled_time IS NULL OR OLD.scheduled_time <= now() THEN RAISE EXCEPTION 'This match has expired.'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_expired_match_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER match_expiry_before_update BEFORE UPDATE ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.reject_expired_match_update();

CREATE TABLE public.faceit_leaderboard (
  faceit_id text PRIMARY KEY,
  nickname text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 10),
  elo integer NOT NULL,
  matches integer,
  wins integer,
  win_rate numeric,
  kd_ratio numeric,
  headshot_rate numeric,
  stats_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.faceit_leaderboard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.faceit_leaderboard FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.faceit_leaderboard TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faceit_leaderboard TO service_role;
CREATE POLICY "Public verified FACEIT stats" ON public.faceit_leaderboard FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX faceit_leaderboard_rank_idx ON public.faceit_leaderboard (elo DESC, win_rate DESC, kd_ratio DESC);

-- Expiry is enforced by RLS and the API. Deletion requires explicit retention approval.
NOTIFY pgrst, 'reload schema';

CREATE TABLE public.match_contacts (
  match_id uuid PRIMARY KEY REFERENCES public.match_requests(id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')
);
ALTER TABLE public.match_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.match_contacts TO service_role;
CREATE INDEX match_contacts_phone_idx ON public.match_contacts (phone);
CREATE OR REPLACE FUNCTION public.post_arena_match(payload jsonb, host_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE m public.match_requests;
BEGIN
  IF host_phone IS NULL OR host_phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Enter a valid phone number.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(host_phone, 0));
  IF (SELECT count(*) FROM public.match_contacts c JOIN public.match_requests r ON r.id=c.match_id WHERE c.phone=host_phone AND r.scheduled_time > now()) >= 3 THEN RAISE EXCEPTION 'This number already has three upcoming match posts.'; END IF;
  INSERT INTO public.match_requests (creator_id,host_name,title,type,description,scheduled_time,min_faceit_level,max_faceit_level,target_players_count)
  VALUES ((payload->>'creator_id')::uuid,payload->>'host_name',payload->>'title',payload->>'type',payload->>'description',(payload->>'scheduled_time')::timestamptz,(payload->>'min_faceit_level')::integer,(payload->>'max_faceit_level')::integer,(payload->>'target_players_count')::integer) RETURNING * INTO m;
  INSERT INTO public.match_contacts (match_id,phone) VALUES (m.id,host_phone);
  RETURN to_jsonb(m);
END;
$$;
REVOKE ALL ON FUNCTION public.post_arena_match(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_arena_match(jsonb,text) TO service_role;
NOTIFY pgrst, 'reload schema';
