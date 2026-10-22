-- Audit follow-up: preserve existing grants on replaced functions.
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

CREATE OR REPLACE FUNCTION public.initialize_arena_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.profiles;
BEGIN
  IF NEW.scheduled_time IS NULL OR NEW.scheduled_time <= now() THEN RAISE EXCEPTION 'A future match time is required.'; END IF;
  IF NEW.creator_id IS NOT NULL THEN
    SELECT * INTO p FROM public.profiles WHERE id = NEW.creator_id AND role <> 'banned';
    IF p.id IS NULL THEN RAISE EXCEPTION 'This account cannot post matches.'; END IF;
    IF NEW.type<>'team_vs_team' AND ((p.faceit_id IS NULL AND (NEW.min_faceit_level>1 OR NEW.max_faceit_level<10)) OR (p.faceit_id IS NOT NULL AND (p.faceit_level IS NULL OR p.faceit_level NOT BETWEEN NEW.min_faceit_level AND NEW.max_faceit_level))) THEN RAISE EXCEPTION 'Connect FACEIT and meet the level range before hosting a restricted match.'; END IF;
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

ALTER TABLE public.profiles ADD COLUMN faceit_refresh_attempted_at timestamptz;
CREATE INDEX profiles_faceit_refresh_idx ON public.profiles(faceit_refresh_attempted_at NULLS FIRST,id) WHERE faceit_id IS NOT NULL AND role<>'banned';

CREATE FUNCTION public.faceit_refresh_candidates(batch_size integer) RETURNS TABLE(faceit_id text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH ids AS (
  SELECT p.faceit_id FROM public.profiles p WHERE p.faceit_id IS NOT NULL AND p.role<>'banned'
  UNION
  SELECT entry->>'faceit_id' FROM public.registrations r JOIN public.tournaments t ON t.id=r.tournament_id CROSS JOIN LATERAL jsonb_array_elements(r.roster_details) entry WHERE r.status='approved' AND t.status<>'draft' AND entry->>'faceit_id' IS NOT NULL
 ) SELECT ids.faceit_id FROM ids LEFT JOIN public.faceit_leaderboard b ON b.faceit_id=ids.faceit_id
 WHERE NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.faceit_id=ids.faceit_id AND p.role='banned') AND (b.updated_at IS NULL OR b.updated_at<=now()-interval '15 minutes')
 ORDER BY b.updated_at NULLS FIRST,ids.faceit_id LIMIT greatest(1,least(batch_size,8));
$$;
REVOKE ALL ON FUNCTION public.faceit_refresh_candidates(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.faceit_refresh_candidates(integer) TO service_role;
NOTIFY pgrst,'reload schema';
