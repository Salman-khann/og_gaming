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
