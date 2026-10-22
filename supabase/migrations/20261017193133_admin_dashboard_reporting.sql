-- Aggregate every matching row in Postgres, independently of admin list pagination.
CREATE INDEX registrations_created_reporting_idx ON public.registrations(created_at);
CREATE INDEX registrations_event_reporting_idx ON public.registrations(tournament_id,created_at);
CREATE FUNCTION public.admin_dashboard_report(period_days integer, event_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE since_at timestamptz; until_at timestamptz := now(); result jsonb;
BEGIN
 IF period_days IS NULL OR period_days NOT IN (7,30,90) THEN RAISE EXCEPTION 'Choose 7, 30 or 90 days.'; END IF;
 since_at := ((until_at AT TIME ZONE 'Asia/Karachi')::date - (period_days-1))::timestamp AT TIME ZONE 'Asia/Karachi';
 WITH entries AS MATERIALIZED (
  SELECT created_at,status,checked_in,payment_status,amount_due FROM public.registrations
  WHERE created_at>=since_at AND created_at<=until_at AND (event_id IS NULL OR tournament_id=event_id)
 ), days AS (
  SELECT generate_series((since_at AT TIME ZONE 'Asia/Karachi')::date,(until_at AT TIME ZONE 'Asia/Karachi')::date,interval '1 day')::date AS day
 ), daily AS (
  SELECT (created_at AT TIME ZONE 'Asia/Karachi')::date AS day,count(*) AS entries,
   coalesce(sum(amount_due) FILTER(WHERE payment_status='verified'),0) AS verified_fees FROM entries GROUP BY 1
 )
 SELECT jsonb_build_object(
  'since',since_at,'until',until_at,'days',period_days,
  'registrations',(SELECT count(*) FROM entries),
  'approved',(SELECT count(*) FROM entries WHERE status='approved'),
  'pending',(SELECT count(*) FROM entries WHERE status='pending'),
  'rejected',(SELECT count(*) FROM entries WHERE status='rejected'),
  'checked_in',(SELECT count(*) FROM entries WHERE checked_in),
  'verified_fees',(SELECT coalesce(sum(amount_due),0) FROM entries WHERE payment_status='verified'),
  'unverified_fees',(SELECT coalesce(sum(amount_due),0) FROM entries WHERE payment_status='pending'),
  'series',(SELECT coalesce(jsonb_agg(jsonb_build_object('day',d.day,'entries',coalesce(a.entries,0),'verified_fees',coalesce(a.verified_fees,0)) ORDER BY d.day),'[]'::jsonb) FROM days d LEFT JOIN daily a USING(day))
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_dashboard_report(integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_report(integer,uuid) TO service_role;

CREATE FUNCTION public.admin_delete_tournament(actor_id uuid,event_id uuid,confirmation_title text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL THEN RAISE EXCEPTION 'Tournament no longer exists.'; END IF;
 IF confirmation_title IS DISTINCT FROM event.title THEN RAISE EXCEPTION 'Type the current tournament title to confirm deletion.'; END IF;
 -- Remove bracket references before cascading through registrations and private contacts.
 DELETE FROM public.tournament_matches WHERE tournament_id=event.id;
 DELETE FROM public.tournaments WHERE id=event.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_tournament(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tournament(uuid,uuid,text) TO service_role;
