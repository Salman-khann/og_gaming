BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
-- Retire optional product features without erasing historical records.
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
  IF target.id IS NULL OR payload->>'role' NOT IN('player','admin','banned') THEN RAISE EXCEPTION 'A player and role are required.'; END IF;
  IF target.id=actor.id AND payload->>'role'<>'admin' THEN RAISE EXCEPTION 'You cannot remove your own administrator access.'; END IF;
  IF target.role='admin' AND payload->>'role'<>'admin' AND (SELECT count(*) FROM public.profiles WHERE role='admin')<=1 THEN RAISE EXCEPTION 'Keep at least one administrator.'; END IF;
  UPDATE public.profiles SET role=payload->>'role',updated_at=now() WHERE id=target.id;
  RETURN jsonb_build_object('updated',true);
 END IF;
 RAISE EXCEPTION 'Unknown community action.';
END $$;
CREATE OR REPLACE FUNCTION public.record_competition_result(game_id uuid,a_score integer,b_score integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
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
CREATE OR REPLACE FUNCTION public.arena_analytics() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'players',(SELECT count(*) FROM public.profiles WHERE role<>'banned'),
  'active_players_30d',(SELECT count(*) FROM public.profiles WHERE role<>'banned' AND last_active_at>now()-interval '30 days'),
  'teams',(SELECT count(*) FROM public.teams),
  'tournaments',(SELECT count(*) FROM public.tournaments WHERE status<>'draft'),
  'registration_revenue',(SELECT coalesce(sum(amount_due),0) FROM public.registrations WHERE payment_status='verified'),
  'approved_teams',(SELECT count(*) FROM public.registrations WHERE status='approved'),
  'checked_in_teams',(SELECT count(*) FROM public.registrations WHERE checked_in),
  'no_shows',(SELECT count(*) FROM public.registrations WHERE no_show),
  'peak_match_hours',(SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM(SELECT extract(hour FROM scheduled_time AT TIME ZONE 'Asia/Karachi')::integer AS hour,count(*) AS matches FROM public.match_history GROUP BY hour ORDER BY matches DESC LIMIT 5) row)
 );
$$;
DROP TRIGGER membership_admin_notice ON public.memberships;
DROP TRIGGER dispute_admin_notice ON public.match_disputes;
DROP FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text);
DROP FUNCTION public.membership_action(uuid,text,jsonb);
DROP FUNCTION public.redeem_promotion(uuid,text,numeric);
DROP FUNCTION public.dispute_action(uuid,text,jsonb);
CREATE SCHEMA arena_retired_features;
REVOKE ALL ON SCHEMA arena_retired_features FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.membership_usage SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.membership_usage FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.memberships SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.memberships FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.membership_plans SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.membership_plans FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.promotion_redemptions SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.promotion_redemptions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.promotions SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.promotions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.match_disputes SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.match_disputes FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.admin_audit SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.admin_audit FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE arena_retired_features.notifications_log AS SELECT * FROM public.notifications_log WHERE event_type LIKE 'memberships:%' OR event_type LIKE 'match_disputes:%';
ALTER TABLE arena_retired_features.notifications_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arena_retired_features.notifications_log FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM public.notifications_log WHERE event_type LIKE 'memberships:%' OR event_type LIKE 'match_disputes:%';
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261013130626','remove_memberships_promotions_disputes_audit',ARRAY['-- Retire optional product features without erasing historical records.
CREATE OR REPLACE FUNCTION public.community_action(actor_id uuid, action_name text, payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE actor public.profiles; t public.teams; member public.team_members; event public.tournaments; reg public.registrations; target public.profiles; result jsonb;
BEGIN
 SELECT * INTO actor FROM public.profiles WHERE id=actor_id AND role<>''banned'';
 IF actor.id IS NULL THEN RAISE EXCEPTION ''Account access required.''; END IF;
 IF action_name=''create_team'' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
  IF (SELECT count(*) FROM public.team_members WHERE user_id=actor.id AND status=''accepted'')>=5 THEN RAISE EXCEPTION ''You already belong to five teams.''; END IF;
  IF actor.faceit_id IS NULL THEN RAISE EXCEPTION ''Sign in with FACEIT before creating a verified team.''; END IF;
  IF (SELECT count(*) FROM public.teams WHERE captain_id=actor.id)>=5 THEN RAISE EXCEPTION ''You already captain five teams.''; END IF;
  INSERT INTO public.teams(name,captain_id) VALUES(left(trim(payload->>''name''),80),actor.id) RETURNING * INTO t;
  IF length(t.name)=0 THEN RAISE EXCEPTION ''A team name is required.''; END IF;
  INSERT INTO public.team_members(team_id,user_id,faceit_id,nickname,status) VALUES(t.id,actor.id,actor.faceit_id,actor.faceit_nickname,''accepted'');
  RETURN to_jsonb(t);
 ELSIF action_name IN(''invite'',''remove_member'',''accept'') THEN
  IF action_name=''accept'' THEN
   -- Serialize the per-player limit across invitations to different teams.
   PERFORM 1 FROM public.profiles WHERE id=actor.id FOR UPDATE;
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
  IF target.id IS NULL OR payload->>''role'' NOT IN(''player'',''admin'',''banned'') THEN RAISE EXCEPTION ''A player and role are required.''; END IF;
  IF target.id=actor.id AND payload->>''role''<>''admin'' THEN RAISE EXCEPTION ''You cannot remove your own administrator access.''; END IF;
  IF target.role=''admin'' AND payload->>''role''<>''admin'' AND (SELECT count(*) FROM public.profiles WHERE role=''admin'')<=1 THEN RAISE EXCEPTION ''Keep at least one administrator.''; END IF;
  UPDATE public.profiles SET role=payload->>''role'',updated_at=now() WHERE id=target.id;
  RETURN jsonb_build_object(''updated'',true);
 END IF;
 RAISE EXCEPTION ''Unknown community action.'';
END $$;
CREATE OR REPLACE FUNCTION public.record_competition_result(game_id uuid,a_score integer,b_score integer) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION ''Match not found.''; END IF;
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
CREATE OR REPLACE FUNCTION public.arena_analytics() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $$
 SELECT jsonb_build_object(
  ''players'',(SELECT count(*) FROM public.profiles WHERE role<>''banned''),
  ''active_players_30d'',(SELECT count(*) FROM public.profiles WHERE role<>''banned'' AND last_active_at>now()-interval ''30 days''),
  ''teams'',(SELECT count(*) FROM public.teams),
  ''tournaments'',(SELECT count(*) FROM public.tournaments WHERE status<>''draft''),
  ''registration_revenue'',(SELECT coalesce(sum(amount_due),0) FROM public.registrations WHERE payment_status=''verified''),
  ''approved_teams'',(SELECT count(*) FROM public.registrations WHERE status=''approved''),
  ''checked_in_teams'',(SELECT count(*) FROM public.registrations WHERE checked_in),
  ''no_shows'',(SELECT count(*) FROM public.registrations WHERE no_show),
  ''peak_match_hours'',(SELECT coalesce(jsonb_agg(row),''[]''::jsonb) FROM(SELECT extract(hour FROM scheduled_time AT TIME ZONE ''Asia/Karachi'')::integer AS hour,count(*) AS matches FROM public.match_history GROUP BY hour ORDER BY matches DESC LIMIT 5) row)
 );
$$;
DROP TRIGGER membership_admin_notice ON public.memberships;
DROP TRIGGER dispute_admin_notice ON public.match_disputes;
DROP FUNCTION public.register_team_entry(uuid,uuid,uuid,jsonb,text);
DROP FUNCTION public.membership_action(uuid,text,jsonb);
DROP FUNCTION public.redeem_promotion(uuid,text,numeric);
DROP FUNCTION public.dispute_action(uuid,text,jsonb);
CREATE SCHEMA arena_retired_features;
REVOKE ALL ON SCHEMA arena_retired_features FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.membership_usage SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.membership_usage FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.memberships SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.memberships FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.membership_plans SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.membership_plans FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.promotion_redemptions SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.promotion_redemptions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.promotions SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.promotions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.match_disputes SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.match_disputes FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.admin_audit SET SCHEMA arena_retired_features;
REVOKE ALL ON arena_retired_features.admin_audit FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE arena_retired_features.notifications_log AS SELECT * FROM public.notifications_log WHERE event_type LIKE ''memberships:%'' OR event_type LIKE ''match_disputes:%'';
ALTER TABLE arena_retired_features.notifications_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON arena_retired_features.notifications_log FROM PUBLIC,anon,authenticated,service_role;
DELETE FROM public.notifications_log WHERE event_type LIKE ''memberships:%'' OR event_type LIKE ''match_disputes:%'';
NOTIFY pgrst,''reload schema'';
']);
COMMIT;
SELECT version FROM supabase_migrations.schema_migrations WHERE version='20261013130626';
