-- Session-bound team paging; callers cannot supply another player's identity.
CREATE FUNCTION public.read_my_teams(page_number integer DEFAULT 1,page_size integer DEFAULT 25) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE actor public.profiles; result jsonb;
BEGIN
 SELECT id,faceit_id INTO actor.id,actor.faceit_id FROM public.profiles WHERE id=(SELECT auth.uid()) AND role<>'banned';
 IF actor.id IS NULL THEN RAISE EXCEPTION 'Account access required.'; END IF;
 IF page_number IS NULL OR page_number NOT BETWEEN 1 AND 10000 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid team page.'; END IF;
 WITH eligible AS MATERIALIZED (
  SELECT t.id,t.name,t.captain_id,t.created_at FROM public.teams t
  WHERE t.captain_id=actor.id OR EXISTS (
   SELECT 1 FROM public.team_members m WHERE m.team_id=t.id AND (
    (m.user_id=actor.id AND m.status='accepted') OR
    (m.faceit_id=actor.faceit_id AND m.status='invited' AND m.expires_at>now())
   )
  )
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

-- No reference FK: jobs must survive deletion of their tournament/match rows.
CREATE TABLE public.storage_cleanup_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket text NOT NULL CHECK(bucket='match-scorecards'),
 object_path text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','processing','completed','retained')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,
 lease_until timestamptz,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(bucket,object_path)
);
ALTER TABLE public.storage_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_cleanup_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.storage_cleanup_jobs TO service_role;
CREATE INDEX storage_cleanup_due_idx ON public.storage_cleanup_jobs(next_attempt_at,created_at) WHERE status IN('pending','processing');

CREATE FUNCTION public.queue_scorecard_cleanup(cleanup_path text,delay_seconds integer DEFAULT 0) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF cleanup_path IS NULL OR cleanup_path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[A-Za-z0-9_-]+\.(png|jpg|webp)$' OR delay_seconds IS NULL OR delay_seconds NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'Invalid cleanup request.'; END IF;
 INSERT INTO public.storage_cleanup_jobs AS jobs(bucket,object_path,next_attempt_at)
 VALUES('match-scorecards',cleanup_path,now()+make_interval(secs=>delay_seconds))
 ON CONFLICT(bucket,object_path) DO UPDATE SET
  status=CASE WHEN jobs.status='processing' THEN 'processing' ELSE 'pending' END,
  next_attempt_at=least(jobs.next_attempt_at,excluded.next_attempt_at),completed_at=NULL;
END $$;
REVOKE ALL ON FUNCTION public.queue_scorecard_cleanup(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_scorecard_cleanup(text,integer) TO service_role;

-- Capture paths transactionally before old references disappear, including cascades.
CREATE FUNCTION arena_private.capture_scorecard_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.storage_path IS DISTINCT FROM NEW.storage_path THEN
  PERFORM public.queue_scorecard_cleanup(OLD.storage_path,0);
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION arena_private.capture_scorecard_cleanup() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER scorecard_cleanup_capture AFTER UPDATE OF storage_path OR DELETE ON public.match_scorecards
 FOR EACH ROW EXECUTE FUNCTION arena_private.capture_scorecard_cleanup();

-- Once deletion has begun, the path cannot be attached again. The worker's lease
-- and this row lock prevent a new reference racing an external Storage delete.
CREATE FUNCTION arena_private.guard_scorecard_cleanup_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE job public.storage_cleanup_jobs;
BEGIN
 IF TG_OP='UPDATE' AND NEW.storage_path=OLD.storage_path THEN RETURN NEW; END IF;
 SELECT * INTO job FROM public.storage_cleanup_jobs WHERE bucket='match-scorecards' AND object_path=NEW.storage_path FOR UPDATE;
 IF job.attempt_count>0 THEN RAISE EXCEPTION 'This screenshot path has expired. Upload it again.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION arena_private.guard_scorecard_cleanup_reference() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER scorecard_cleanup_reference BEFORE INSERT OR UPDATE OF storage_path ON public.match_scorecards
 FOR EACH ROW EXECUTE FUNCTION arena_private.guard_scorecard_cleanup_reference();

CREATE FUNCTION public.claim_scorecard_cleanup(batch_size integer,claim_id uuid) RETURNS SETOF public.storage_cleanup_jobs
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF claim_id IS NULL OR batch_size IS NULL OR batch_size NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Invalid cleanup batch.'; END IF;
 UPDATE public.storage_cleanup_jobs j SET status='retained',completed_at=now(),lease_token=NULL,lease_until=NULL
 WHERE j.status IN('pending','processing') AND j.next_attempt_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now())
 AND EXISTS(SELECT 1 FROM public.match_scorecards s WHERE s.storage_path=j.object_path);
 RETURN QUERY
 WITH candidates AS (
  SELECT j.id FROM public.storage_cleanup_jobs j
  WHERE j.status IN('pending','processing') AND j.next_attempt_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now())
  AND NOT EXISTS(SELECT 1 FROM public.match_scorecards s WHERE s.storage_path=j.object_path)
  ORDER BY j.next_attempt_at,j.created_at,j.id LIMIT batch_size FOR UPDATE SKIP LOCKED
 )
 UPDATE public.storage_cleanup_jobs j SET status='processing',attempt_count=j.attempt_count+1,
 lease_token=claim_id,lease_until=now()+interval '90 seconds'
 FROM candidates c WHERE j.id=c.id RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_scorecard_cleanup(integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_scorecard_cleanup(integer,uuid) TO service_role;

CREATE FUNCTION public.finish_scorecard_cleanup(job_id uuid,claim_id uuid,succeeded boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE public.storage_cleanup_jobs SET status=CASE WHEN succeeded THEN 'completed' ELSE 'pending' END,
 completed_at=CASE WHEN succeeded THEN now() ELSE NULL END,
 next_attempt_at=now()+make_interval(secs=>60*least(attempt_count,60)),lease_token=NULL,lease_until=NULL
 WHERE id=job_id AND status='processing' AND lease_token=claim_id;
END $$;
REVOKE ALL ON FUNCTION public.finish_scorecard_cleanup(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_scorecard_cleanup(uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
