-- Only the authenticated server path can call this after checking the password.
-- Use the same event lock as result recording, pairing changes and uploads.
CREATE FUNCTION public.reset_competition_bracket(event_id uuid, actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; paths jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN
  RAISE EXCEPTION 'Administrator access required.';
 END IF;
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status NOT IN ('upcoming','ongoing','completed') THEN
  RAISE EXCEPTION 'This tournament cannot reset its bracket.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN
  RAISE EXCEPTION 'There is no bracket to reset.';
 END IF;
 SELECT coalesce(jsonb_agg(card.storage_path),'[]'::jsonb) INTO paths
 FROM public.match_scorecards card JOIN public.tournament_matches match ON match.id=card.match_id
 WHERE match.tournament_id=event_id;
 DELETE FROM public.tournament_matches WHERE tournament_id=event_id;
 UPDATE public.tournaments SET status='upcoming',updated_at=now() WHERE id=event_id;
 RETURN paths;
END $$;
REVOKE ALL ON FUNCTION public.reset_competition_bracket(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reset_competition_bracket(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
