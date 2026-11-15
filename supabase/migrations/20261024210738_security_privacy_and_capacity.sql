-- Limit private contact reveals without storing phone numbers in the audit log.
CREATE TABLE public.contact_reveals (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 match_id uuid NOT NULL REFERENCES public.match_requests(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_reveals_actor_created_idx ON public.contact_reveals(actor_id,created_at);
ALTER TABLE public.contact_reveals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_reveals FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.contact_reveals TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.contact_reveals_id_seq TO service_role;

-- Public projections contain nicknames only; private application fields stay in registrations.
CREATE TABLE public.registration_public_details (
 id uuid PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
 team_name text NOT NULL,
 status text NOT NULL,
 roster_details jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL
);
CREATE INDEX registration_public_event_idx ON public.registration_public_details(tournament_id,status);
ALTER TABLE public.registration_public_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_public_details FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.registration_public_details TO anon,authenticated;
GRANT ALL ON public.registration_public_details TO service_role;
CREATE POLICY public_approved_entries ON public.registration_public_details FOR SELECT TO anon,authenticated
 USING(status='approved' AND EXISTS(SELECT 1 FROM public.tournaments t WHERE t.id=tournament_id AND t.status<>'draft'));
CREATE FUNCTION arena_private.sync_public_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.registration_public_details(id,tournament_id,team_name,status,roster_details,created_at)
 VALUES(NEW.id,NEW.tournament_id,NEW.team_name,NEW.status,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('nickname',p->>'nickname') ORDER BY position),'[]'::jsonb) FROM jsonb_array_elements(NEW.roster_details) WITH ORDINALITY AS players(p,position)),NEW.created_at)
 ON CONFLICT(id) DO UPDATE SET tournament_id=excluded.tournament_id,team_name=excluded.team_name,status=excluded.status,roster_details=excluded.roster_details;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION arena_private.sync_public_registration() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER sync_public_registration AFTER INSERT OR UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION arena_private.sync_public_registration();
INSERT INTO public.registration_public_details(id,tournament_id,team_name,status,roster_details,created_at)
 SELECT r.id,r.tournament_id,r.team_name,r.status,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('nickname',p->>'nickname') ORDER BY position),'[]'::jsonb) FROM jsonb_array_elements(r.roster_details) WITH ORDINALITY AS players(p,position)),r.created_at FROM public.registrations r;
CREATE VIEW public.public_registrations WITH(security_invoker=true) AS
 SELECT id,tournament_id,team_name,status,roster_details,created_at FROM public.registration_public_details WHERE status='approved';
CREATE VIEW public.public_tournament_counts WITH(security_invoker=true) AS
 SELECT tournament_id,count(*) AS registrations_count FROM public.registration_public_details WHERE status='approved' GROUP BY tournament_id;
GRANT SELECT ON public.public_registrations,public.public_tournament_counts TO anon,authenticated,service_role;
DROP POLICY "Visible tournament registrations" ON public.registrations;
CREATE POLICY "Private registrations for owner and admin" ON public.registrations FOR SELECT TO authenticated
 USING((SELECT public.is_admin()) OR (SELECT auth.uid())=captain_id);
REVOKE SELECT ON public.registrations FROM anon;
REVOKE SELECT(role) ON public.profiles FROM anon;
-- Ranking eligibility reads private application data; only the curated server API calls it.
REVOKE ALL ON FUNCTION public.read_faceit_ranking(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_faceit_ranking(integer,integer) TO service_role;

-- Shared eligibility rule, callable only by the trusted server.
CREATE FUNCTION public.eligible_registrations(event_id uuid) RETURNS SETOF public.registrations
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH banned AS MATERIALIZED(SELECT id,faceit_id FROM public.profiles WHERE role='banned')
 SELECT r.* FROM public.registrations r WHERE r.tournament_id=event_id AND r.status='approved'
 AND (r.amount_due=0 OR r.payment_status='verified')
 AND NOT EXISTS(SELECT 1 FROM banned b WHERE b.id=r.captain_id)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r.roster_details) player JOIN banned b ON b.faceit_id=player->>'faceit_id')
 ORDER BY r.created_at,r.id;
$$;
REVOKE ALL ON FUNCTION public.eligible_registrations(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eligible_registrations(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.create_competition_bracket(event_id uuid,graph jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; item jsonb; seed uuid; teams integer;
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN('upcoming','ongoing') OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION 'This tournament cannot generate another bracket.'; END IF;
 SELECT count(*) INTO teams FROM public.eligible_registrations(event_id);
 IF teams<2 THEN RAISE EXCEPTION 'At least two approved teams with any required payment verified are required.'; END IF;
 IF jsonb_array_length(graph) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid bracket graph.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(graph) LOOP
  FOREACH seed IN ARRAY ARRAY[(item->>'team_a')::uuid,(item->>'team_b')::uuid] LOOP
   IF seed IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.eligible_registrations(event_id) r WHERE r.id=seed) THEN RAISE EXCEPTION 'A bracket team is no longer eligible.'; END IF;
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
  SELECT count(*) INTO eligible_count FROM public.eligible_registrations(event_id) r WHERE r.id=ANY(new_ids);
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


-- Pending applications cannot squat a team name or consume approved capacity.
ALTER TABLE public.registrations DROP CONSTRAINT uq_tournament_team;
DROP INDEX public.registrations_team_case_unique;
CREATE UNIQUE INDEX registrations_team_case_unique ON public.registrations(tournament_id,lower(team_name)) WHERE status='approved';
CREATE OR REPLACE FUNCTION public.submit_team_application(actor_id uuid,event_id uuid,application jsonb,credential_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; entry public.registrations; roster jsonb:=application->'players';
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status<>'upcoming' OR event.registration_deadline<=now() THEN RAISE EXCEPTION 'Registration is closed.';END IF;
 IF actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>'banned') THEN RAISE EXCEPTION 'Account access denied.';END IF;
 IF jsonb_typeof(roster)<>'array' OR jsonb_array_length(roster)<>5 OR EXISTS(SELECT 1 FROM jsonb_array_elements(roster) p WHERE jsonb_typeof(p)<>'object' OR length(trim(coalesce(p->>'nickname',''))) NOT BETWEEN 1 AND 40) OR (SELECT count(DISTINCT lower(trim(p->>'nickname'))) FROM jsonb_array_elements(roster) p)<>5 THEN RAISE EXCEPTION 'Enter five different player names.';END IF;
 IF length(trim(coalesce(application->>'team_name',''))) NOT BETWEEN 1 AND 80 OR length(trim(coalesce(application->>'captain_name',''))) NOT BETWEEN 1 AND 80 OR application->>'phone' !~ '^\+[1-9][0-9]{7,14}$' OR coalesce(application->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce((application->>'accepted_rules')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Complete the team and captain details and accept the rules.';END IF;
 IF (SELECT count(*) FROM public.registrations WHERE tournament_id=event_id AND status='approved')>=event.max_teams THEN RAISE EXCEPTION 'Tournament entries are full.';END IF;
 IF (SELECT count(*) FROM public.registrations WHERE tournament_id=event_id AND status='pending')>=greatest(event.max_teams*2,20) THEN RAISE EXCEPTION 'Too many pending applications. Try later.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('team-entry:'||(application->>'phone'),0));
 IF EXISTS(SELECT 1 FROM public.registration_contacts c JOIN public.registrations r ON r.id=c.registration_id WHERE r.tournament_id=event_id AND r.status<>'rejected' AND c.phone=application->>'phone' AND lower(c.email)=lower(application->>'email')) THEN RAISE EXCEPTION 'This captain already has an application for this event.';END IF;
 INSERT INTO public.registrations(tournament_id,captain_id,team_name,roster_details,avg_faceit_level)
 VALUES(event_id,actor_id,trim(application->>'team_name'),roster,NULL) RETURNING * INTO entry;
 INSERT INTO public.registration_contacts(registration_id,captain_name,email,phone,city,notes,delete_token_hash)
 VALUES(entry.id,trim(application->>'captain_name'),lower(application->>'email'),application->>'phone',left(coalesce(application->>'city',''),80),left(coalesce(application->>'notes',''),1000),credential_hash);
 RETURN to_jsonb(entry);
END $$;
REVOKE ALL ON FUNCTION public.submit_team_application(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_team_application(uuid,uuid,jsonb,text) TO service_role;

DROP FUNCTION public.admin_delete_tournament(uuid,uuid,text);
CREATE FUNCTION public.admin_delete_tournament(actor_id uuid,event_id uuid,confirmation_title text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; paths jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL THEN RAISE EXCEPTION 'Tournament no longer exists.'; END IF;
 IF confirmation_title IS DISTINCT FROM event.title THEN RAISE EXCEPTION 'Type the current tournament title to confirm deletion.'; END IF;
 SELECT coalesce(jsonb_agg(c.storage_path),'[]'::jsonb) INTO paths FROM public.match_scorecards c JOIN public.tournament_matches m ON m.id=c.match_id WHERE m.tournament_id=event.id;
 -- Remove bracket references before cascading through registrations and private contacts.
 DELETE FROM public.tournament_matches WHERE tournament_id=event.id;
 DELETE FROM public.tournaments WHERE id=event.id;
 RETURN paths;
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_tournament(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tournament(uuid,uuid,text) TO service_role;

-- Tighten trigger execution and avoid deriving public nicknames from email addresses.
ALTER FUNCTION public.validate_arena_roster() SET search_path='';
ALTER FUNCTION public.check_tournament_capacity() SET search_path='';
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin');
END $$;
CREATE OR REPLACE FUNCTION public.create_player_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.profiles(id,faceit_nickname,role)
 VALUES(NEW.id,left(coalesce(nullif(NEW.raw_user_meta_data->>'nickname',''),nullif(NEW.raw_user_meta_data->>'preferred_username',''),nullif(NEW.raw_user_meta_data->>'name',''),'Player-'||substr(NEW.id::text,1,6)),40),'player')
 ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_player_profile(),public.validate_arena_roster(),public.check_tournament_capacity() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.create_player_profile() SET SCHEMA arena_private;
ALTER FUNCTION public.validate_arena_roster() SET SCHEMA arena_private;
ALTER FUNCTION public.check_tournament_capacity() SET SCHEMA arena_private;
UPDATE public.profiles p SET faceit_nickname='Player-'||substr(p.id::text,1,6)
 FROM auth.users u WHERE p.id=u.id AND p.faceit_id IS NULL
 AND p.faceit_nickname=split_part(u.email,'@',1)
 AND coalesce(u.raw_user_meta_data->>'nickname',u.raw_user_meta_data->>'preferred_username',u.raw_user_meta_data->>'name','')='';
-- Retire only the no-show cron target; historical attendance remains recoverable.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE command ILIKE '%release_tournament_no_shows%';
 END IF;
END $$;
-- Expire old pending notices instead of retaining an undeliverable queue forever.
CREATE FUNCTION public.purge_old_operations() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
 DELETE FROM public.notifications_log WHERE created_at<now()-interval '30 days' AND (lease_until IS NULL OR lease_until<now());
 GET DIAGNOSTICS removed=ROW_COUNT;
 DELETE FROM public.contact_reveals WHERE created_at<now()-interval '30 days';
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.purge_old_operations() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_operations() TO service_role;
SELECT cron.schedule('purge-old-operations','15 3 * * *',$job$SELECT public.purge_old_operations();$job$);
NOTIFY pgrst,'reload schema';
