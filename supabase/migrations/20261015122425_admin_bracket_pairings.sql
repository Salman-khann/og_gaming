-- Only the server may rearrange an unplayed bracket. Keep match IDs and the
-- progression graph intact, and use the same event lock as result recording.
CREATE FUNCTION public.set_competition_pairings(event_id uuid, pairings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  event public.tournaments;
  opening_count integer;
  old_ids uuid[];
  new_ids uuid[];
  distinct_count integer;
  eligible_count integer;
  item jsonb;
BEGIN
  SELECT * INTO event FROM public.tournaments WHERE id = event_id FOR UPDATE;
  IF event.id IS NULL OR event.status NOT IN ('upcoming', 'ongoing') THEN
    RAISE EXCEPTION 'This tournament cannot change its matchups.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id = event_id
    AND (status = 'completed' OR score_a IS NOT NULL OR score_b IS NOT NULL)) THEN
    RAISE EXCEPTION 'Matchups are locked because scores have already been recorded.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id = event_id AND node_key IS NULL) THEN
    RAISE EXCEPTION 'This legacy bracket cannot change its opening matchups.';
  END IF;
  SELECT count(*) INTO opening_count FROM public.tournament_matches
    WHERE tournament_id = event_id AND bracket = 'winners' AND round = 1;
  IF opening_count = 0 OR jsonb_typeof(pairings) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Opening matchups are required.';
  END IF;
  IF jsonb_array_length(pairings) <> opening_count THEN
    RAISE EXCEPTION 'The number of opening matches does not match the bracket.';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(pairings) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT (item ? 'team_a' AND item ? 'team_b')
      OR (item->>'team_a' IS NULL AND item->>'team_b' IS NULL) THEN
      RAISE EXCEPTION 'Every opening match needs at least one team.';
    END IF;
  END LOOP;
  SELECT coalesce(array_agg(team ORDER BY team), '{}'::uuid[]) INTO old_ids
    FROM public.tournament_matches m
    CROSS JOIN LATERAL unnest(ARRAY[m.team_a, m.team_b]) AS entrants(team)
    WHERE m.tournament_id = event_id AND m.bracket = 'winners' AND m.round = 1 AND team IS NOT NULL;
  SELECT coalesce(array_agg(team ORDER BY team), '{}'::uuid[]), count(DISTINCT team)
    INTO new_ids, distinct_count FROM jsonb_array_elements(pairings) AS pairs(value)
    CROSS JOIN LATERAL (VALUES ((value->>'team_a')::uuid), ((value->>'team_b')::uuid)) AS entrants(team)
    WHERE team IS NOT NULL;
  IF new_ids IS DISTINCT FROM old_ids OR distinct_count <> cardinality(new_ids) THEN
    RAISE EXCEPTION 'Assign every existing entrant exactly once; no duplicate or outside teams.';
  END IF;
  SELECT count(*) INTO eligible_count FROM public.registrations r
    WHERE r.id = ANY(new_ids) AND r.tournament_id = event_id AND r.status = 'approved'
      AND r.checked_in AND NOT r.no_show AND (r.amount_due = 0 OR r.payment_status = 'verified')
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.role = 'banned'
        AND (p.id = r.captain_id OR r.roster_details @> jsonb_build_array(jsonb_build_object('faceit_id', p.faceit_id))));
  IF eligible_count <> cardinality(new_ids) THEN
    RAISE EXCEPTION 'A bracket team is no longer eligible. Check approval, check-in and payment.';
  END IF;
  -- Clear only derived, unplayed results (including automatic byes), then
  -- propagate the new opening assignments through the existing graph.
  UPDATE public.tournament_matches SET team_a = NULL, team_b = NULL,
    winner_id = NULL, score_a = NULL, score_b = NULL, status = 'pending'
    WHERE tournament_id = event_id;
  UPDATE public.tournament_matches m SET team_a = (pairs.value->>'team_a')::uuid,
    team_b = (pairs.value->>'team_b')::uuid
    FROM jsonb_array_elements(pairings) WITH ORDINALITY AS pairs(value, position)
    WHERE m.tournament_id = event_id AND m.bracket = 'winners' AND m.round = 1 AND m.position = pairs.position;
  UPDATE public.tournaments SET updated_at = now() WHERE id = event_id;
  PERFORM public.advance_competition(event_id);
END $$;
REVOKE ALL ON FUNCTION public.set_competition_pairings(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_competition_pairings(uuid, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
