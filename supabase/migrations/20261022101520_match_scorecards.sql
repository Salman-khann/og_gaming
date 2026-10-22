CREATE TABLE public.match_scorecards (
 match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
 map_number integer NOT NULL CHECK (map_number BETWEEN 1 AND 3),
 storage_path text NOT NULL UNIQUE,
 score_a integer NOT NULL, score_b integer NOT NULL,
 team_a uuid NOT NULL, team_b uuid NOT NULL,
 uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 uploaded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (match_id,map_number)
);
ALTER TABLE public.match_scorecards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_scorecards FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.match_scorecards TO service_role;
-- Storage objects are private. Public viewing goes through the match's RLS check.
CREATE FUNCTION public.save_match_scorecard(game_id uuid,map_no integer,object_path text,expected_a integer,expected_b integer,actor_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m public.tournament_matches; previous_path text;
BEGIN
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Match not found.'; END IF;
 PERFORM 1 FROM public.tournaments WHERE id=m.tournament_id FOR UPDATE;
 SELECT * INTO m FROM public.tournament_matches WHERE id=game_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 IF m.status<>'completed' OR m.team_a IS NULL OR m.team_b IS NULL OR m.score_a IS DISTINCT FROM expected_a OR m.score_b IS DISTINCT FROM expected_b THEN RAISE EXCEPTION 'The result changed. Reload the match before uploading.'; END IF;
 IF map_no IS NULL OR map_no NOT BETWEEN 1 AND least(3,m.score_a+m.score_b) THEN RAISE EXCEPTION 'Select a map played in this series.'; END IF;
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
REVOKE ALL ON FUNCTION public.save_match_scorecard(uuid,integer,text,integer,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_match_scorecard(uuid,integer,text,integer,integer,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
