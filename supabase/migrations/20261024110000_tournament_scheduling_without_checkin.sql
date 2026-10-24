-- Retire check-in without deleting historical attendance records.
-- Keep the existing cron target harmless during rolling deployments.
CREATE OR REPLACE FUNCTION public.release_tournament_no_shows() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT 0; $$;
REVOKE ALL ON FUNCTION public.toggle_arena_checkin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.checkin_team_application(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_competition_bracket(event_id uuid,graph jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; item jsonb; seed uuid; teams integer;
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN('upcoming','ongoing') OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION 'This tournament cannot generate another bracket.'; END IF;
 SELECT count(*) INTO teams FROM public.registrations r WHERE tournament_id=event_id AND status='approved' AND (amount_due=0 OR payment_status='verified') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='banned' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',p.faceit_id))));
 IF teams<2 THEN RAISE EXCEPTION 'At least two approved teams with any required payment verified are required.'; END IF;
 IF jsonb_array_length(graph) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid bracket graph.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(graph) LOOP
  FOREACH seed IN ARRAY ARRAY[(item->>'team_a')::uuid,(item->>'team_b')::uuid] LOOP
   IF seed IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE id=seed AND tournament_id=event_id AND status='approved' AND (amount_due=0 OR payment_status='verified') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='banned' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',p.faceit_id))))) THEN RAISE EXCEPTION 'A bracket team is no longer eligible.'; END IF;
  END LOOP;
  INSERT INTO public.tournament_matches(tournament_id,bracket,node_key,round,position,team_a,team_b,source_a,source_b,outcome_a,outcome_b)
  VALUES(event_id,item->>'bracket',item->>'key',(item->>'round')::integer,(item->>'position')::integer,(item->>'team_a')::uuid,(item->>'team_b')::uuid,item->>'source_a',item->>'source_b',item->>'outcome_a',item->>'outcome_b');
 END LOOP;
 IF (SELECT count(DISTINCT seed_id) FROM public.tournament_matches m CROSS JOIN LATERAL unnest(ARRAY[m.team_a,m.team_b]) seed_id WHERE m.tournament_id=event_id AND seed_id IS NOT NULL)<>teams THEN RAISE EXCEPTION 'The entrant list changed; regenerate the bracket.'; END IF;
 UPDATE public.tournaments SET status='ongoing',updated_at=now() WHERE id=event_id;
 PERFORM public.advance_competition(event_id);
END $$;

CREATE OR REPLACE FUNCTION public.set_competition_pairings(event_id uuid, pairings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.tournaments;
  opening_count integer;
  old_ids uuid[];
  new_ids uuid[];
  distinct_count integer;
  eligible_count integer;
  item jsonb;
BEGIN
  SELECT * INTO event FROM public.tournaments WHERE id = event_id FOR UPDATE;
  IF event.id IS NULL OR event.status NOT IN ('upcoming', 'ongoing') THEN
    RAISE EXCEPTION 'This tournament cannot change its matchups.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id = event_id
    AND (status = 'completed' OR score_a IS NOT NULL OR score_b IS NOT NULL)) THEN
    RAISE EXCEPTION 'Matchups are locked because scores have already been recorded.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id = event_id AND node_key IS NULL) THEN
    RAISE EXCEPTION 'This legacy bracket cannot change its opening matchups.';
  END IF;
  SELECT count(*) INTO opening_count FROM public.tournament_matches
    WHERE tournament_id = event_id AND bracket = 'winners' AND round = 1;
  IF opening_count = 0 OR jsonb_typeof(pairings) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Opening matchups are required.';
  END IF;
  IF jsonb_array_length(pairings) <> opening_count THEN
    RAISE EXCEPTION 'The number of opening matches does not match the bracket.';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(pairings) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT (item ? 'team_a' AND item ? 'team_b')
      OR (item->>'team_a' IS NULL AND item->>'team_b' IS NULL) THEN
      RAISE EXCEPTION 'Every opening match needs at least one team.';
    END IF;
  END LOOP;
  SELECT coalesce(array_agg(team ORDER BY team), '{}'::uuid[]) INTO old_ids
    FROM public.tournament_matches m
    CROSS JOIN LATERAL unnest(ARRAY[m.team_a, m.team_b]) AS entrants(team)
    WHERE m.tournament_id = event_id AND m.bracket = 'winners' AND m.round = 1 AND team IS NOT NULL;
  SELECT coalesce(array_agg(team ORDER BY team), '{}'::uuid[]), count(DISTINCT team)
    INTO new_ids, distinct_count FROM jsonb_array_elements(pairings) AS pairs(value)
    CROSS JOIN LATERAL (VALUES ((value->>'team_a')::uuid), ((value->>'team_b')::uuid)) AS entrants(team)
    WHERE team IS NOT NULL;
  IF new_ids IS DISTINCT FROM old_ids OR distinct_count <> cardinality(new_ids) THEN
    RAISE EXCEPTION 'Assign every existing entrant exactly once; no duplicate or outside teams.';
  END IF;
  SELECT count(*) INTO eligible_count FROM public.registrations r
    WHERE r.id = ANY(new_ids) AND r.tournament_id = event_id AND r.status = 'approved'
      AND (r.amount_due = 0 OR r.payment_status = 'verified')
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.role = 'banned'
        AND (p.id = r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id', p.faceit_id))));
  IF eligible_count <> cardinality(new_ids) THEN
    RAISE EXCEPTION 'A bracket team is no longer eligible. Check approval and payment.';
  END IF;
  -- Clear only derived, unplayed results (including automatic byes), then
  -- propagate the new opening assignments through the existing graph.
  UPDATE public.tournament_matches SET team_a = NULL, team_b = NULL,
    winner_id = NULL, score_a = NULL, score_b = NULL, status = 'pending'
    WHERE tournament_id = event_id;
  UPDATE public.tournament_matches m SET team_a = (pairs.value->>'team_a')::uuid,
    team_b = (pairs.value->>'team_b')::uuid
    FROM jsonb_array_elements(pairings) WITH ORDINALITY AS pairs(value, position)
    WHERE m.tournament_id = event_id AND m.bracket = 'winners' AND m.round = 1 AND m.position = pairs.position;
  UPDATE public.tournaments SET updated_at = now() WHERE id = event_id;
  PERFORM public.advance_competition(event_id);
END $$;

CREATE OR REPLACE FUNCTION public.community_action(actor_id uuid, action_name text, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; t public.teams; member public.team_members; event public.tournaments; reg public.registrations; target public.profiles; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>'banned';
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.'; END IF;
 IF action_name='create_team' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF (SELECT count(*) FROM public.team_members WHERE user_id=actor.id AND status='accepted')>=5 THEN RAISE EXCEPTION 'You already belong to five teams.'; END IF;
  IF actor.faceit_id IS NULL THEN RAISE EXCEPTION 'Sign in with FACEIT before creating a verified team.'; END IF;
  IF (SELECT count(*) FROM public.teams WHERE captain_id=actor.id)>=5 THEN RAISE EXCEPTION 'You already captain five teams.'; END IF;
  INSERT INTO public.teams(name,captain_id) VALUES(left(trim(payload->>'name'),80),actor.id) RETURNING * INTO t;
  IF length(t.name)=0 THEN RAISE EXCEPTION 'A team name is required.'; END IF;
  INSERT INTO public.team_members(team_id,user_id,faceit_id,nickname,status) VALUES(t.id,actor.id,actor.faceit_id,actor.faceit_nickname,'accepted');
  RETURN to_jsonb(t);
 ELSIF action_name IN('invite','remove_member','accept') THEN
  IF action_name='accept' THEN
   -- Serialize the per-player limit across invitations to different teams.
   PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
   SELECT * INTO member FROM public.team_members WHERE id=(payload->>'invitation_id')::uuid;
   SELECT * INTO t FROM public.teams WHERE id=member.team_id FOR UPDATE;
   SELECT * INTO member FROM public.team_members WHERE id=(payload->>'invitation_id')::uuid FOR UPDATE;
   IF member.id IS NULL OR actor.faceit_id IS NULL OR member.faceit_id<>actor.faceit_id OR member.expires_at<=now() OR member.status<>'invited' THEN RAISE EXCEPTION 'This invitation is expired or belongs to a different FACEIT account.'; END IF;
   IF (SELECT count(*) FROM public.team_members WHERE user_id=actor.id AND status='accepted')>=5 THEN RAISE EXCEPTION 'You already belong to five teams.';END IF;
   IF (SELECT count(*) FROM public.team_members WHERE team_id=t.id AND status='accepted')>=5 THEN RAISE EXCEPTION 'Team roster is full.'; END IF;
   UPDATE public.team_members SET user_id=actor.id,nickname=actor.faceit_nickname,status='accepted' WHERE id=member.id;
   RETURN jsonb_build_object('accepted',true);
  END IF;
  SELECT * INTO t FROM public.teams WHERE id=(payload->>'team_id')::uuid FOR UPDATE;
  IF t.id IS NULL OR t.captain_id<>actor.id THEN RAISE EXCEPTION 'Only the captain can manage this team.'; END IF;
  IF EXISTS(SELECT 1 FROM public.registrations r JOIN public.tournaments e ON e.id=r.tournament_id WHERE r.team_id=t.id AND r.status<>'rejected' AND e.status IN('upcoming','ongoing')) THEN RAISE EXCEPTION 'The roster is locked while registered in an active tournament.'; END IF;
  IF action_name='invite' THEN
   DELETE FROM public.team_members WHERE team_id=t.id AND status='invited' AND expires_at<=now();
   IF (SELECT count(*) FROM public.team_members WHERE team_id=t.id)>=5 THEN RAISE EXCEPTION 'Team roster already has five players or invitations.'; END IF;
   INSERT INTO public.team_members(team_id,faceit_id,nickname) VALUES(t.id,payload->>'faceit_id',payload->>'nickname') RETURNING * INTO member;
   RETURN to_jsonb(member);
  ELSE
   DELETE FROM public.team_members WHERE id=(payload->>'member_id')::uuid AND team_id=t.id AND user_id IS DISTINCT FROM actor.id;
   RETURN jsonb_build_object('removed',true);
  END IF;
 ELSIF action_name='set_role' THEN
  IF actor.role<>'admin' THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('og-admin-roles',0));
  SELECT * INTO target FROM public.profiles WHERE id=(payload->>'user_id')::uuid FOR UPDATE;
  IF target.id IS NULL OR payload->>'role' NOT IN('player','admin','banned') THEN RAISE EXCEPTION 'A player and role are required.'; END IF;
  IF target.id=actor.id AND payload->>'role'<>'admin' THEN RAISE EXCEPTION 'You cannot remove your own administrator access.'; END IF;
  IF target.role='admin' AND payload->>'role'<>'admin' AND (SELECT count(*) FROM public.profiles WHERE role='admin')<=1 THEN RAISE EXCEPTION 'Keep at least one administrator.'; END IF;
  UPDATE public.profiles SET role=payload->>'role',updated_at=now() WHERE id=target.id;
  RETURN jsonb_build_object('updated',true);
 END IF;
 RAISE EXCEPTION 'Unknown community action.';
END $$;

-- A schedule belongs to one tournament; dates are never global defaults.
ALTER TABLE public.tournaments ADD COLUMN bracket_schedule jsonb;
CREATE FUNCTION public.valid_bracket_schedule(config jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE day jsonb; date_text text;
BEGIN
 IF config IS NULL THEN RETURN true; END IF;
 IF jsonb_typeof(config) IS DISTINCT FROM 'object' OR NOT (config ? 'start_date' AND config ? 'days') THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(config)) <> 2 THEN RETURN false; END IF;
 date_text := config->>'start_date';
 IF jsonb_typeof(config->'start_date') IS DISTINCT FROM 'string' OR date_text !~ '^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$' OR date_text > '9998-12-31' OR to_char(date_text::date, 'YYYY-MM-DD') <> date_text THEN RETURN false; END IF;
 IF jsonb_typeof(config->'days') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(config->'days') NOT BETWEEN 1 AND 7 THEN RETURN false; END IF;
 FOR day IN SELECT value FROM jsonb_array_elements(config->'days') LOOP
  IF jsonb_typeof(day) IS DISTINCT FROM 'number' OR (day #>> '{}')::numeric NOT BETWEEN 0 AND 6 OR trunc((day #>> '{}')::numeric) <> (day #>> '{}')::numeric THEN RETURN false; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(config->'days')) <> jsonb_array_length(config->'days') THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.valid_bracket_schedule(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_bracket_schedule(jsonb) TO anon, authenticated, service_role;
ALTER TABLE public.tournaments ADD CONSTRAINT valid_bracket_schedule CHECK (public.valid_bracket_schedule(bracket_schedule));

CREATE FUNCTION public.guard_bracket_schedule() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.bracket_schedule IS DISTINCT FROM OLD.bracket_schedule AND EXISTS (
  SELECT 1 FROM public.tournament_matches WHERE tournament_id=OLD.id AND status='completed'
 ) THEN RAISE EXCEPTION 'The match schedule is locked while results are recorded.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_bracket_schedule() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bracket_schedule_guard BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.guard_bracket_schedule();
