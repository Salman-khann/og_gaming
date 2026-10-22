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
