BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Server-only result reversal. The event lock serializes all bracket mutations.
CREATE OR REPLACE FUNCTION public.clear_competition_result(game_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF event_status NOT IN ('ongoing','completed') OR m.node_key IS NULL OR m.status<>'completed' THEN
  RAISE EXCEPTION 'Only a completed bracket match can be cleared.';
 END IF;
 IF EXISTS (
  WITH RECURSIVE downstream AS (
   SELECT node_key,status FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
   UNION
   SELECT n.node_key,n.status FROM public.tournament_matches n JOIN downstream d ON (n.source_a=d.node_key OR n.source_b=d.node_key) WHERE n.tournament_id=m.tournament_id
  ) SELECT 1 FROM downstream WHERE status='completed'
 ) THEN RAISE EXCEPTION 'A later match has finished; this result is locked.'; END IF;
 -- Remove derived entrants and bye winners before propagating the cleared graph.
 WITH RECURSIVE downstream AS (
  SELECT node_key FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION
  SELECT n.node_key FROM public.tournament_matches n JOIN downstream d ON (n.source_a=d.node_key OR n.source_b=d.node_key) WHERE n.tournament_id=m.tournament_id
 ) UPDATE public.tournament_matches SET
   team_a=CASE WHEN source_a IS NULL THEN team_a ELSE NULL END,
   team_b=CASE WHEN source_b IS NULL THEN team_b ELSE NULL END,
   status='pending',winner_id=NULL,score_a=NULL,score_b=NULL
 WHERE tournament_id=m.tournament_id AND node_key IN (SELECT node_key FROM downstream);
 UPDATE public.tournament_matches SET score_a=NULL,score_b=NULL,winner_id=NULL,status='pending' WHERE id=m.id;
 UPDATE public.tournaments SET status='ongoing',updated_at=now() WHERE id=m.tournament_id;
 PERFORM public.advance_competition(m.tournament_id);
END $$;
REVOKE ALL ON FUNCTION public.clear_competition_result(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clear_competition_result(uuid) TO service_role;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261022093653','bracket_result_clear',ARRAY['-- Server-only result reversal. The event lock serializes all bracket mutations.
CREATE OR REPLACE FUNCTION public.clear_competition_result(game_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE m public.tournament_matches; event_status text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 IF m.id IS NULL THEN RAISE EXCEPTION ''Match not found.''; END IF;
 SELECT status INTO event_status FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF event_status NOT IN (''ongoing'',''completed'') OR m.node_key IS NULL OR m.status<>''completed'' THEN
  RAISE EXCEPTION ''Only a completed bracket match can be cleared.'';
 END IF;
 IF EXISTS (
  WITH RECURSIVE downstream AS (
   SELECT node_key,status FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
   UNION
   SELECT n.node_key,n.status FROM public.tournament_matches n JOIN downstream d ON (n.source_a=d.node_key OR n.source_b=d.node_key) WHERE n.tournament_id=m.tournament_id
  ) SELECT 1 FROM downstream WHERE status=''completed''
 ) THEN RAISE EXCEPTION ''A later match has finished; this result is locked.''; END IF;
 -- Remove derived entrants and bye winners before propagating the cleared graph.
 WITH RECURSIVE downstream AS (
  SELECT node_key FROM public.tournament_matches WHERE tournament_id=m.tournament_id AND (source_a=m.node_key OR source_b=m.node_key)
  UNION
  SELECT n.node_key FROM public.tournament_matches n JOIN downstream d ON (n.source_a=d.node_key OR n.source_b=d.node_key) WHERE n.tournament_id=m.tournament_id
 ) UPDATE public.tournament_matches SET
   team_a=CASE WHEN source_a IS NULL THEN team_a ELSE NULL END,
   team_b=CASE WHEN source_b IS NULL THEN team_b ELSE NULL END,
   status=''pending'',winner_id=NULL,score_a=NULL,score_b=NULL
 WHERE tournament_id=m.tournament_id AND node_key IN (SELECT node_key FROM downstream);
 UPDATE public.tournament_matches SET score_a=NULL,score_b=NULL,winner_id=NULL,status=''pending'' WHERE id=m.id;
 UPDATE public.tournaments SET status=''ongoing'',updated_at=now() WHERE id=m.tournament_id;
 PERFORM public.advance_competition(m.tournament_id);
END $$;
REVOKE ALL ON FUNCTION public.clear_competition_result(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.clear_competition_result(uuid) TO service_role;
NOTIFY pgrst,''reload schema'';
']) ON CONFLICT(version) DO NOTHING;
COMMIT;
SELECT has_function_privilege('anon','public.clear_competition_result(uuid)','EXECUTE') AS public_can_clear,has_function_privilege('service_role','public.clear_competition_result(uuid)','EXECUTE') AS server_can_clear;
