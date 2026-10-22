-- User approved deletion of NEW posts at the selected match time; old records are retained.
ALTER TABLE public.match_requests ADD COLUMN delete_on_expiry boolean NOT NULL DEFAULT false;
CREATE INDEX match_requests_cleanup_idx ON public.match_requests (scheduled_time) WHERE delete_on_expiry;
CREATE OR REPLACE FUNCTION public.post_arena_match(payload jsonb, host_phone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE m public.match_requests;
BEGIN
  IF host_phone IS NULL OR host_phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Enter a valid phone number.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(host_phone, 0));
  IF (SELECT count(*) FROM public.match_contacts c JOIN public.match_requests r ON r.id=c.match_id WHERE c.phone=host_phone AND r.scheduled_time > now()) >= 3 THEN RAISE EXCEPTION 'This number already has three upcoming match posts.'; END IF;
  INSERT INTO public.match_requests (creator_id,host_name,title,type,description,scheduled_time,min_faceit_level,max_faceit_level,target_players_count,delete_on_expiry)
  VALUES ((payload->>'creator_id')::uuid,payload->>'host_name',payload->>'title',payload->>'type',payload->>'description',(payload->>'scheduled_time')::timestamptz,(payload->>'min_faceit_level')::integer,(payload->>'max_faceit_level')::integer,(payload->>'target_players_count')::integer,true) RETURNING * INTO m;
  INSERT INTO public.match_contacts (match_id,phone) VALUES (m.id,host_phone);
  RETURN to_jsonb(m);
END;
$$;
REVOKE ALL ON FUNCTION public.post_arena_match(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_arena_match(jsonb,text) TO service_role;
NOTIFY pgrst, 'reload schema';

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('delete-expired-new-match-posts', '* * * * *', $job$DELETE FROM public.match_requests WHERE delete_on_expiry AND scheduled_time <= now();$job$);
