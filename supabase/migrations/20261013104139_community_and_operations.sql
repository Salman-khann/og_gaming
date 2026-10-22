-- Community writes are server-only. Every RPC checks the authenticated actor
-- supplied by the server; no caller can choose a role or another user's account.
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, faceit_id text NOT NULL,
  nickname text NOT NULL, status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','accepted')),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days', created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id,faceit_id), UNIQUE(team_id,user_id)
);
CREATE INDEX team_members_user_idx ON public.team_members(user_id);
CREATE INDEX team_members_faceit_idx ON public.team_members(faceit_id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_members FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
GRANT SELECT(id,name,captain_id,created_at) ON public.teams TO anon,authenticated;
GRANT ALL ON public.teams TO service_role;
CREATE POLICY "Team summaries" ON public.teams FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY "Own invitations and captain roster" ON public.team_members FOR SELECT TO authenticated USING(
 user_id=(SELECT auth.uid()) OR faceit_id=(SELECT faceit_id FROM public.profiles WHERE id=(SELECT auth.uid())) OR
 EXISTS(SELECT 1 FROM public.teams t WHERE t.id=team_id AND t.captain_id=(SELECT auth.uid())));

ALTER TABLE public.tournaments ADD COLUMN bracket_type text NOT NULL DEFAULT 'single' CHECK(bracket_type IN('single','double'));
ALTER TABLE public.tournaments ADD COLUMN checkin_open timestamptz;
ALTER TABLE public.tournaments ADD COLUMN checkin_close timestamptz;
ALTER TABLE public.tournaments ADD CONSTRAINT tournament_checkin_window CHECK(
 (checkin_open IS NULL AND checkin_close IS NULL) OR
 (checkin_open IS NOT NULL AND checkin_close IS NOT NULL AND checkin_open<checkin_close AND checkin_close<=start_date));
ALTER TABLE public.registrations ADD COLUMN amount_due numeric(10,2) NOT NULL DEFAULT 0 CHECK(amount_due>=0);
ALTER TABLE public.registrations ADD COLUMN no_show boolean NOT NULL DEFAULT false;
UPDATE public.registrations r SET amount_due=t.entry_fee FROM public.tournaments t WHERE t.id=r.tournament_id;

CREATE TABLE public.admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 subject_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, action text NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_actor_idx ON public.admin_audit(actor_id);
CREATE INDEX admin_audit_subject_idx ON public.admin_audit(subject_id);
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.admin_audit TO service_role;

CREATE FUNCTION public.community_action(actor_id uuid, action_name text, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; t public.teams; member public.team_members; event public.tournaments; reg public.registrations; target public.profiles; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>'banned';
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.'; END IF;
 IF action_name='create_team' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF actor.faceit_id IS NULL THEN RAISE EXCEPTION 'Sign in with FACEIT before creating a verified team.'; END IF;
  IF (SELECT count(*) FROM public.teams WHERE captain_id=actor.id)>=5 THEN RAISE EXCEPTION 'You already captain five teams.'; END IF;
  INSERT INTO public.teams(name,captain_id) VALUES(left(trim(payload->>'name'),80),actor.id) RETURNING * INTO t;
  IF length(t.name)=0 THEN RAISE EXCEPTION 'A team name is required.'; END IF;
  INSERT INTO public.team_members(team_id,user_id,faceit_id,nickname,status) VALUES(t.id,actor.id,actor.faceit_id,actor.faceit_nickname,'accepted');
  RETURN to_jsonb(t);
 ELSIF action_name IN('invite','remove_member','accept') THEN
  IF action_name='accept' THEN
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
 ELSIF action_name='checkin' THEN
  SELECT * INTO reg FROM public.registrations WHERE id=(payload->>'registration_id')::uuid;
  SELECT * INTO event FROM public.tournaments WHERE id=reg.tournament_id FOR UPDATE;
  SELECT * INTO reg FROM public.registrations WHERE id=(payload->>'registration_id')::uuid FOR UPDATE;
  IF reg.id IS NULL OR reg.captain_id<>actor.id OR reg.status<>'approved' OR event.status<>'upcoming' THEN RAISE EXCEPTION 'Only an approved team captain can check in.'; END IF;
  IF now()<coalesce(event.checkin_open,event.start_date-interval '1 hour') OR now()>=coalesce(event.checkin_close,event.start_date) THEN RAISE EXCEPTION 'Check-in is outside the tournament window.'; END IF;
  UPDATE public.registrations SET checked_in=true,checked_in_at=now(),updated_at=now() WHERE id=reg.id;
  RETURN jsonb_build_object('checked_in',true);
 ELSIF action_name='set_role' THEN
  IF actor.role<>'admin' THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('og-admin-roles',0));
  SELECT * INTO target FROM public.profiles WHERE id=(payload->>'user_id')::uuid FOR UPDATE;
  IF target.id IS NULL OR payload->>'role' NOT IN('player','admin','banned') OR length(trim(coalesce(payload->>'reason','')))=0 THEN RAISE EXCEPTION 'A player, role and reason are required.'; END IF;
  IF target.id=actor.id AND payload->>'role'<>'admin' THEN RAISE EXCEPTION 'You cannot remove your own administrator access.'; END IF;
  IF target.role='admin' AND payload->>'role'<>'admin' AND (SELECT count(*) FROM public.profiles WHERE role='admin')<=1 THEN RAISE EXCEPTION 'Keep at least one administrator.'; END IF;
  UPDATE public.profiles SET role=payload->>'role',updated_at=now() WHERE id=target.id;
  INSERT INTO public.admin_audit(actor_id,subject_id,action,reason) VALUES(actor.id,target.id,'role:'||(payload->>'role'),left(payload->>'reason',1000));
  RETURN jsonb_build_object('updated',true);
 END IF;
 RAISE EXCEPTION 'Unknown community action.';
END $$;
REVOKE ALL ON FUNCTION public.community_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_action(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.register_owned_team(actor_id uuid,event_id uuid,squad_id uuid,verified_roster jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t public.tournaments; squad public.teams; r public.registrations;
BEGIN
 SELECT * INTO t FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF (SELECT count(*) FROM public.registrations WHERE tournament_id=event_id AND status<>'rejected')>=t.max_teams THEN RAISE EXCEPTION 'Tournament entries are full.';END IF;
 SELECT * INTO squad FROM public.teams WHERE id=squad_id FOR UPDATE;
 IF squad.id IS NULL OR squad.captain_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>'banned') THEN RAISE EXCEPTION 'Only the captain can register this team.'; END IF;
 IF (SELECT count(*) FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id AND p.faceit_id=m.faceit_id AND p.role<>'banned' WHERE m.team_id=squad.id AND m.status='accepted')<>5 OR jsonb_array_length(verified_roster)<>5 THEN RAISE EXCEPTION 'Five FACEIT-linked players must accept their roster invitations.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(verified_roster) entry WHERE NOT EXISTS(SELECT 1 FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id AND p.faceit_id=m.faceit_id WHERE m.team_id=squad.id AND m.status='accepted' AND m.faceit_id=entry->>'faceit_id')) THEN RAISE EXCEPTION 'The verified roster does not match accepted players.'; END IF;
 IF (SELECT count(DISTINCT entry->>'faceit_id') FROM jsonb_array_elements(verified_roster) entry)<>5 THEN RAISE EXCEPTION 'Five unique players are required.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(verified_roster) entry WHERE (entry->>'level')::integer NOT BETWEEN t.min_level AND t.max_level) THEN RAISE EXCEPTION 'A player is outside the level range.'; END IF;
 IF EXISTS(SELECT 1 FROM public.registrations existing CROSS JOIN LATERAL jsonb_array_elements(existing.roster_details) old_player JOIN jsonb_array_elements(verified_roster) new_player ON old_player->>'faceit_id'=new_player->>'faceit_id' WHERE existing.tournament_id=event_id AND existing.status<>'rejected') THEN RAISE EXCEPTION 'A player is already registered in another team.'; END IF;
 INSERT INTO public.registrations(tournament_id,team_id,captain_id,team_name,roster_details,avg_faceit_level,amount_due)
 VALUES(event_id,squad.id,actor_id,squad.name,verified_roster,(SELECT avg((entry->>'level')::numeric) FROM jsonb_array_elements(verified_roster) entry),t.entry_fee) RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.register_owned_team(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_owned_team(uuid,uuid,uuid,jsonb) TO service_role;

-- This job releases unchecked teams before any bracket starts; bracket entrants
-- are always checked-in teams, even in the minute before the job fires.
CREATE FUNCTION public.release_tournament_no_shows() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; changed integer; total integer:=0;
BEGIN
 FOR event IN SELECT * FROM public.tournaments WHERE status='upcoming' AND coalesce(checkin_close,start_date)<=now() ORDER BY id FOR UPDATE LOOP
  IF NOT EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event.id) THEN
   UPDATE public.registrations SET status='rejected',no_show=true,updated_at=now() WHERE tournament_id=event.id AND status='approved' AND NOT checked_in;
   GET DIAGNOSTICS changed=ROW_COUNT; total:=total+changed;
  END IF;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.release_tournament_no_shows() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_tournament_no_shows() TO service_role;
SELECT cron.schedule('release-tournament-no-shows','* * * * *',$job$SELECT public.release_tournament_no_shows();$job$);

CREATE TABLE public.api_rate_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
CREATE FUNCTION public.consume_rate_limit(bucket_key text,allowed integer,window_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_hits integer;
BEGIN
 INSERT INTO public.api_rate_limits(bucket,hits,expires_at) VALUES(bucket_key,1,now()+make_interval(secs=>window_seconds))
 ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN public.api_rate_limits.expires_at<=now() THEN 1 ELSE public.api_rate_limits.hits+1 END,
 expires_at=CASE WHEN public.api_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>window_seconds) ELSE public.api_rate_limits.expires_at END RETURNING hits INTO current_hits;
 RETURN current_hits<=allowed;
END $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;
SELECT cron.schedule('purge-expired-rate-limits','0 * * * *',$job$DELETE FROM public.api_rate_limits WHERE expires_at<now()-interval '1 day';$job$);

ALTER TABLE public.notifications_log ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.notifications_log ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.notifications_log ADD COLUMN lease_until timestamptz;
ALTER TABLE public.notifications_log ADD COLUMN delivery_id text;
ALTER TABLE public.notifications_log ADD COLUMN event_key text UNIQUE;
REVOKE ALL ON public.notifications_log FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.notifications_log TO service_role;
CREATE INDEX notifications_dispatch_idx ON public.notifications_log(available_at) WHERE status IN('pending','failed');
CREATE FUNCTION public.queue_arena_notice() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 INSERT INTO public.notifications_log(channel,recipient,event_type,payload,event_key)
 VALUES('system','admins',TG_TABLE_NAME||':'||lower(TG_OP),jsonb_build_object('id',NEW.id,'name',coalesce(to_jsonb(NEW)->>'title',to_jsonb(NEW)->>'team_name',to_jsonb(NEW)->>'name','Arena event')),TG_TABLE_NAME||':'||NEW.id||':'||lower(TG_OP)||':'||coalesce(to_jsonb(NEW)->>'status','')||':'||coalesce(to_jsonb(NEW)->>'updated_at',now()::text)) ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_arena_notice() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER match_admin_notice AFTER INSERT ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();
CREATE TRIGGER registration_admin_notice AFTER INSERT OR UPDATE OF status ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();
CREATE FUNCTION public.claim_notifications() RETURNS SETOF public.notifications_log
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 RETURN QUERY UPDATE public.notifications_log SET lease_until=now()+interval '1 minute',attempts=attempts+1
 WHERE id IN(SELECT id FROM public.notifications_log WHERE status IN('pending','failed') AND attempts<8 AND available_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY available_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications() TO service_role;
NOTIFY pgrst,'reload schema';
