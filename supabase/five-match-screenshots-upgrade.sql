BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.match_scorecards DROP CONSTRAINT match_scorecards_map_number_check;
ALTER TABLE public.match_scorecards ADD CONSTRAINT match_scorecards_map_number_check CHECK(map_number BETWEEN 1 AND 5);
CREATE OR REPLACE FUNCTION public.save_match_scorecard(game_id uuid,map_no integer,object_path text,expected_a integer,expected_b integer,actor_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; previous_path text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
 PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF m.status<>'completed' OR m.team_a IS NULL OR m.team_b IS NULL OR m.score_a IS DISTINCT FROM expected_a OR m.score_b IS DISTINCT FROM expected_b THEN RAISE EXCEPTION 'The result changed. Reload the match before uploading.'; END IF;
 IF map_no IS NULL OR map_no NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Choose a screenshot position from 1 to 5.'; END IF;
 IF object_path IS NOT NULL AND (object_path NOT LIKE m.tournament_id::text||'/'||m.id::text||'/%' OR object_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp)$') THEN RAISE EXCEPTION 'Invalid scorecard file.'; END IF;
 SELECT storage_path INTO previous_path FROM public.match_scorecards WHERE match_id=game_id AND map_number=map_no;
 IF object_path IS NULL THEN
  DELETE FROM public.match_scorecards WHERE match_id=game_id AND map_number=map_no;
 ELSE
  INSERT INTO public.match_scorecards(match_id,map_number,storage_path,score_a,score_b,team_a,team_b,uploaded_by)
  VALUES(game_id,map_no,object_path,m.score_a,m.score_b,m.team_a,m.team_b,actor_id)
  ON CONFLICT(match_id,map_number) DO UPDATE SET storage_path=excluded.storage_path,score_a=excluded.score_a,score_b=excluded.score_b,team_a=excluded.team_a,team_b=excluded.team_b,uploaded_by=excluded.uploaded_by,uploaded_at=now();
 END IF;
 RETURN previous_path;
END $$;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261022114408','five_match_screenshots',ARRAY['ALTER TABLE public.match_scorecards DROP CONSTRAINT match_scorecards_map_number_check;
ALTER TABLE public.match_scorecards ADD CONSTRAINT match_scorecards_map_number_check CHECK(map_number BETWEEN 1 AND 5);
CREATE OR REPLACE FUNCTION public.save_match_scorecard(game_id uuid,map_no integer,object_path text,expected_a integer,expected_b integer,actor_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' AS $$
DECLARE m public.tournament_matches; previous_path text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 IF m.id IS NULL THEN RAISE EXCEPTION ''Match not found.''; END IF;
 PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role=''admin'') THEN RAISE EXCEPTION ''Administrator access required.''; END IF;
 IF m.status<>''completed'' OR m.team_a IS NULL OR m.team_b IS NULL OR m.score_a IS DISTINCT FROM expected_a OR m.score_b IS DISTINCT FROM expected_b THEN RAISE EXCEPTION ''The result changed. Reload the match before uploading.''; END IF;
 IF map_no IS NULL OR map_no NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION ''Choose a screenshot position from 1 to 5.''; END IF;
 IF object_path IS NOT NULL AND (object_path NOT LIKE m.tournament_id::text||''/''||m.id::text||''/%'' OR object_path !~ ''^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(png|jpg|webp)$'') THEN RAISE EXCEPTION ''Invalid scorecard file.''; END IF;
 SELECT storage_path INTO previous_path FROM public.match_scorecards WHERE match_id=game_id AND map_number=map_no;
 IF object_path IS NULL THEN
  DELETE FROM public.match_scorecards WHERE match_id=game_id AND map_number=map_no;
 ELSE
  INSERT INTO public.match_scorecards(match_id,map_number,storage_path,score_a,score_b,team_a,team_b,uploaded_by)
  VALUES(game_id,map_no,object_path,m.score_a,m.score_b,m.team_a,m.team_b,actor_id)
  ON CONFLICT(match_id,map_number) DO UPDATE SET storage_path=excluded.storage_path,score_a=excluded.score_a,score_b=excluded.score_b,team_a=excluded.team_a,team_b=excluded.team_b,uploaded_by=excluded.uploaded_by,uploaded_at=now();
 END IF;
 RETURN previous_path;
END $$;
NOTIFY pgrst,''reload schema'';
']);
COMMIT;
SELECT pg_get_constraintdef(oid) AS screenshot_limit FROM pg_constraint WHERE conrelid='public.match_scorecards'::regclass AND conname='match_scorecards_map_number_check';
