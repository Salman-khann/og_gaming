BEGIN;
DO $$
DECLARE m jsonb; match_id uuid; contact_denied boolean := false;
BEGIN
  SET LOCAL ROLE service_role;
  m := public.post_arena_match(jsonb_build_object('title','Rollback guest test','type','gather_5v5','scheduled_time',now()+interval '1 day','min_faceit_level',1,'max_faceit_level',10,'target_players_count',10), '+923000000000');
  match_id := (m->>'id')::uuid;
  IF m->>'creator_id' IS NOT NULL OR m->>'host_name' <> 'Guest host' OR NOT (m->>'delete_on_expiry')::boolean THEN RAISE EXCEPTION 'Guest post initialization failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.match_contacts WHERE match_contacts.match_id = (m->>'id')::uuid) THEN RAISE EXCEPTION 'Missing private contact'; END IF;
  RESET ROLE;
  SET LOCAL ROLE anon;
  IF NOT EXISTS (SELECT 1 FROM public.match_requests WHERE id=match_id) THEN RAISE EXCEPTION 'Upcoming guest match not visible'; END IF;
  BEGIN PERFORM phone FROM public.match_contacts WHERE match_contacts.match_id = (m->>'id')::uuid; EXCEPTION WHEN insufficient_privilege THEN contact_denied := true; END;
  IF NOT contact_denied THEN RAISE EXCEPTION 'Phone leaked to public'; END IF;
  RESET ROLE;
  UPDATE public.match_requests SET scheduled_time=now()-interval '1 minute' WHERE id=match_id;
  SET LOCAL ROLE anon;
  IF EXISTS (SELECT 1 FROM public.match_requests WHERE id=match_id) THEN RAISE EXCEPTION 'Expired guest match remains visible'; END IF;
  RESET ROLE;
  DELETE FROM public.match_requests WHERE delete_on_expiry AND scheduled_time <= now() AND id=match_id;
  IF EXISTS (SELECT 1 FROM public.match_contacts WHERE match_contacts.match_id=(m->>'id')::uuid) THEN RAISE EXCEPTION 'Expiry did not cascade contact removal'; END IF;
END $$;
ROLLBACK;
