BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- 20261013095606_arena_security_and_integrity.sql
-- Public player data excludes the legacy private phone column.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;
GRANT SELECT (id,faceit_id,faceit_nickname,faceit_avatar_url,faceit_elo,faceit_level,faceit_game_id,role,created_at,updated_at)
ON public.profiles TO anon, authenticated;

DROP POLICY "Approved registrations, own teams or admin" ON public.registrations;
CREATE POLICY "Visible tournament registrations" ON public.registrations FOR SELECT TO anon, authenticated
USING (
  (SELECT public.is_admin()) OR (SELECT auth.uid()) = captain_id OR
  (status = 'approved' AND EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.status <> 'draft'))
);

-- Unranked accounts may join unrestricted community matches, but cannot pass
-- a restricted FACEIT level check using the profile's default level of one.
CREATE OR REPLACE FUNCTION arena_private.join_arena_match(match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.match_requests; p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() AND role <> 'banned';
  IF p.id IS NULL THEN RAISE EXCEPTION 'Please log in to join.'; END IF;
  SELECT * INTO m FROM public.match_requests WHERE id = match_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> 'open' OR m.scheduled_time <= now() OR jsonb_array_length(m.roster) >= m.target_players_count THEN RAISE EXCEPTION 'Match is full or closed.'; END IF;
  IF p.faceit_id IS NULL AND (m.min_faceit_level > 1 OR m.max_faceit_level < 10) THEN RAISE EXCEPTION 'Connect FACEIT to join a match with restricted levels.'; END IF;
  IF p.faceit_id IS NOT NULL AND (p.faceit_level IS NULL OR p.faceit_level < m.min_faceit_level OR p.faceit_level > m.max_faceit_level) THEN RAISE EXCEPTION 'Your level does not meet this match requirement.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.roster) entry WHERE entry->>'id' = p.id::text) THEN RAISE EXCEPTION 'You are already in this match.'; END IF;
  UPDATE public.match_requests SET
    roster = m.roster || jsonb_build_array(jsonb_build_object('id', p.id, 'nickname', p.faceit_nickname, 'level', CASE WHEN p.faceit_id IS NOT NULL THEN p.faceit_level END, 'elo', CASE WHEN p.faceit_id IS NOT NULL THEN p.faceit_elo END, 'role', 'Player')),
    current_players_count = jsonb_array_length(m.roster) + 1,
    status = CASE WHEN jsonb_array_length(m.roster) + 1 >= m.target_players_count THEN 'matched' ELSE 'open' END,
    updated_at = now() WHERE id = m.id;
END;
$$;
REVOKE ALL ON FUNCTION arena_private.join_arena_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION arena_private.join_arena_match(uuid) TO authenticated;

-- Save the guest ownership credential in the same transaction as the post.
CREATE OR REPLACE FUNCTION public.post_arena_match(payload jsonb, host_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE m public.match_requests; token_hash text := payload->>'delete_token_hash';
BEGIN
  IF host_phone IS NULL OR host_phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Enter a valid phone number.'; END IF;
  IF token_hash IS NOT NULL AND token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid post ownership credential.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(host_phone, 0));
  IF (SELECT count(*) FROM public.match_contacts c JOIN public.match_requests r ON r.id=c.match_id WHERE c.phone=host_phone AND r.scheduled_time > now()) >= 3 THEN RAISE EXCEPTION 'This number already has three upcoming match posts.'; END IF;
  INSERT INTO public.match_requests (creator_id,host_name,title,type,description,scheduled_time,min_faceit_level,max_faceit_level,target_players_count,delete_on_expiry)
  VALUES ((payload->>'creator_id')::uuid,payload->>'host_name',payload->>'title',payload->>'type',payload->>'description',(payload->>'scheduled_time')::timestamptz,(payload->>'min_faceit_level')::integer,(payload->>'max_faceit_level')::integer,(payload->>'target_players_count')::integer,true) RETURNING * INTO m;
  INSERT INTO public.match_contacts (match_id,phone,delete_token_hash) VALUES (m.id,host_phone,token_hash);
  RETURN to_jsonb(m);
END;
$$;
REVOKE ALL ON FUNCTION public.post_arena_match(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_arena_match(jsonb,text) TO service_role;

NOTIFY pgrst, 'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013095606','arena_security_and_integrity',ARRAY['-- Public player data excludes the legacy private phone column.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
REVOKE SELECT (phone) ON public.profiles FROM anon, authenticated;
GRANT SELECT (id,faceit_id,faceit_nickname,faceit_avatar_url,faceit_elo,faceit_level,faceit_game_id,role,created_at,updated_at)
ON public.profiles TO anon, authenticated;

DROP POLICY "Approved registrations, own teams or admin" ON public.registrations;
CREATE POLICY "Visible tournament registrations" ON public.registrations FOR SELECT TO anon, authenticated
USING (
  (SELECT public.is_admin()) OR (SELECT auth.uid()) = captain_id OR
  (status = ''approved'' AND EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND t.status <> ''draft''))
);

-- Unranked accounts may join unrestricted community matches, but cannot pass
-- a restricted FACEIT level check using the profile''s default level of one.
CREATE OR REPLACE FUNCTION arena_private.join_arena_match(match_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '''' AS $$
DECLARE m public.match_requests; p public.profiles;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() AND role <> ''banned'';
  IF p.id IS NULL THEN RAISE EXCEPTION ''Please log in to join.''; END IF;
  SELECT * INTO m FROM public.match_requests WHERE id = match_id FOR UPDATE;
  IF m.id IS NULL OR m.status <> ''open'' OR m.scheduled_time <= now() OR jsonb_array_length(m.roster) >= m.target_players_count THEN RAISE EXCEPTION ''Match is full or closed.''; END IF;
  IF p.faceit_id IS NULL AND (m.min_faceit_level > 1 OR m.max_faceit_level < 10) THEN RAISE EXCEPTION ''Connect FACEIT to join a match with restricted levels.''; END IF;
  IF p.faceit_id IS NOT NULL AND (p.faceit_level IS NULL OR p.faceit_level < m.min_faceit_level OR p.faceit_level > m.max_faceit_level) THEN RAISE EXCEPTION ''Your level does not meet this match requirement.''; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.roster) entry WHERE entry->>''id'' = p.id::text) THEN RAISE EXCEPTION ''You are already in this match.''; END IF;
  UPDATE public.match_requests SET
    roster = m.roster || jsonb_build_array(jsonb_build_object(''id'', p.id, ''nickname'', p.faceit_nickname, ''level'', CASE WHEN p.faceit_id IS NOT NULL THEN p.faceit_level END, ''elo'', CASE WHEN p.faceit_id IS NOT NULL THEN p.faceit_elo END, ''role'', ''Player'')),
    current_players_count = jsonb_array_length(m.roster) + 1,
    status = CASE WHEN jsonb_array_length(m.roster) + 1 >= m.target_players_count THEN ''matched'' ELSE ''open'' END,
    updated_at = now() WHERE id = m.id;
END;
$$;
REVOKE ALL ON FUNCTION arena_private.join_arena_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION arena_private.join_arena_match(uuid) TO authenticated;

-- Save the guest ownership credential in the same transaction as the post.
CREATE OR REPLACE FUNCTION public.post_arena_match(payload jsonb, host_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '''' AS $$
DECLARE m public.match_requests; token_hash text := payload->>''delete_token_hash'';
BEGIN
  IF host_phone IS NULL OR host_phone !~ ''^\+[1-9][0-9]{7,14}$'' THEN RAISE EXCEPTION ''Enter a valid phone number.''; END IF;
  IF token_hash IS NOT NULL AND token_hash !~ ''^[a-f0-9]{64}$'' THEN RAISE EXCEPTION ''Invalid post ownership credential.''; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(host_phone, 0));
  IF (SELECT count(*) FROM public.match_contacts c JOIN public.match_requests r ON r.id=c.match_id WHERE c.phone=host_phone AND r.scheduled_time > now()) >= 3 THEN RAISE EXCEPTION ''This number already has three upcoming match posts.''; END IF;
  INSERT INTO public.match_requests (creator_id,host_name,title,type,description,scheduled_time,min_faceit_level,max_faceit_level,target_players_count,delete_on_expiry)
  VALUES ((payload->>''creator_id'')::uuid,payload->>''host_name'',payload->>''title'',payload->>''type'',payload->>''description'',(payload->>''scheduled_time'')::timestamptz,(payload->>''min_faceit_level'')::integer,(payload->>''max_faceit_level'')::integer,(payload->>''target_players_count'')::integer,true) RETURNING * INTO m;
  INSERT INTO public.match_contacts (match_id,phone,delete_token_hash) VALUES (m.id,host_phone,token_hash);
  RETURN to_jsonb(m);
END;
$$;
REVOKE ALL ON FUNCTION public.post_arena_match(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_arena_match(jsonb,text) TO service_role;

NOTIFY pgrst, ''reload schema'';
']);

-- 20261013104139_community_and_operations.sql
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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013104139','community_and_operations',ARRAY['-- Community writes are server-only. Every RPC checks the authenticated actor
-- supplied by the server; no caller can choose a role or another user''s account.
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, faceit_id text NOT NULL,
  nickname text NOT NULL, status text NOT NULL DEFAULT ''invited'' CHECK(status IN (''invited'',''accepted'')),
  expires_at timestamptz NOT NULL DEFAULT now()+interval ''7 days'', created_at timestamptz NOT NULL DEFAULT now(),
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

ALTER TABLE public.tournaments ADD COLUMN bracket_type text NOT NULL DEFAULT ''single'' CHECK(bracket_type IN(''single'',''double''));
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
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE actor public.profiles; t public.teams; member public.team_members; event public.tournaments; reg public.registrations; target public.profiles; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>''banned'';
 IF actor.id IS NULL THEN RAISE EXCEPTION ''Account access required.''; END IF;
 IF action_name=''create_team'' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF actor.faceit_id IS NULL THEN RAISE EXCEPTION ''Sign in with FACEIT before creating a verified team.''; END IF;
  IF (SELECT count(*) FROM public.teams WHERE captain_id=actor.id)>=5 THEN RAISE EXCEPTION ''You already captain five teams.''; END IF;
  INSERT INTO public.teams(name,captain_id) VALUES(left(trim(payload->>''name''),80),actor.id) RETURNING * INTO t;
  IF length(t.name)=0 THEN RAISE EXCEPTION ''A team name is required.''; END IF;
  INSERT INTO public.team_members(team_id,user_id,faceit_id,nickname,status) VALUES(t.id,actor.id,actor.faceit_id,actor.faceit_nickname,''accepted'');
  RETURN to_jsonb(t);
 ELSIF action_name IN(''invite'',''remove_member'',''accept'') THEN
  IF action_name=''accept'' THEN
   SELECT * INTO member FROM public.team_members WHERE id=(payload->>''invitation_id'')::uuid;
   SELECT * INTO t FROM public.teams WHERE id=member.team_id FOR UPDATE;
   SELECT * INTO member FROM public.team_members WHERE id=(payload->>''invitation_id'')::uuid FOR UPDATE;
   IF member.id IS NULL OR actor.faceit_id IS NULL OR member.faceit_id<>actor.faceit_id OR member.expires_at<=now() OR member.status<>''invited'' THEN RAISE EXCEPTION ''This invitation is expired or belongs to a different FACEIT account.''; END IF;
   IF (SELECT count(*) FROM public.team_members WHERE user_id=actor.id AND status=''accepted'')>=5 THEN RAISE EXCEPTION ''You already belong to five teams.'';END IF;
   IF (SELECT count(*) FROM public.team_members WHERE team_id=t.id AND status=''accepted'')>=5 THEN RAISE EXCEPTION ''Team roster is full.''; END IF;
   UPDATE public.team_members SET user_id=actor.id,nickname=actor.faceit_nickname,status=''accepted'' WHERE id=member.id;
   RETURN jsonb_build_object(''accepted'',true);
  END IF;
  SELECT * INTO t FROM public.teams WHERE id=(payload->>''team_id'')::uuid FOR UPDATE;
  IF t.id IS NULL OR t.captain_id<>actor.id THEN RAISE EXCEPTION ''Only the captain can manage this team.''; END IF;
  IF EXISTS(SELECT 1 FROM public.registrations r JOIN public.tournaments e ON e.id=r.tournament_id WHERE r.team_id=t.id AND r.status<>''rejected'' AND e.status IN(''upcoming'',''ongoing'')) THEN RAISE EXCEPTION ''The roster is locked while registered in an active tournament.''; END IF;
  IF action_name=''invite'' THEN
   DELETE FROM public.team_members WHERE team_id=t.id AND status=''invited'' AND expires_at<=now();
   IF (SELECT count(*) FROM public.team_members WHERE team_id=t.id)>=5 THEN RAISE EXCEPTION ''Team roster already has five players or invitations.''; END IF;
   INSERT INTO public.team_members(team_id,faceit_id,nickname) VALUES(t.id,payload->>''faceit_id'',payload->>''nickname'') RETURNING * INTO member;
   RETURN to_jsonb(member);
  ELSE
   DELETE FROM public.team_members WHERE id=(payload->>''member_id'')::uuid AND team_id=t.id AND user_id IS DISTINCT FROM actor.id;
   RETURN jsonb_build_object(''removed'',true);
  END IF;
 ELSIF action_name=''checkin'' THEN
  SELECT * INTO reg FROM public.registrations WHERE id=(payload->>''registration_id'')::uuid;
  SELECT * INTO event FROM public.tournaments WHERE id=reg.tournament_id FOR UPDATE;
  SELECT * INTO reg FROM public.registrations WHERE id=(payload->>''registration_id'')::uuid FOR UPDATE;
  IF reg.id IS NULL OR reg.captain_id<>actor.id OR reg.status<>''approved'' OR event.status<>''upcoming'' THEN RAISE EXCEPTION ''Only an approved team captain can check in.''; END IF;
  IF now()<coalesce(event.checkin_open,event.start_date-interval ''1 hour'') OR now()>=coalesce(event.checkin_close,event.start_date) THEN RAISE EXCEPTION ''Check-in is outside the tournament window.''; END IF;
  UPDATE public.registrations SET checked_in=true,checked_in_at=now(),updated_at=now() WHERE id=reg.id;
  RETURN jsonb_build_object(''checked_in'',true);
 ELSIF action_name=''set_role'' THEN
  IF actor.role<>''admin'' THEN RAISE EXCEPTION ''Administrator access required.''; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(''og-admin-roles'',0));
  SELECT * INTO target FROM public.profiles WHERE id=(payload->>''user_id'')::uuid FOR UPDATE;
  IF target.id IS NULL OR payload->>''role'' NOT IN(''player'',''admin'',''banned'') OR length(trim(coalesce(payload->>''reason'','''')))=0 THEN RAISE EXCEPTION ''A player, role and reason are required.''; END IF;
  IF target.id=actor.id AND payload->>''role''<>''admin'' THEN RAISE EXCEPTION ''You cannot remove your own administrator access.''; END IF;
  IF target.role=''admin'' AND payload->>''role''<>''admin'' AND (SELECT count(*) FROM public.profiles WHERE role=''admin'')<=1 THEN RAISE EXCEPTION ''Keep at least one administrator.''; END IF;
  UPDATE public.profiles SET role=payload->>''role'',updated_at=now() WHERE id=target.id;
  INSERT INTO public.admin_audit(actor_id,subject_id,action,reason) VALUES(actor.id,target.id,''role:''||(payload->>''role''),left(payload->>''reason'',1000));
  RETURN jsonb_build_object(''updated'',true);
 END IF;
 RAISE EXCEPTION ''Unknown community action.'';
END $$;
REVOKE ALL ON FUNCTION public.community_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.community_action(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.register_owned_team(actor_id uuid,event_id uuid,squad_id uuid,verified_roster jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE t public.tournaments; squad public.teams; r public.registrations;
BEGIN
 SELECT * INTO t FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF (SELECT count(*) FROM public.registrations WHERE tournament_id=event_id AND status<>''rejected'')>=t.max_teams THEN RAISE EXCEPTION ''Tournament entries are full.'';END IF;
 SELECT * INTO squad FROM public.teams WHERE id=squad_id FOR UPDATE;
 IF squad.id IS NULL OR squad.captain_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>''banned'') THEN RAISE EXCEPTION ''Only the captain can register this team.''; END IF;
 IF (SELECT count(*) FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id AND p.faceit_id=m.faceit_id AND p.role<>''banned'' WHERE m.team_id=squad.id AND m.status=''accepted'')<>5 OR jsonb_array_length(verified_roster)<>5 THEN RAISE EXCEPTION ''Five FACEIT-linked players must accept their roster invitations.''; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(verified_roster) entry WHERE NOT EXISTS(SELECT 1 FROM public.team_members m JOIN public.profiles p ON p.id=m.user_id AND p.faceit_id=m.faceit_id WHERE m.team_id=squad.id AND m.status=''accepted'' AND m.faceit_id=entry->>''faceit_id'')) THEN RAISE EXCEPTION ''The verified roster does not match accepted players.''; END IF;
 IF (SELECT count(DISTINCT entry->>''faceit_id'') FROM jsonb_array_elements(verified_roster) entry)<>5 THEN RAISE EXCEPTION ''Five unique players are required.''; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(verified_roster) entry WHERE (entry->>''level'')::integer NOT BETWEEN t.min_level AND t.max_level) THEN RAISE EXCEPTION ''A player is outside the level range.''; END IF;
 IF EXISTS(SELECT 1 FROM public.registrations existing CROSS JOIN LATERAL jsonb_array_elements(existing.roster_details) old_player JOIN jsonb_array_elements(verified_roster) new_player ON old_player->>''faceit_id''=new_player->>''faceit_id'' WHERE existing.tournament_id=event_id AND existing.status<>''rejected'') THEN RAISE EXCEPTION ''A player is already registered in another team.''; END IF;
 INSERT INTO public.registrations(tournament_id,team_id,captain_id,team_name,roster_details,avg_faceit_level,amount_due)
 VALUES(event_id,squad.id,actor_id,squad.name,verified_roster,(SELECT avg((entry->>''level'')::numeric) FROM jsonb_array_elements(verified_roster) entry),t.entry_fee) RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.register_owned_team(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_owned_team(uuid,uuid,uuid,jsonb) TO service_role;

-- This job releases unchecked teams before any bracket starts; bracket entrants
-- are always checked-in teams, even in the minute before the job fires.
CREATE FUNCTION public.release_tournament_no_shows() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE event public.tournaments; changed integer; total integer:=0;
BEGIN
 FOR event IN SELECT * FROM public.tournaments WHERE status=''upcoming'' AND coalesce(checkin_close,start_date)<=now() ORDER BY id FOR UPDATE LOOP
  IF NOT EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event.id) THEN
   UPDATE public.registrations SET status=''rejected'',no_show=true,updated_at=now() WHERE tournament_id=event.id AND status=''approved'' AND NOT checked_in;
   GET DIAGNOSTICS changed=ROW_COUNT; total:=total+changed;
  END IF;
 END LOOP;
 RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.release_tournament_no_shows() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_tournament_no_shows() TO service_role;
SELECT cron.schedule(''release-tournament-no-shows'',''* * * * *'',$job$SELECT public.release_tournament_no_shows();$job$);

CREATE TABLE public.api_rate_limits (bucket text PRIMARY KEY, hits integer NOT NULL, expires_at timestamptz NOT NULL);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
CREATE FUNCTION public.consume_rate_limit(bucket_key text,allowed integer,window_seconds integer) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE current_hits integer;
BEGIN
 INSERT INTO public.api_rate_limits(bucket,hits,expires_at) VALUES(bucket_key,1,now()+make_interval(secs=>window_seconds))
 ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN public.api_rate_limits.expires_at<=now() THEN 1 ELSE public.api_rate_limits.hits+1 END,
 expires_at=CASE WHEN public.api_rate_limits.expires_at<=now() THEN now()+make_interval(secs=>window_seconds) ELSE public.api_rate_limits.expires_at END RETURNING hits INTO current_hits;
 RETURN current_hits<=allowed;
END $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;
SELECT cron.schedule(''purge-expired-rate-limits'',''0 * * * *'',$job$DELETE FROM public.api_rate_limits WHERE expires_at<now()-interval ''1 day'';$job$);

ALTER TABLE public.notifications_log ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.notifications_log ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.notifications_log ADD COLUMN lease_until timestamptz;
ALTER TABLE public.notifications_log ADD COLUMN delivery_id text;
ALTER TABLE public.notifications_log ADD COLUMN event_key text UNIQUE;
REVOKE ALL ON public.notifications_log FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.notifications_log TO service_role;
CREATE INDEX notifications_dispatch_idx ON public.notifications_log(available_at) WHERE status IN(''pending'',''failed'');
CREATE FUNCTION public.queue_arena_notice() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
BEGIN
 INSERT INTO public.notifications_log(channel,recipient,event_type,payload,event_key)
 VALUES(''system'',''admins'',TG_TABLE_NAME||'':''||lower(TG_OP),jsonb_build_object(''id'',NEW.id,''name'',coalesce(to_jsonb(NEW)->>''title'',to_jsonb(NEW)->>''team_name'',to_jsonb(NEW)->>''name'',''Arena event'')),TG_TABLE_NAME||'':''||NEW.id||'':''||lower(TG_OP)||'':''||coalesce(to_jsonb(NEW)->>''status'','''')||'':''||coalesce(to_jsonb(NEW)->>''updated_at'',now()::text)) ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.queue_arena_notice() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER match_admin_notice AFTER INSERT ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();
CREATE TRIGGER registration_admin_notice AFTER INSERT OR UPDATE OF status ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();
CREATE FUNCTION public.claim_notifications() RETURNS SETOF public.notifications_log
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
BEGIN
 RETURN QUERY UPDATE public.notifications_log SET lease_until=now()+interval ''1 minute'',attempts=attempts+1
 WHERE id IN(SELECT id FROM public.notifications_log WHERE status IN(''pending'',''failed'') AND attempts<8 AND available_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY available_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications() TO service_role;
NOTIFY pgrst,''reload schema'';
']);

-- 20261013104726_matchmaking_and_brackets.sql
ALTER TABLE public.match_requests ADD COLUMN balanced_teams jsonb;
ALTER TABLE public.tournament_matches ADD COLUMN bracket text NOT NULL DEFAULT 'winners' CHECK(bracket IN('winners','losers','final','reset'));
ALTER TABLE public.tournament_matches ADD COLUMN node_key text;
ALTER TABLE public.tournament_matches ADD COLUMN source_a text;
ALTER TABLE public.tournament_matches ADD COLUMN source_b text;
ALTER TABLE public.tournament_matches ADD COLUMN outcome_a text NOT NULL DEFAULT 'winner' CHECK(outcome_a IN('winner','loser'));
ALTER TABLE public.tournament_matches ADD COLUMN outcome_b text NOT NULL DEFAULT 'winner' CHECK(outcome_b IN('winner','loser'));
ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_round_check;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_round_check CHECK(round BETWEEN 1 AND 14);
ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_tournament_id_round_position_key;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_slot_unique UNIQUE(tournament_id,bracket,round,position);
CREATE UNIQUE INDEX tournament_node_idx ON public.tournament_matches(tournament_id,node_key);

CREATE TABLE public.match_disputes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
 reporter_id uuid NOT NULL REFERENCES public.profiles(id), reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN('open','resolved','dismissed')), resolution text,
 resolved_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE INDEX match_disputes_match_idx ON public.match_disputes(match_id);
CREATE INDEX match_disputes_reporter_idx ON public.match_disputes(reporter_id);
CREATE INDEX match_disputes_resolver_idx ON public.match_disputes(resolved_by);
CREATE UNIQUE INDEX match_disputes_open_idx ON public.match_disputes(match_id,reporter_id) WHERE status='open';
ALTER TABLE public.match_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_disputes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.match_disputes TO authenticated;
GRANT ALL ON public.match_disputes TO service_role;
CREATE POLICY "Own disputes or admin" ON public.match_disputes FOR SELECT TO authenticated USING(reporter_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.advance_competition(event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; parent public.tournament_matches; grand_final public.tournament_matches; a uuid; b uuid; ready boolean; changed boolean; champion uuid; kind text;
BEGIN
 SELECT bracket_type INTO kind FROM public.tournaments WHERE id=event_id FOR UPDATE;
 LOOP
  changed:=false;
  FOR m IN SELECT * FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND status='pending' ORDER BY round,position LOOP
   a:=m.team_a; b:=m.team_b; ready:=true;
   IF m.bracket='reset' THEN
    SELECT * INTO grand_final FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='final';
    IF grand_final.status<>'completed' THEN CONTINUE; END IF;
    IF grand_final.winner_id=grand_final.team_a THEN
     UPDATE public.tournament_matches SET status='bye',winner_id=grand_final.winner_id WHERE id=m.id; changed:=true; CONTINUE;
    END IF;
   END IF;
   IF m.source_a IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_a;
    IF parent.id IS NULL OR parent.status='pending' THEN ready:=false;
    ELSE a:=CASE WHEN m.outcome_a='winner' THEN parent.winner_id WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL WHEN parent.winner_id=parent.team_a THEN parent.team_b ELSE parent.team_a END; END IF;
   END IF;
   IF m.source_b IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_b;
    IF parent.id IS NULL OR parent.status='pending' THEN ready:=false;
    ELSE b:=CASE WHEN m.outcome_b='winner' THEN parent.winner_id WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL WHEN parent.winner_id=parent.team_a THEN parent.team_b ELSE parent.team_a END; END IF;
   END IF;
   IF ready THEN
    IF a IS DISTINCT FROM m.team_a OR b IS DISTINCT FROM m.team_b OR a IS NULL OR b IS NULL THEN
     UPDATE public.tournament_matches SET team_a=a,team_b=b,status=CASE WHEN a IS NULL OR b IS NULL THEN 'bye' ELSE 'pending' END,winner_id=CASE WHEN a IS NULL OR b IS NULL THEN coalesce(a,b) ELSE NULL END WHERE id=m.id; changed:=true;
    END IF;
   END IF;
  END LOOP;
  EXIT WHEN NOT changed;
 END LOOP;
 IF kind='single' THEN
  SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND bracket='winners' ORDER BY round DESC LIMIT 1;
 ELSE
  SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND bracket='reset' AND status IN('completed','bye');
 END IF;
 IF champion IS NOT NULL THEN UPDATE public.tournaments SET status='completed',updated_at=now() WHERE id=event_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_competition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_competition(uuid) TO service_role;

CREATE FUNCTION public.create_competition_bracket(event_id uuid,graph jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; item jsonb; seed uuid; teams integer;
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN('upcoming','ongoing') OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION 'This tournament cannot generate another bracket.'; END IF;
 SELECT count(*) INTO teams FROM public.registrations r WHERE tournament_id=event_id AND status='approved' AND checked_in AND NOT no_show AND (amount_due=0 OR payment_status='verified') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='banned' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',p.faceit_id))));
 IF teams<2 THEN RAISE EXCEPTION 'At least two approved, paid and checked-in teams are required.'; END IF;
 IF jsonb_array_length(graph) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid bracket graph.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(graph) LOOP
  FOREACH seed IN ARRAY ARRAY[(item->>'team_a')::uuid,(item->>'team_b')::uuid] LOOP
   IF seed IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE id=seed AND tournament_id=event_id AND status='approved' AND checked_in AND NOT no_show AND (amount_due=0 OR payment_status='verified') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='banned' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',p.faceit_id))))) THEN RAISE EXCEPTION 'A bracket team is no longer eligible.'; END IF;
  END LOOP;
  INSERT INTO public.tournament_matches(tournament_id,bracket,node_key,round,position,team_a,team_b,source_a,source_b,outcome_a,outcome_b)
  VALUES(event_id,item->>'bracket',item->>'key',(item->>'round')::integer,(item->>'position')::integer,(item->>'team_a')::uuid,(item->>'team_b')::uuid,item->>'source_a',item->>'source_b',item->>'outcome_a',item->>'outcome_b');
 END LOOP;
 IF (SELECT count(DISTINCT seed_id) FROM public.tournament_matches m CROSS JOIN LATERAL unnest(ARRAY[m.team_a,m.team_b]) seed_id WHERE m.tournament_id=event_id AND seed_id IS NOT NULL)<>teams THEN RAISE EXCEPTION 'The entrant list changed; regenerate the bracket.'; END IF;
 UPDATE public.tournaments SET status='ongoing',updated_at=now() WHERE id=event_id;
 PERFORM public.advance_competition(event_id);
END $$;
REVOKE ALL ON FUNCTION public.create_competition_bracket(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_competition_bracket(uuid,jsonb) TO service_role;

CREATE FUNCTION public.record_competition_result(game_id uuid,a_score integer,b_score integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
 IF EXISTS(SELECT 1 FROM public.match_disputes WHERE match_id=game_id AND status='open') THEN RAISE EXCEPTION 'Resolve the open dispute before changing this result.'; END IF;
 IF m.node_key IS NULL THEN PERFORM public.record_tournament_result(game_id,a_score,b_score); RETURN; END IF;
 IF event_status NOT IN('ongoing','completed') OR m.team_a IS NULL OR m.team_b IS NULL OR m.status='bye' OR a_score IS NULL OR b_score IS NULL OR a_score NOT BETWEEN 0 AND 100 OR b_score NOT BETWEEN 0 AND 100 OR a_score=b_score THEN RAISE EXCEPTION 'Enter valid scores for two ready teams with a clear winner.'; END IF;
 IF EXISTS(WITH RECURSIVE downstream AS (
  SELECT * FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION SELECT n.* FROM public.tournament_matches n JOIN downstream d ON n.tournament_id=d.tournament_id AND (n.source_a=d.node_key OR n.source_b=d.node_key)
 ) SELECT 1 FROM downstream WHERE status='completed') THEN RAISE EXCEPTION 'A later match has finished; this result is locked.'; END IF;
 -- Reset automatic byes downstream so their derived winners can be recalculated.
 WITH RECURSIVE downstream AS (
  SELECT node_key FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION SELECT n.node_key FROM public.tournament_matches n JOIN downstream d ON n.source_a=d.node_key OR n.source_b=d.node_key WHERE n.tournament_id=m.tournament_id
 ) UPDATE public.tournament_matches SET status='pending',winner_id=NULL WHERE tournament_id=m.tournament_id AND node_key IN(SELECT node_key FROM downstream) AND status='bye';
 UPDATE public.tournament_matches SET score_a=a_score,score_b=b_score,winner_id=CASE WHEN a_score>b_score THEN team_a ELSE team_b END,status='completed' WHERE id=m.id;
 UPDATE public.tournaments SET status='ongoing' WHERE id=m.tournament_id;
 PERFORM public.advance_competition(m.tournament_id);
END $$;
REVOKE ALL ON FUNCTION public.record_competition_result(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_competition_result(uuid,integer,integer) TO service_role;

CREATE FUNCTION public.join_arena_team(actor_id uuid,match_id uuid,squad_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.match_requests; squad public.teams; squad_roster jsonb; other_roster jsonb;
BEGIN
 SELECT * INTO m FROM public.match_requests WHERE id=match_id FOR UPDATE;
 SELECT * INTO squad FROM public.teams WHERE id=squad_id FOR UPDATE;
 IF squad.id IS NULL OR squad.captain_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>'banned') THEN RAISE EXCEPTION 'Only the captain can join with this team.'; END IF;
 IF m.id IS NULL OR m.type<>'team_vs_team' OR m.status<>'open' OR m.scheduled_time<=now() THEN RAISE EXCEPTION 'This team match is closed.'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.faceit_nickname,'level',p.faceit_level,'elo',p.faceit_elo,'team_id',squad.id,'team_name',squad.name,'role',CASE WHEN p.id=actor_id THEN 'Captain' ELSE 'Player' END)) INTO squad_roster
 FROM public.team_members member JOIN public.profiles p ON p.id=member.user_id AND p.faceit_id=member.faceit_id AND p.role<>'banned'
 WHERE member.team_id=squad.id AND member.status='accepted' AND p.faceit_level BETWEEN m.min_faceit_level AND m.max_faceit_level;
 IF coalesce(jsonb_array_length(squad_roster),0)<>5 THEN RAISE EXCEPTION 'Five accepted, eligible FACEIT players are required.'; END IF;
 SELECT coalesce(jsonb_agg(entry),'[]'::jsonb) INTO other_roster FROM jsonb_array_elements(m.roster) entry WHERE NOT(entry->>'id'=actor_id::text AND NOT entry ? 'team_id');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(other_roster) a JOIN jsonb_array_elements(squad_roster) b ON a->>'id'=b->>'id') OR jsonb_array_length(other_roster)+5>10 THEN RAISE EXCEPTION 'A player is already in this match or the match is full.'; END IF;
 UPDATE public.match_requests SET roster=other_roster||squad_roster,current_players_count=jsonb_array_length(other_roster)+5,target_players_count=10,status=CASE WHEN jsonb_array_length(other_roster)+5=10 THEN 'matched' ELSE 'open' END,updated_at=now() WHERE id=m.id;
END $$;
REVOKE ALL ON FUNCTION public.join_arena_team(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.join_arena_team(uuid,uuid,uuid) TO service_role;
-- Solo joins cannot bypass a team scrim's five-player roster checks.
CREATE FUNCTION public.reject_solo_scrim_join() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.type='team_vs_team' AND NEW.roster IS DISTINCT FROM OLD.roster AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.roster) entry WHERE NOT entry ? 'team_id') THEN RAISE EXCEPTION 'Join a team scrim with a complete verified team.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_solo_scrim_join() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scrim_roster_guard BEFORE UPDATE OF roster ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.reject_solo_scrim_join();
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.post_team_match(payload jsonb,host_phone text,squad_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF payload->>'type'<>'team_vs_team' THEN RAISE EXCEPTION 'A team scrim is required.'; END IF;
 result:=public.post_arena_match(payload,host_phone);
 PERFORM public.join_arena_team((payload->>'creator_id')::uuid,(result->>'id')::uuid,squad_id);
 SELECT to_jsonb(m) INTO result FROM public.match_requests m WHERE id=(result->>'id')::uuid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.post_team_match(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_team_match(jsonb,text,uuid) TO service_role;

CREATE TABLE public.match_history (
 id uuid PRIMARY KEY, title text NOT NULL, scheduled_time timestamptz NOT NULL, roster jsonb NOT NULL,
 balanced_teams jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.match_history TO anon,authenticated;
GRANT ALL ON public.match_history TO service_role;
CREATE POLICY "Public match summaries" ON public.match_history FOR SELECT TO anon,authenticated USING(true);
CREATE FUNCTION public.capture_match_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='matched' THEN
  INSERT INTO public.match_history(id,title,scheduled_time,roster,balanced_teams) VALUES(NEW.id,NEW.title,NEW.scheduled_time,NEW.roster,NEW.balanced_teams)
  ON CONFLICT(id) DO UPDATE SET roster=excluded.roster,balanced_teams=excluded.balanced_teams,updated_at=now();
 END IF;
 RETURN NEW;
END $$;
-- Only the table trigger can execute this archival write; never an exposed RPC.
REVOKE ALL ON FUNCTION public.capture_match_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER match_history_archive AFTER UPDATE ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.capture_match_history();
ALTER FUNCTION public.capture_match_history() SET SCHEMA arena_private;

CREATE FUNCTION public.balance_full_gather() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE mask integer; best integer; difference numeric; smallest numeric:=NULL; total numeric; a jsonb; b jsonb;
BEGIN
 IF NEW.type='gather_5v5' AND NEW.status='matched' AND jsonb_array_length(NEW.roster)=10 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.roster) entry WHERE entry->>'elo' IS NULL) THEN
  SELECT sum((entry->>'elo')::numeric) INTO total FROM jsonb_array_elements(NEW.roster) entry;
  FOR mask IN 1..1023 BY 2 LOOP
   IF bit_count(mask::bit(10))=5 THEN
    SELECT abs(total-2*sum((entry->>'elo')::numeric)) INTO difference FROM jsonb_array_elements(NEW.roster) WITH ORDINALITY entries(entry,n) WHERE (mask & (1 << (n::integer-1)))<>0;
    IF smallest IS NULL OR difference<smallest THEN smallest:=difference;best:=mask; END IF;
   END IF;
  END LOOP;
  SELECT jsonb_agg(entry) FILTER(WHERE (best & (1 << (n::integer-1)))<>0),jsonb_agg(entry) FILTER(WHERE (best & (1 << (n::integer-1)))=0) INTO a,b FROM jsonb_array_elements(NEW.roster) WITH ORDINALITY entries(entry,n);
  NEW.balanced_teams:=jsonb_build_object('a',a,'b',b,'difference',smallest);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.balance_full_gather() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gather_balance BEFORE UPDATE OF roster ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.balance_full_gather();

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013104726','matchmaking_and_brackets',ARRAY['ALTER TABLE public.match_requests ADD COLUMN balanced_teams jsonb;
ALTER TABLE public.tournament_matches ADD COLUMN bracket text NOT NULL DEFAULT ''winners'' CHECK(bracket IN(''winners'',''losers'',''final'',''reset''));
ALTER TABLE public.tournament_matches ADD COLUMN node_key text;
ALTER TABLE public.tournament_matches ADD COLUMN source_a text;
ALTER TABLE public.tournament_matches ADD COLUMN source_b text;
ALTER TABLE public.tournament_matches ADD COLUMN outcome_a text NOT NULL DEFAULT ''winner'' CHECK(outcome_a IN(''winner'',''loser''));
ALTER TABLE public.tournament_matches ADD COLUMN outcome_b text NOT NULL DEFAULT ''winner'' CHECK(outcome_b IN(''winner'',''loser''));
ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_round_check;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_round_check CHECK(round BETWEEN 1 AND 14);
ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_tournament_id_round_position_key;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_slot_unique UNIQUE(tournament_id,bracket,round,position);
CREATE UNIQUE INDEX tournament_node_idx ON public.tournament_matches(tournament_id,node_key);

CREATE TABLE public.match_disputes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
 reporter_id uuid NOT NULL REFERENCES public.profiles(id), reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT ''open'' CHECK(status IN(''open'',''resolved'',''dismissed'')), resolution text,
 resolved_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE INDEX match_disputes_match_idx ON public.match_disputes(match_id);
CREATE INDEX match_disputes_reporter_idx ON public.match_disputes(reporter_id);
CREATE INDEX match_disputes_resolver_idx ON public.match_disputes(resolved_by);
CREATE UNIQUE INDEX match_disputes_open_idx ON public.match_disputes(match_id,reporter_id) WHERE status=''open'';
ALTER TABLE public.match_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_disputes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.match_disputes TO authenticated;
GRANT ALL ON public.match_disputes TO service_role;
CREATE POLICY "Own disputes or admin" ON public.match_disputes FOR SELECT TO authenticated USING(reporter_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.advance_competition(event_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE m public.tournament_matches; parent public.tournament_matches; grand_final public.tournament_matches; a uuid; b uuid; ready boolean; changed boolean; champion uuid; kind text;
BEGIN
 SELECT bracket_type INTO kind FROM public.tournaments WHERE id=event_id FOR UPDATE;
 LOOP
  changed:=false;
  FOR m IN SELECT * FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND status=''pending'' ORDER BY round,position LOOP
   a:=m.team_a; b:=m.team_b; ready:=true;
   IF m.bracket=''reset'' THEN
    SELECT * INTO grand_final FROM public.tournament_matches WHERE tournament_id=event_id AND bracket=''final'';
    IF grand_final.status<>''completed'' THEN CONTINUE; END IF;
    IF grand_final.winner_id=grand_final.team_a THEN
     UPDATE public.tournament_matches SET status=''bye'',winner_id=grand_final.winner_id WHERE id=m.id; changed:=true; CONTINUE;
    END IF;
   END IF;
   IF m.source_a IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_a;
    IF parent.id IS NULL OR parent.status=''pending'' THEN ready:=false;
    ELSE a:=CASE WHEN m.outcome_a=''winner'' THEN parent.winner_id WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL WHEN parent.winner_id=parent.team_a THEN parent.team_b ELSE parent.team_a END; END IF;
   END IF;
   IF m.source_b IS NOT NULL THEN
    SELECT * INTO parent FROM public.tournament_matches WHERE tournament_id=event_id AND node_key=m.source_b;
    IF parent.id IS NULL OR parent.status=''pending'' THEN ready:=false;
    ELSE b:=CASE WHEN m.outcome_b=''winner'' THEN parent.winner_id WHEN parent.team_a IS NULL OR parent.team_b IS NULL THEN NULL WHEN parent.winner_id=parent.team_a THEN parent.team_b ELSE parent.team_a END; END IF;
   END IF;
   IF ready THEN
    IF a IS DISTINCT FROM m.team_a OR b IS DISTINCT FROM m.team_b OR a IS NULL OR b IS NULL THEN
     UPDATE public.tournament_matches SET team_a=a,team_b=b,status=CASE WHEN a IS NULL OR b IS NULL THEN ''bye'' ELSE ''pending'' END,winner_id=CASE WHEN a IS NULL OR b IS NULL THEN coalesce(a,b) ELSE NULL END WHERE id=m.id; changed:=true;
    END IF;
   END IF;
  END LOOP;
  EXIT WHEN NOT changed;
 END LOOP;
 IF kind=''single'' THEN
  SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND node_key IS NOT NULL AND bracket=''winners'' ORDER BY round DESC LIMIT 1;
 ELSE
  SELECT winner_id INTO champion FROM public.tournament_matches WHERE tournament_id=event_id AND bracket=''reset'' AND status IN(''completed'',''bye'');
 END IF;
 IF champion IS NOT NULL THEN UPDATE public.tournaments SET status=''completed'',updated_at=now() WHERE id=event_id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.advance_competition(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_competition(uuid) TO service_role;

CREATE FUNCTION public.create_competition_bracket(event_id uuid,graph jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE event public.tournaments; item jsonb; seed uuid; teams integer;
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN(''upcoming'',''ongoing'') OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION ''This tournament cannot generate another bracket.''; END IF;
 SELECT count(*) INTO teams FROM public.registrations r WHERE tournament_id=event_id AND status=''approved'' AND checked_in AND NOT no_show AND (amount_due=0 OR payment_status=''verified'') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role=''banned'' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object(''faceit_id'',p.faceit_id))));
 IF teams<2 THEN RAISE EXCEPTION ''At least two approved, paid and checked-in teams are required.''; END IF;
 IF jsonb_array_length(graph) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION ''Invalid bracket graph.''; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(graph) LOOP
  FOREACH seed IN ARRAY ARRAY[(item->>''team_a'')::uuid,(item->>''team_b'')::uuid] LOOP
   IF seed IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.registrations r WHERE id=seed AND tournament_id=event_id AND status=''approved'' AND checked_in AND NOT no_show AND (amount_due=0 OR payment_status=''verified'') AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.role=''banned'' AND (p.id=r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object(''faceit_id'',p.faceit_id))))) THEN RAISE EXCEPTION ''A bracket team is no longer eligible.''; END IF;
  END LOOP;
  INSERT INTO public.tournament_matches(tournament_id,bracket,node_key,round,position,team_a,team_b,source_a,source_b,outcome_a,outcome_b)
  VALUES(event_id,item->>''bracket'',item->>''key'',(item->>''round'')::integer,(item->>''position'')::integer,(item->>''team_a'')::uuid,(item->>''team_b'')::uuid,item->>''source_a'',item->>''source_b'',item->>''outcome_a'',item->>''outcome_b'');
 END LOOP;
 IF (SELECT count(DISTINCT seed_id) FROM public.tournament_matches m CROSS JOIN LATERAL unnest(ARRAY[m.team_a,m.team_b]) seed_id WHERE m.tournament_id=event_id AND seed_id IS NOT NULL)<>teams THEN RAISE EXCEPTION ''The entrant list changed; regenerate the bracket.''; END IF;
 UPDATE public.tournaments SET status=''ongoing'',updated_at=now() WHERE id=event_id;
 PERFORM public.advance_competition(event_id);
END $$;
REVOKE ALL ON FUNCTION public.create_competition_bracket(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_competition_bracket(uuid,jsonb) TO service_role;

CREATE FUNCTION public.record_competition_result(game_id uuid,a_score integer,b_score integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION ''Match not found.''; END IF;
 IF EXISTS(SELECT 1 FROM public.match_disputes WHERE match_id=game_id AND status=''open'') THEN RAISE EXCEPTION ''Resolve the open dispute before changing this result.''; END IF;
 IF m.node_key IS NULL THEN PERFORM public.record_tournament_result(game_id,a_score,b_score); RETURN; END IF;
 IF event_status NOT IN(''ongoing'',''completed'') OR m.team_a IS NULL OR m.team_b IS NULL OR m.status=''bye'' OR a_score IS NULL OR b_score IS NULL OR a_score NOT BETWEEN 0 AND 100 OR b_score NOT BETWEEN 0 AND 100 OR a_score=b_score THEN RAISE EXCEPTION ''Enter valid scores for two ready teams with a clear winner.''; END IF;
 IF EXISTS(WITH RECURSIVE downstream AS (
  SELECT * FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION SELECT n.* FROM public.tournament_matches n JOIN downstream d ON n.tournament_id=d.tournament_id AND (n.source_a=d.node_key OR n.source_b=d.node_key)
 ) SELECT 1 FROM downstream WHERE status=''completed'') THEN RAISE EXCEPTION ''A later match has finished; this result is locked.''; END IF;
 -- Reset automatic byes downstream so their derived winners can be recalculated.
 WITH RECURSIVE downstream AS (
  SELECT node_key FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION SELECT n.node_key FROM public.tournament_matches n JOIN downstream d ON n.source_a=d.node_key OR n.source_b=d.node_key WHERE n.tournament_id=m.tournament_id
 ) UPDATE public.tournament_matches SET status=''pending'',winner_id=NULL WHERE tournament_id=m.tournament_id AND node_key IN(SELECT node_key FROM downstream) AND status=''bye'';
 UPDATE public.tournament_matches SET score_a=a_score,score_b=b_score,winner_id=CASE WHEN a_score>b_score THEN team_a ELSE team_b END,status=''completed'' WHERE id=m.id;
 UPDATE public.tournaments SET status=''ongoing'' WHERE id=m.tournament_id;
 PERFORM public.advance_competition(m.tournament_id);
END $$;
REVOKE ALL ON FUNCTION public.record_competition_result(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_competition_result(uuid,integer,integer) TO service_role;

CREATE FUNCTION public.join_arena_team(actor_id uuid,match_id uuid,squad_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE m public.match_requests; squad public.teams; squad_roster jsonb; other_roster jsonb;
BEGIN
 SELECT * INTO m FROM public.match_requests WHERE id=match_id FOR UPDATE;
 SELECT * INTO squad FROM public.teams WHERE id=squad_id FOR UPDATE;
 IF squad.id IS NULL OR squad.captain_id<>actor_id OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>''banned'') THEN RAISE EXCEPTION ''Only the captain can join with this team.''; END IF;
 IF m.id IS NULL OR m.type<>''team_vs_team'' OR m.status<>''open'' OR m.scheduled_time<=now() THEN RAISE EXCEPTION ''This team match is closed.''; END IF;
 SELECT jsonb_agg(jsonb_build_object(''id'',p.id,''nickname'',p.faceit_nickname,''level'',p.faceit_level,''elo'',p.faceit_elo,''team_id'',squad.id,''team_name'',squad.name,''role'',CASE WHEN p.id=actor_id THEN ''Captain'' ELSE ''Player'' END)) INTO squad_roster
 FROM public.team_members member JOIN public.profiles p ON p.id=member.user_id AND p.faceit_id=member.faceit_id AND p.role<>''banned''
 WHERE member.team_id=squad.id AND member.status=''accepted'' AND p.faceit_level BETWEEN m.min_faceit_level AND m.max_faceit_level;
 IF coalesce(jsonb_array_length(squad_roster),0)<>5 THEN RAISE EXCEPTION ''Five accepted, eligible FACEIT players are required.''; END IF;
 SELECT coalesce(jsonb_agg(entry),''[]''::jsonb) INTO other_roster FROM jsonb_array_elements(m.roster) entry WHERE NOT(entry->>''id''=actor_id::text AND NOT entry ? ''team_id'');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(other_roster) a JOIN jsonb_array_elements(squad_roster) b ON a->>''id''=b->>''id'') OR jsonb_array_length(other_roster)+5>10 THEN RAISE EXCEPTION ''A player is already in this match or the match is full.''; END IF;
 UPDATE public.match_requests SET roster=other_roster||squad_roster,current_players_count=jsonb_array_length(other_roster)+5,target_players_count=10,status=CASE WHEN jsonb_array_length(other_roster)+5=10 THEN ''matched'' ELSE ''open'' END,updated_at=now() WHERE id=m.id;
END $$;
REVOKE ALL ON FUNCTION public.join_arena_team(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.join_arena_team(uuid,uuid,uuid) TO service_role;
-- Solo joins cannot bypass a team scrim''s five-player roster checks.
CREATE FUNCTION public.reject_solo_scrim_join() RETURNS trigger LANGUAGE plpgsql SET search_path='''' AS $$
BEGIN
 IF OLD.type=''team_vs_team'' AND NEW.roster IS DISTINCT FROM OLD.roster AND EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.roster) entry WHERE NOT entry ? ''team_id'') THEN RAISE EXCEPTION ''Join a team scrim with a complete verified team.''; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_solo_scrim_join() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER scrim_roster_guard BEFORE UPDATE OF roster ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.reject_solo_scrim_join();
NOTIFY pgrst,''reload schema'';

CREATE FUNCTION public.post_team_match(payload jsonb,host_phone text,squad_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE result jsonb;
BEGIN
 IF payload->>''type''<>''team_vs_team'' THEN RAISE EXCEPTION ''A team scrim is required.''; END IF;
 result:=public.post_arena_match(payload,host_phone);
 PERFORM public.join_arena_team((payload->>''creator_id'')::uuid,(result->>''id'')::uuid,squad_id);
 SELECT to_jsonb(m) INTO result FROM public.match_requests m WHERE id=(result->>''id'')::uuid;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.post_team_match(jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.post_team_match(jsonb,text,uuid) TO service_role;

CREATE TABLE public.match_history (
 id uuid PRIMARY KEY, title text NOT NULL, scheduled_time timestamptz NOT NULL, roster jsonb NOT NULL,
 balanced_teams jsonb, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.match_history TO anon,authenticated;
GRANT ALL ON public.match_history TO service_role;
CREATE POLICY "Public match summaries" ON public.match_history FOR SELECT TO anon,authenticated USING(true);
CREATE FUNCTION public.capture_match_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $$
BEGIN
 IF NEW.status=''matched'' THEN
  INSERT INTO public.match_history(id,title,scheduled_time,roster,balanced_teams) VALUES(NEW.id,NEW.title,NEW.scheduled_time,NEW.roster,NEW.balanced_teams)
  ON CONFLICT(id) DO UPDATE SET roster=excluded.roster,balanced_teams=excluded.balanced_teams,updated_at=now();
 END IF;
 RETURN NEW;
END $$;
-- Only the table trigger can execute this archival write; never an exposed RPC.
REVOKE ALL ON FUNCTION public.capture_match_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER match_history_archive AFTER UPDATE ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.capture_match_history();
ALTER FUNCTION public.capture_match_history() SET SCHEMA arena_private;

CREATE FUNCTION public.balance_full_gather() RETURNS trigger LANGUAGE plpgsql SET search_path='''' AS $$
DECLARE mask integer; best integer; difference numeric; smallest numeric:=NULL; total numeric; a jsonb; b jsonb;
BEGIN
 IF NEW.type=''gather_5v5'' AND NEW.status=''matched'' AND jsonb_array_length(NEW.roster)=10 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.roster) entry WHERE entry->>''elo'' IS NULL) THEN
  SELECT sum((entry->>''elo'')::numeric) INTO total FROM jsonb_array_elements(NEW.roster) entry;
  FOR mask IN 1..1023 BY 2 LOOP
   IF bit_count(mask::bit(10))=5 THEN
    SELECT abs(total-2*sum((entry->>''elo'')::numeric)) INTO difference FROM jsonb_array_elements(NEW.roster) WITH ORDINALITY entries(entry,n) WHERE (mask & (1 << (n::integer-1)))<>0;
    IF smallest IS NULL OR difference<smallest THEN smallest:=difference;best:=mask; END IF;
   END IF;
  END LOOP;
  SELECT jsonb_agg(entry) FILTER(WHERE (best & (1 << (n::integer-1)))<>0),jsonb_agg(entry) FILTER(WHERE (best & (1 << (n::integer-1)))=0) INTO a,b FROM jsonb_array_elements(NEW.roster) WITH ORDINALITY entries(entry,n);
  NEW.balanced_teams:=jsonb_build_object(''a'',a,''b'',b,''difference'',smallest);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.balance_full_gather() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER gather_balance BEFORE UPDATE OF roster ON public.match_requests FOR EACH ROW EXECUTE FUNCTION public.balance_full_gather();
']);

-- 20261013104927_memberships_promotions_growth.sql
CREATE TABLE public.membership_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 price numeric(10,2) NOT NULL CHECK(price>=0), duration_days integer NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
 gaming_minutes integer NOT NULL CHECK(gaming_minutes BETWEEN 0 AND 60000), perks text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.promotions (
 code text PRIMARY KEY CHECK(code ~ '^[A-Z0-9-]{3,30}$'), discount_percent integer NOT NULL CHECK(discount_percent BETWEEN 1 AND 100),
 max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 100000), uses integer NOT NULL DEFAULT 0,
 owner_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.promotion_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL REFERENCES public.promotions(code),
 user_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(code,user_id)
);
CREATE TABLE public.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
 name text NOT NULL, amount_due numeric(10,2) NOT NULL CHECK(amount_due>=0), duration_days integer NOT NULL,
 remaining_minutes integer NOT NULL CHECK(remaining_minutes>=0), status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','active','cancelled')),
 starts_at timestamptz, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), verified_by uuid REFERENCES public.profiles(id)
);
CREATE TABLE public.membership_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membership_id uuid NOT NULL REFERENCES public.memberships(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 minutes integer NOT NULL CHECK(minutes>0), note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_redemptions_user_idx ON public.promotion_redemptions(user_id);
CREATE INDEX memberships_user_idx ON public.memberships(user_id,created_at DESC);
CREATE INDEX memberships_plan_idx ON public.memberships(plan_id);
CREATE INDEX memberships_verifier_idx ON public.memberships(verified_by);
CREATE INDEX membership_usage_membership_idx ON public.membership_usage(membership_id);
CREATE INDEX membership_usage_actor_idx ON public.membership_usage(actor_id);
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_plans,public.promotions,public.promotion_redemptions,public.memberships,public.membership_usage FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.membership_plans,public.promotions,public.promotion_redemptions,public.memberships,public.membership_usage TO service_role;
GRANT SELECT ON public.membership_plans TO anon,authenticated;
GRANT SELECT ON public.memberships TO authenticated;
CREATE POLICY "Active membership plans" ON public.membership_plans FOR SELECT TO anon,authenticated USING(active OR (SELECT public.is_admin()));
CREATE POLICY "Own memberships or admin" ON public.memberships FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.redeem_promotion(actor_id uuid,promo_code text,price numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE promo public.promotions;
BEGIN
 IF coalesce(trim(promo_code),'')='' THEN RETURN price; END IF;
 SELECT * INTO promo FROM public.promotions WHERE code=upper(trim(promo_code)) FOR UPDATE;
 IF promo.code IS NULL OR NOT promo.active OR promo.expires_at<=now() OR promo.uses>=promo.max_uses OR promo.owner_id=actor_id THEN RAISE EXCEPTION 'This promo or referral code is unavailable.'; END IF;
 INSERT INTO public.promotion_redemptions(code,user_id) VALUES(promo.code,actor_id);
 UPDATE public.promotions SET uses=uses+1 WHERE code=promo.code;
 RETURN round(price*(100-promo.discount_percent)/100,2);
END $$;
REVOKE ALL ON FUNCTION public.redeem_promotion(uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promotion(uuid,text,numeric) TO service_role;

CREATE FUNCTION public.register_team_entry(actor_id uuid,event_id uuid,squad_id uuid,verified_roster jsonb,promo_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; reg public.registrations; price numeric;
BEGIN
 result:=public.register_owned_team(actor_id,event_id,squad_id,verified_roster);
 price:=public.redeem_promotion(actor_id,promo_code,(result->>'amount_due')::numeric);
 UPDATE public.registrations SET amount_due=price,payment_status=CASE WHEN price=0 THEN 'not_required' ELSE 'pending' END WHERE id=(result->>'id')::uuid RETURNING * INTO reg;
 RETURN to_jsonb(reg);
END $$;
REVOKE ALL ON FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_tournament_registration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE t public.tournaments;
BEGIN
 SELECT * INTO t FROM public.tournaments WHERE id=NEW.tournament_id FOR UPDATE;
 IF TG_OP='INSERT' THEN
  IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) THEN RAISE EXCEPTION 'The bracket has started; registration is closed.'; END IF;
  NEW.amount_due:=t.entry_fee;
  NEW.payment_status:=CASE WHEN NEW.amount_due>0 THEN 'pending' ELSE 'not_required' END;
 ELSIF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) AND (
  NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.amount_due IS DISTINCT FROM OLD.amount_due OR NEW.roster_details IS DISTINCT FROM OLD.roster_details OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.captain_id IS DISTINCT FROM OLD.captain_id) THEN RAISE EXCEPTION 'Team eligibility and roster are locked after bracket generation.';
 END IF;
 IF NEW.status='approved' AND NEW.amount_due>0 AND NEW.payment_status<>'verified' THEN RAISE EXCEPTION 'Verify payment before approving this team.'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.membership_action(actor_id uuid,action_name text,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; plan public.membership_plans; member public.memberships; minutes integer; price numeric;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>'banned';
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.'; END IF;
 IF action_name='request' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF (SELECT count(*) FROM public.memberships WHERE user_id=actor.id AND status='pending')>=3 THEN RAISE EXCEPTION 'You already have three pending membership requests.'; END IF;
  SELECT * INTO plan FROM public.membership_plans WHERE id=(payload->>'plan_id')::uuid AND active FOR SHARE;
  IF plan.id IS NULL THEN RAISE EXCEPTION 'This membership plan is unavailable.'; END IF;
  price:=public.redeem_promotion(actor.id,payload->>'promo_code',plan.price);
  INSERT INTO public.memberships(user_id,plan_id,name,amount_due,duration_days,remaining_minutes,status,starts_at,expires_at)
  VALUES(actor.id,plan.id,plan.name,price,plan.duration_days,plan.gaming_minutes,CASE WHEN price=0 THEN 'active' ELSE 'pending' END,CASE WHEN price=0 THEN now() END,CASE WHEN price=0 THEN now()+make_interval(days=>plan.duration_days) END) RETURNING * INTO member;
  RETURN to_jsonb(member);
 END IF;
 IF actor.role<>'admin' THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO member FROM public.memberships WHERE id=(payload->>'membership_id')::uuid FOR UPDATE;
 IF member.id IS NULL THEN RAISE EXCEPTION 'Membership not found.'; END IF;
 IF action_name='verify' THEN
  IF member.status<>'pending' THEN RAISE EXCEPTION 'Only pending memberships can be verified.'; END IF;
  UPDATE public.memberships SET status='active',starts_at=now(),expires_at=now()+make_interval(days=>duration_days),verified_by=actor.id WHERE id=member.id RETURNING * INTO member;
 ELSIF action_name='use_minutes' THEN
  minutes:=(payload->>'minutes')::integer;
  IF member.status<>'active' OR member.expires_at<=now() OR minutes IS NULL OR minutes<=0 OR minutes>member.remaining_minutes OR length(trim(coalesce(payload->>'note','')))=0 THEN RAISE EXCEPTION 'Enter valid minutes and a note for an active pass.'; END IF;
  UPDATE public.memberships SET remaining_minutes=remaining_minutes-minutes WHERE id=member.id RETURNING * INTO member;
  INSERT INTO public.membership_usage(membership_id,actor_id,minutes,note) VALUES(member.id,actor.id,minutes,left(payload->>'note',500));
 ELSIF action_name='cancel' THEN
  IF member.status<>'pending' THEN RAISE EXCEPTION 'Only pending requests can be cancelled.'; END IF;
  UPDATE public.memberships SET status='cancelled' WHERE id=member.id RETURNING * INTO member;
 ELSE RAISE EXCEPTION 'Unknown membership action.';
 END IF;
 RETURN to_jsonb(member);
END $$;
REVOKE ALL ON FUNCTION public.membership_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.membership_action(uuid,text,jsonb) TO service_role;
CREATE TRIGGER membership_admin_notice AFTER INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();

CREATE TABLE public.site_content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN('sponsor','gallery','stream')),
 title text NOT NULL, url text NOT NULL, image_url text, published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_content FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.site_content TO anon,authenticated;
GRANT ALL ON public.site_content TO service_role;
CREATE POLICY "Published growth content" ON public.site_content FOR SELECT TO anon,authenticated USING(published OR (SELECT public.is_admin()));
NOTIFY pgrst,'reload schema';

ALTER TABLE public.profiles ADD COLUMN last_active_at timestamptz;
CREATE INDEX profiles_active_idx ON public.profiles(last_active_at) WHERE last_active_at IS NOT NULL;
CREATE FUNCTION public.arena_analytics() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'players',(SELECT count(*) FROM public.profiles WHERE role<>'banned'),
  'active_players_30d',(SELECT count(*) FROM public.profiles WHERE role<>'banned' AND last_active_at>now()-interval '30 days'),
  'teams',(SELECT count(*) FROM public.teams),
  'tournaments',(SELECT count(*) FROM public.tournaments WHERE status<>'draft'),
  'registration_revenue',(SELECT coalesce(sum(amount_due),0) FROM public.registrations WHERE payment_status='verified'),
  'membership_revenue',(SELECT coalesce(sum(amount_due),0) FROM public.memberships WHERE status='active'),
  'approved_teams',(SELECT count(*) FROM public.registrations WHERE status='approved'),
  'checked_in_teams',(SELECT count(*) FROM public.registrations WHERE checked_in),
  'no_shows',(SELECT count(*) FROM public.registrations WHERE no_show),
  'peak_match_hours',(SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM(SELECT extract(hour FROM scheduled_time AT TIME ZONE 'Asia/Karachi')::integer AS hour,count(*) AS matches FROM public.match_history GROUP BY hour ORDER BY matches DESC LIMIT 5) row)
 );
$$;
REVOKE ALL ON FUNCTION public.arena_analytics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arena_analytics() TO service_role;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013104927','memberships_promotions_growth',ARRAY['CREATE TABLE public.membership_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 price numeric(10,2) NOT NULL CHECK(price>=0), duration_days integer NOT NULL CHECK(duration_days BETWEEN 1 AND 366),
 gaming_minutes integer NOT NULL CHECK(gaming_minutes BETWEEN 0 AND 60000), perks text NOT NULL DEFAULT '''', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.promotions (
 code text PRIMARY KEY CHECK(code ~ ''^[A-Z0-9-]{3,30}$''), discount_percent integer NOT NULL CHECK(discount_percent BETWEEN 1 AND 100),
 max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 100000), uses integer NOT NULL DEFAULT 0,
 owner_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.promotion_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL REFERENCES public.promotions(code),
 user_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(code,user_id)
);
CREATE TABLE public.memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
 name text NOT NULL, amount_due numeric(10,2) NOT NULL CHECK(amount_due>=0), duration_days integer NOT NULL,
 remaining_minutes integer NOT NULL CHECK(remaining_minutes>=0), status text NOT NULL DEFAULT ''pending'' CHECK(status IN(''pending'',''active'',''cancelled'')),
 starts_at timestamptz, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), verified_by uuid REFERENCES public.profiles(id)
);
CREATE TABLE public.membership_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), membership_id uuid NOT NULL REFERENCES public.memberships(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 minutes integer NOT NULL CHECK(minutes>0), note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_redemptions_user_idx ON public.promotion_redemptions(user_id);
CREATE INDEX memberships_user_idx ON public.memberships(user_id,created_at DESC);
CREATE INDEX memberships_plan_idx ON public.memberships(plan_id);
CREATE INDEX memberships_verifier_idx ON public.memberships(verified_by);
CREATE INDEX membership_usage_membership_idx ON public.membership_usage(membership_id);
CREATE INDEX membership_usage_actor_idx ON public.membership_usage(actor_id);
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_plans,public.promotions,public.promotion_redemptions,public.memberships,public.membership_usage FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.membership_plans,public.promotions,public.promotion_redemptions,public.memberships,public.membership_usage TO service_role;
GRANT SELECT ON public.membership_plans TO anon,authenticated;
GRANT SELECT ON public.memberships TO authenticated;
CREATE POLICY "Active membership plans" ON public.membership_plans FOR SELECT TO anon,authenticated USING(active OR (SELECT public.is_admin()));
CREATE POLICY "Own memberships or admin" ON public.memberships FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.redeem_promotion(actor_id uuid,promo_code text,price numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE promo public.promotions;
BEGIN
 IF coalesce(trim(promo_code),'''')='''' THEN RETURN price; END IF;
 SELECT * INTO promo FROM public.promotions WHERE code=upper(trim(promo_code)) FOR UPDATE;
 IF promo.code IS NULL OR NOT promo.active OR promo.expires_at<=now() OR promo.uses>=promo.max_uses OR promo.owner_id=actor_id THEN RAISE EXCEPTION ''This promo or referral code is unavailable.''; END IF;
 INSERT INTO public.promotion_redemptions(code,user_id) VALUES(promo.code,actor_id);
 UPDATE public.promotions SET uses=uses+1 WHERE code=promo.code;
 RETURN round(price*(100-promo.discount_percent)/100,2);
END $$;
REVOKE ALL ON FUNCTION public.redeem_promotion(uuid,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promotion(uuid,text,numeric) TO service_role;

CREATE FUNCTION public.register_team_entry(actor_id uuid,event_id uuid,squad_id uuid,verified_roster jsonb,promo_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE result jsonb; reg public.registrations; price numeric;
BEGIN
 result:=public.register_owned_team(actor_id,event_id,squad_id,verified_roster);
 price:=public.redeem_promotion(actor_id,promo_code,(result->>''amount_due'')::numeric);
 UPDATE public.registrations SET amount_due=price,payment_status=CASE WHEN price=0 THEN ''not_required'' ELSE ''pending'' END WHERE id=(result->>''id'')::uuid RETURNING * INTO reg;
 RETURN to_jsonb(reg);
END $$;
REVOKE ALL ON FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_tournament_registration() RETURNS trigger LANGUAGE plpgsql SET search_path='''' AS $$
DECLARE t public.tournaments;
BEGIN
 SELECT * INTO t FROM public.tournaments WHERE id=NEW.tournament_id FOR UPDATE;
 IF TG_OP=''INSERT'' THEN
  IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) THEN RAISE EXCEPTION ''The bracket has started; registration is closed.''; END IF;
  NEW.amount_due:=t.entry_fee;
  NEW.payment_status:=CASE WHEN NEW.amount_due>0 THEN ''pending'' ELSE ''not_required'' END;
 ELSIF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=t.id) AND (
  NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.amount_due IS DISTINCT FROM OLD.amount_due OR NEW.roster_details IS DISTINCT FROM OLD.roster_details OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.captain_id IS DISTINCT FROM OLD.captain_id) THEN RAISE EXCEPTION ''Team eligibility and roster are locked after bracket generation.'';
 END IF;
 IF NEW.status=''approved'' AND NEW.amount_due>0 AND NEW.payment_status<>''verified'' THEN RAISE EXCEPTION ''Verify payment before approving this team.''; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.membership_action(actor_id uuid,action_name text,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE actor public.profiles; plan public.membership_plans; member public.memberships; minutes integer; price numeric;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>''banned'';
 IF actor.id IS NULL THEN RAISE EXCEPTION ''Account access required.''; END IF;
 IF action_name=''request'' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF (SELECT count(*) FROM public.memberships WHERE user_id=actor.id AND status=''pending'')>=3 THEN RAISE EXCEPTION ''You already have three pending membership requests.''; END IF;
  SELECT * INTO plan FROM public.membership_plans WHERE id=(payload->>''plan_id'')::uuid AND active FOR SHARE;
  IF plan.id IS NULL THEN RAISE EXCEPTION ''This membership plan is unavailable.''; END IF;
  price:=public.redeem_promotion(actor.id,payload->>''promo_code'',plan.price);
  INSERT INTO public.memberships(user_id,plan_id,name,amount_due,duration_days,remaining_minutes,status,starts_at,expires_at)
  VALUES(actor.id,plan.id,plan.name,price,plan.duration_days,plan.gaming_minutes,CASE WHEN price=0 THEN ''active'' ELSE ''pending'' END,CASE WHEN price=0 THEN now() END,CASE WHEN price=0 THEN now()+make_interval(days=>plan.duration_days) END) RETURNING * INTO member;
  RETURN to_jsonb(member);
 END IF;
 IF actor.role<>''admin'' THEN RAISE EXCEPTION ''Administrator access required.''; END IF;
 SELECT * INTO member FROM public.memberships WHERE id=(payload->>''membership_id'')::uuid FOR UPDATE;
 IF member.id IS NULL THEN RAISE EXCEPTION ''Membership not found.''; END IF;
 IF action_name=''verify'' THEN
  IF member.status<>''pending'' THEN RAISE EXCEPTION ''Only pending memberships can be verified.''; END IF;
  UPDATE public.memberships SET status=''active'',starts_at=now(),expires_at=now()+make_interval(days=>duration_days),verified_by=actor.id WHERE id=member.id RETURNING * INTO member;
 ELSIF action_name=''use_minutes'' THEN
  minutes:=(payload->>''minutes'')::integer;
  IF member.status<>''active'' OR member.expires_at<=now() OR minutes IS NULL OR minutes<=0 OR minutes>member.remaining_minutes OR length(trim(coalesce(payload->>''note'','''')))=0 THEN RAISE EXCEPTION ''Enter valid minutes and a note for an active pass.''; END IF;
  UPDATE public.memberships SET remaining_minutes=remaining_minutes-minutes WHERE id=member.id RETURNING * INTO member;
  INSERT INTO public.membership_usage(membership_id,actor_id,minutes,note) VALUES(member.id,actor.id,minutes,left(payload->>''note'',500));
 ELSIF action_name=''cancel'' THEN
  IF member.status<>''pending'' THEN RAISE EXCEPTION ''Only pending requests can be cancelled.''; END IF;
  UPDATE public.memberships SET status=''cancelled'' WHERE id=member.id RETURNING * INTO member;
 ELSE RAISE EXCEPTION ''Unknown membership action.'';
 END IF;
 RETURN to_jsonb(member);
END $$;
REVOKE ALL ON FUNCTION public.membership_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.membership_action(uuid,text,jsonb) TO service_role;
CREATE TRIGGER membership_admin_notice AFTER INSERT ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();

CREATE TABLE public.site_content (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN(''sponsor'',''gallery'',''stream'')),
 title text NOT NULL, url text NOT NULL, image_url text, published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_content FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.site_content TO anon,authenticated;
GRANT ALL ON public.site_content TO service_role;
CREATE POLICY "Published growth content" ON public.site_content FOR SELECT TO anon,authenticated USING(published OR (SELECT public.is_admin()));
NOTIFY pgrst,''reload schema'';

ALTER TABLE public.profiles ADD COLUMN last_active_at timestamptz;
CREATE INDEX profiles_active_idx ON public.profiles(last_active_at) WHERE last_active_at IS NOT NULL;
CREATE FUNCTION public.arena_analytics() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$
 SELECT jsonb_build_object(
  ''players'',(SELECT count(*) FROM public.profiles WHERE role<>''banned''),
  ''active_players_30d'',(SELECT count(*) FROM public.profiles WHERE role<>''banned'' AND last_active_at>now()-interval ''30 days''),
  ''teams'',(SELECT count(*) FROM public.teams),
  ''tournaments'',(SELECT count(*) FROM public.tournaments WHERE status<>''draft''),
  ''registration_revenue'',(SELECT coalesce(sum(amount_due),0) FROM public.registrations WHERE payment_status=''verified''),
  ''membership_revenue'',(SELECT coalesce(sum(amount_due),0) FROM public.memberships WHERE status=''active''),
  ''approved_teams'',(SELECT count(*) FROM public.registrations WHERE status=''approved''),
  ''checked_in_teams'',(SELECT count(*) FROM public.registrations WHERE checked_in),
  ''no_shows'',(SELECT count(*) FROM public.registrations WHERE no_show),
  ''peak_match_hours'',(SELECT coalesce(jsonb_agg(row),''[]''::jsonb) FROM(SELECT extract(hour FROM scheduled_time AT TIME ZONE ''Asia/Karachi'')::integer AS hour,count(*) AS matches FROM public.match_history GROUP BY hour ORDER BY matches DESC LIMIT 5) row)
 );
$$;
REVOKE ALL ON FUNCTION public.arena_analytics() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arena_analytics() TO service_role;
']);

-- 20261013111506_competition_pagination_and_guards.sql
CREATE INDEX match_history_roster_idx ON public.match_history USING gin(roster jsonb_path_ops);
CREATE INDEX registrations_roster_idx ON public.registrations USING gin(roster_details jsonb_path_ops);
CREATE FUNCTION public.read_faceit_ranking(page_number integer,page_size integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH eligible AS(
  SELECT board.* FROM public.faceit_leaderboard board WHERE
  NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.faceit_id=board.faceit_id AND p.role='banned') AND (
   EXISTS(SELECT 1 FROM public.profiles p WHERE p.faceit_id=board.faceit_id AND p.role<>'banned') OR
   EXISTS(SELECT 1 FROM public.registrations r JOIN public.tournaments t ON t.id=r.tournament_id WHERE r.status='approved' AND t.status<>'draft' AND r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id',board.faceit_id)))
  )
 ), ranked AS(SELECT * FROM eligible ORDER BY elo DESC,win_rate DESC NULLS LAST,kd_ratio DESC NULLS LAST,nickname,faceit_id LIMIT greatest(1,least(page_size,100)) OFFSET greatest(0,page_number-1)*greatest(1,least(page_size,100)))
 SELECT jsonb_build_object('players',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM ranked r),'total',(SELECT count(*) FROM eligible),'page',page_number);
$$;
REVOKE ALL ON FUNCTION public.read_faceit_ranking(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_faceit_ranking(integer,integer) TO anon,authenticated,service_role;

CREATE FUNCTION public.guard_competition_settings() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (NEW.min_level IS DISTINCT FROM OLD.min_level OR NEW.max_level IS DISTINCT FROM OLD.max_level OR NEW.game IS DISTINCT FROM OLD.game OR NEW.bracket_type IS DISTINCT FROM OLD.bracket_type) AND EXISTS(SELECT 1 FROM public.registrations WHERE tournament_id=OLD.id AND status='approved') THEN RAISE EXCEPTION 'Eligibility and bracket type are fixed after team approval.'; END IF;
 IF (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.checkin_open IS DISTINCT FROM OLD.checkin_open OR NEW.checkin_close IS DISTINCT FROM OLD.checkin_close) AND EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=OLD.id) THEN RAISE EXCEPTION 'Competition dates are fixed after the bracket starts.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_competition_settings() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER competition_settings_guard BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.guard_competition_settings();

CREATE FUNCTION public.dispute_action(actor_id uuid,action_name text,payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; m public.tournament_matches; dispute public.match_disputes;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>'banned';IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.';END IF;
 IF action_name='open' THEN
  SELECT * INTO m FROM public.tournament_matches WHERE id=(payload->>'match_id')::uuid;
  PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
  SELECT * INTO m FROM public.tournament_matches WHERE id=(payload->>'match_id')::uuid FOR UPDATE;
  IF m.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.registrations WHERE id IN(m.team_a,m.team_b) AND captain_id=actor.id) THEN RAISE EXCEPTION 'Only a participating captain can dispute this match.';END IF;
  INSERT INTO public.match_disputes(match_id,reporter_id,reason) VALUES(m.id,actor.id,payload->>'reason');
 ELSE
  IF actor.role<>'admin' OR payload->>'status' NOT IN('resolved','dismissed') OR length(trim(coalesce(payload->>'resolution','')))=0 THEN RAISE EXCEPTION 'Administrator resolution required.';END IF;
  SELECT * INTO dispute FROM public.match_disputes WHERE id=(payload->>'dispute_id')::uuid;
  SELECT * INTO m FROM public.tournament_matches WHERE id=dispute.match_id;
  PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
  UPDATE public.match_disputes SET status=payload->>'status',resolution=left(payload->>'resolution',2000),resolved_by=actor.id,resolved_at=now() WHERE id=dispute.id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'An open dispute is required.';END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.dispute_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_action(uuid,text,jsonb) TO service_role;
CREATE TRIGGER dispute_admin_notice AFTER INSERT ON public.match_disputes FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();
NOTIFY pgrst,'reload schema';

CREATE FUNCTION arena_private.can_view_team(squad_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role<>'banned') AND (
 EXISTS(SELECT 1 FROM public.teams WHERE id=squad_id AND captain_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.team_members WHERE team_id=squad_id AND user_id=auth.uid() AND status='accepted')
 );
$$;
REVOKE ALL ON FUNCTION arena_private.can_view_team(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION arena_private.can_view_team(uuid) TO authenticated,service_role;
DROP POLICY "Own invitations and captain roster" ON public.team_members;
CREATE POLICY "Own invitations and accepted team roster" ON public.team_members FOR SELECT TO authenticated USING(
 arena_private.can_view_team(team_id) OR faceit_id=(SELECT faceit_id FROM public.profiles WHERE id=(SELECT auth.uid())));

CREATE FUNCTION public.delete_arena_post(post_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.match_requests WHERE id=post_id FOR UPDATE;
 DELETE FROM public.match_history WHERE id=post_id;
 DELETE FROM public.match_requests WHERE id=post_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_arena_post(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_arena_post(uuid) TO service_role;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013111506','competition_pagination_and_guards',ARRAY['CREATE INDEX match_history_roster_idx ON public.match_history USING gin(roster jsonb_path_ops);
CREATE INDEX registrations_roster_idx ON public.registrations USING gin(roster_details jsonb_path_ops);
CREATE FUNCTION public.read_faceit_ranking(page_number integer,page_size integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='''' AS $$
 WITH eligible AS(
  SELECT board.* FROM public.faceit_leaderboard board WHERE
  NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.faceit_id=board.faceit_id AND p.role=''banned'') AND (
   EXISTS(SELECT 1 FROM public.profiles p WHERE p.faceit_id=board.faceit_id AND p.role<>''banned'') OR
   EXISTS(SELECT 1 FROM public.registrations r JOIN public.tournaments t ON t.id=r.tournament_id WHERE r.status=''approved'' AND t.status<>''draft'' AND r.roster_details @> jsonb_build_array(jsonb_build_object(''faceit_id'',board.faceit_id)))
  )
 ), ranked AS(SELECT * FROM eligible ORDER BY elo DESC,win_rate DESC NULLS LAST,kd_ratio DESC NULLS LAST,nickname,faceit_id LIMIT greatest(1,least(page_size,100)) OFFSET greatest(0,page_number-1)*greatest(1,least(page_size,100)))
 SELECT jsonb_build_object(''players'',(SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]'') FROM ranked r),''total'',(SELECT count(*) FROM eligible),''page'',page_number);
$$;
REVOKE ALL ON FUNCTION public.read_faceit_ranking(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_faceit_ranking(integer,integer) TO anon,authenticated,service_role;

CREATE FUNCTION public.guard_competition_settings() RETURNS trigger LANGUAGE plpgsql SET search_path='''' AS $$
BEGIN
 IF (NEW.min_level IS DISTINCT FROM OLD.min_level OR NEW.max_level IS DISTINCT FROM OLD.max_level OR NEW.game IS DISTINCT FROM OLD.game OR NEW.bracket_type IS DISTINCT FROM OLD.bracket_type) AND EXISTS(SELECT 1 FROM public.registrations WHERE tournament_id=OLD.id AND status=''approved'') THEN RAISE EXCEPTION ''Eligibility and bracket type are fixed after team approval.''; END IF;
 IF (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.checkin_open IS DISTINCT FROM OLD.checkin_open OR NEW.checkin_close IS DISTINCT FROM OLD.checkin_close) AND EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=OLD.id) THEN RAISE EXCEPTION ''Competition dates are fixed after the bracket starts.''; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_competition_settings() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER competition_settings_guard BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.guard_competition_settings();

CREATE FUNCTION public.dispute_action(actor_id uuid,action_name text,payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE actor public.profiles; m public.tournament_matches; dispute public.match_disputes;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>''banned'';IF actor.id IS NULL THEN RAISE EXCEPTION ''Account access required.'';END IF;
 IF action_name=''open'' THEN
  SELECT * INTO m FROM public.tournament_matches WHERE id=(payload->>''match_id'')::uuid;
  PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
  SELECT * INTO m FROM public.tournament_matches WHERE id=(payload->>''match_id'')::uuid FOR UPDATE;
  IF m.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.registrations WHERE id IN(m.team_a,m.team_b) AND captain_id=actor.id) THEN RAISE EXCEPTION ''Only a participating captain can dispute this match.'';END IF;
  INSERT INTO public.match_disputes(match_id,reporter_id,reason) VALUES(m.id,actor.id,payload->>''reason'');
 ELSE
  IF actor.role<>''admin'' OR payload->>''status'' NOT IN(''resolved'',''dismissed'') OR length(trim(coalesce(payload->>''resolution'','''')))=0 THEN RAISE EXCEPTION ''Administrator resolution required.'';END IF;
  SELECT * INTO dispute FROM public.match_disputes WHERE id=(payload->>''dispute_id'')::uuid;
  SELECT * INTO m FROM public.tournament_matches WHERE id=dispute.match_id;
  PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
  UPDATE public.match_disputes SET status=payload->>''status'',resolution=left(payload->>''resolution'',2000),resolved_by=actor.id,resolved_at=now() WHERE id=dispute.id AND status=''open'';
  IF NOT FOUND THEN RAISE EXCEPTION ''An open dispute is required.'';END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.dispute_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_action(uuid,text,jsonb) TO service_role;
CREATE TRIGGER dispute_admin_notice AFTER INSERT ON public.match_disputes FOR EACH ROW EXECUTE FUNCTION public.queue_arena_notice();
NOTIFY pgrst,''reload schema'';

CREATE FUNCTION arena_private.can_view_team(squad_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='''' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role<>''banned'') AND (
 EXISTS(SELECT 1 FROM public.teams WHERE id=squad_id AND captain_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.team_members WHERE team_id=squad_id AND user_id=auth.uid() AND status=''accepted'')
 );
$$;
REVOKE ALL ON FUNCTION arena_private.can_view_team(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION arena_private.can_view_team(uuid) TO authenticated,service_role;
DROP POLICY "Own invitations and captain roster" ON public.team_members;
CREATE POLICY "Own invitations and accepted team roster" ON public.team_members FOR SELECT TO authenticated USING(
 arena_private.can_view_team(team_id) OR faceit_id=(SELECT faceit_id FROM public.profiles WHERE id=(SELECT auth.uid())));

CREATE FUNCTION public.delete_arena_post(post_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
BEGIN
 PERFORM 1 FROM public.match_requests WHERE id=post_id FOR UPDATE;
 DELETE FROM public.match_history WHERE id=post_id;
 DELETE FROM public.match_requests WHERE id=post_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_arena_post(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_arena_post(uuid) TO service_role;
']);
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
