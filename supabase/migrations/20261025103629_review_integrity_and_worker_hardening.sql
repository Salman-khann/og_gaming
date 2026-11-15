-- Session-bound team paging; callers cannot supply another player's identity.
CREATE OR REPLACE FUNCTION public.read_my_teams(page_number integer DEFAULT 1,page_size integer DEFAULT 25) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; result jsonb;
BEGIN
 SELECT id,faceit_id INTO actor.id,actor.faceit_id FROM public.profiles WHERE id=(SELECT auth.uid()) AND role<>'banned';
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.'; END IF;
 IF page_number IS NULL OR page_number NOT BETWEEN 1 AND 10000 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid team page.'; END IF;
 WITH ids AS (
  SELECT id FROM public.teams WHERE captain_id=actor.id
  UNION SELECT team_id FROM public.team_members WHERE user_id=actor.id AND status='accepted'
  UNION SELECT team_id FROM public.team_members WHERE faceit_id=actor.faceit_id AND status='invited' AND expires_at>now()
 ), eligible AS MATERIALIZED (
  SELECT t.id,t.name,t.captain_id,t.created_at FROM public.teams t JOIN ids ON ids.id=t.id
 ), selected AS MATERIALIZED (
  SELECT * FROM eligible ORDER BY (captain_id=actor.id) DESC,created_at DESC,id
  LIMIT page_size OFFSET (page_number-1)*page_size
 ), roster AS (
  SELECT m.id,m.team_id,m.user_id,m.faceit_id,m.nickname,m.status,m.expires_at,m.created_at
  FROM public.team_members m JOIN selected t ON t.id=m.team_id
 )
 SELECT jsonb_build_object(
  'teams',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY (t.captain_id=actor.id) DESC,t.created_at DESC,t.id) FROM selected t),'[]'::jsonb),
  'members',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at,m.id) FROM roster m),'[]'::jsonb),
  'page',page_number,'total',(SELECT count(*) FROM eligible),
  'has_more',(SELECT count(*) FROM eligible)>page_number*page_size
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.read_my_teams(integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.read_my_teams(integer,integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.create_competition_bracket(event_id uuid,graph jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; item jsonb; seed uuid; teams integer; eligible_ids uuid[];
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN('upcoming','ongoing') OR EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN RAISE EXCEPTION 'This tournament cannot generate another bracket.'; END IF;
 SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO eligible_ids FROM public.eligible_registrations(event_id);
 teams:=cardinality(eligible_ids);
 IF teams<2 THEN RAISE EXCEPTION 'At least two approved teams with any required payment verified are required.'; END IF;
 IF jsonb_array_length(graph) NOT BETWEEN 1 AND 256 THEN RAISE EXCEPTION 'Invalid bracket graph.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(graph) LOOP
  FOREACH seed IN ARRAY ARRAY[(item->>'team_a')::uuid,(item->>'team_b')::uuid] LOOP
   IF seed IS NOT NULL AND NOT (seed=ANY(eligible_ids)) THEN RAISE EXCEPTION 'A bracket team is no longer eligible.'; END IF;
  END LOOP;
  INSERT INTO public.tournament_matches(tournament_id,bracket,node_key,round,position,team_a,team_b,source_a,source_b,outcome_a,outcome_b)
  VALUES(event_id,item->>'bracket',item->>'key',(item->>'round')::integer,(item->>'position')::integer,(item->>'team_a')::uuid,(item->>'team_b')::uuid,item->>'source_a',item->>'source_b',item->>'outcome_a',item->>'outcome_b');
 END LOOP;
 IF (SELECT count(DISTINCT seed_id) FROM public.tournament_matches m CROSS JOIN LATERAL unnest(ARRAY[m.team_a,m.team_b]) seed_id WHERE m.tournament_id=event_id AND seed_id IS NOT NULL)<>teams THEN RAISE EXCEPTION 'The entrant list changed; regenerate the bracket.'; END IF;
 UPDATE public.tournaments SET status='ongoing',updated_at=now() WHERE id=event_id;
 PERFORM public.advance_competition(event_id);
END $$;


CREATE OR REPLACE FUNCTION public.purge_old_operations() RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE removed integer;
BEGIN
 DELETE FROM public.notifications_log WHERE created_at<now()-interval '30 days' AND (lease_until IS NULL OR lease_until<now());
 GET DIAGNOSTICS removed=ROW_COUNT;
 DELETE FROM public.contact_reveals WHERE created_at<now()-interval '30 days';
 DELETE FROM public.storage_cleanup_jobs WHERE status IN('completed','retained') AND completed_at<now()-interval '30 days' AND lease_until IS NULL;
 RETURN removed;
END $$;


-- Corrected/cleared results should not retain private screenshots indefinitely.
CREATE FUNCTION arena_private.expire_stale_scorecards() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.match_scorecards s WHERE s.match_id=NEW.id AND (
  NEW.status<>'completed' OR s.score_a IS DISTINCT FROM NEW.score_a OR s.score_b IS DISTINCT FROM NEW.score_b
  OR s.team_a IS DISTINCT FROM NEW.team_a OR s.team_b IS DISTINCT FROM NEW.team_b);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION arena_private.expire_stale_scorecards() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER expire_stale_scorecards AFTER UPDATE OF status,score_a,score_b,team_a,team_b ON public.tournament_matches
 FOR EACH ROW EXECUTE FUNCTION arena_private.expire_stale_scorecards();

-- Review signals only: free-text identity and unverified contacts are not proof.
CREATE FUNCTION public.registration_review_flags(actor_id uuid,entry_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF entry_ids IS NULL OR cardinality(entry_ids)>50 THEN RAISE EXCEPTION 'Invalid review page.'; END IF;
 WITH targets AS MATERIALIZED(SELECT * FROM public.registrations WHERE id=ANY(entry_ids) AND status<>'rejected'),
 roster AS MATERIALIZED(
  SELECT r.id,r.tournament_id,r.team_name,lower(trim(p->>'nickname')) AS nickname,nullif(lower(trim(p->>'game_id')),'') AS game_id
  FROM public.registrations r CROSS JOIN LATERAL jsonb_array_elements(r.roster_details) p
  WHERE r.status<>'rejected' AND r.tournament_id IN(SELECT tournament_id FROM targets)
 ), issues AS (
  SELECT a.id,'Player name "'||a.nickname||'" also appears on '||b.team_name AS warning
  FROM roster a JOIN targets t ON t.id=a.id JOIN roster b ON a.tournament_id=b.tournament_id AND a.id<>b.id AND a.nickname=b.nickname AND a.nickname<>''
  UNION
  SELECT a.id,'A game ID/profile link also appears on '||b.team_name
  FROM roster a JOIN targets t ON t.id=a.id JOIN roster b ON a.tournament_id=b.tournament_id AND a.id<>b.id AND a.game_id=b.game_id
  UNION
  SELECT a.id,'Captain contact also appears on '||b.team_name
  FROM targets a JOIN public.registration_contacts ca ON ca.registration_id=a.id
  JOIN public.registrations b ON a.tournament_id=b.tournament_id AND a.id<>b.id AND b.status<>'rejected'
  JOIN public.registration_contacts cb ON cb.registration_id=b.id AND (ca.phone=cb.phone OR lower(ca.email)=lower(cb.email))
  UNION
  SELECT t.id,'A roster name matches a banned profile; verify identity before approval.'
  FROM targets t JOIN roster r ON r.id=t.id JOIN public.profiles p ON p.role='banned' AND lower(trim(p.faceit_nickname))=r.nickname
  UNION
  SELECT t.id,'Captain contact matches a previous application linked to a banned account; verify ownership.'
  FROM targets t JOIN public.registration_contacts c ON c.registration_id=t.id
  JOIN public.registration_contacts old ON old.phone=c.phone OR lower(old.email)=lower(c.email)
  JOIN public.registrations prior ON prior.id=old.registration_id
  JOIN public.profiles p ON p.id=prior.captain_id AND p.role='banned'
 ), grouped AS (SELECT id,(array_agg(DISTINCT warning ORDER BY warning))[1:10] AS warnings FROM issues GROUP BY id)
 SELECT coalesce(jsonb_object_agg(id::text,to_jsonb(warnings)),'{}'::jsonb) INTO result FROM grouped;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.registration_review_flags(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registration_review_flags(uuid,uuid[]) TO service_role;
NOTIFY pgrst,'reload schema';
