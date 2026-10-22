-- Team applications do not require FACEIT accounts or linked squad invitations.
ALTER TABLE public.registrations ALTER COLUMN captain_id DROP NOT NULL;
CREATE TABLE public.registration_contacts (
 registration_id uuid PRIMARY KEY REFERENCES public.registrations(id) ON DELETE CASCADE,
 captain_name text NOT NULL, email text NOT NULL, phone text NOT NULL, city text NOT NULL DEFAULT '',
 notes text NOT NULL DEFAULT '', delete_token_hash text NOT NULL CHECK(delete_token_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX registration_contacts_phone_idx ON public.registration_contacts(phone);
ALTER TABLE public.registration_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_contacts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.registration_contacts TO service_role;
CREATE FUNCTION public.submit_team_application(actor_id uuid,event_id uuid,application jsonb,credential_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event public.tournaments; entry public.registrations; roster jsonb:=application->'players';
BEGIN
 SELECT * INTO event FROM public.tournaments WHERE id=event_id FOR UPDATE;
 IF event.id IS NULL OR event.status<>'upcoming' OR event.registration_deadline<=now() THEN RAISE EXCEPTION 'Registration is closed.';END IF;
 IF actor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role<>'banned') THEN RAISE EXCEPTION 'Account access denied.';END IF;
 IF jsonb_typeof(roster)<>'array' OR jsonb_array_length(roster)<>5 OR EXISTS(SELECT 1 FROM jsonb_array_elements(roster) p WHERE jsonb_typeof(p)<>'object' OR length(trim(coalesce(p->>'nickname',''))) NOT BETWEEN 1 AND 40) OR (SELECT count(DISTINCT lower(trim(p->>'nickname'))) FROM jsonb_array_elements(roster) p)<>5 THEN RAISE EXCEPTION 'Enter five different player names.';END IF;
 IF length(trim(coalesce(application->>'team_name',''))) NOT BETWEEN 1 AND 80 OR length(trim(coalesce(application->>'captain_name',''))) NOT BETWEEN 1 AND 80 OR application->>'phone' !~ '^\+[1-9][0-9]{7,14}$' OR coalesce(application->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce((application->>'accepted_rules')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Complete the team and captain details and accept the rules.';END IF;
 IF (SELECT count(*) FROM public.registrations WHERE tournament_id=event_id AND status<>'rejected')>=event.max_teams THEN RAISE EXCEPTION 'Tournament entries are full.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('team-entry:'||(application->>'phone'),0));
 IF EXISTS(SELECT 1 FROM public.registration_contacts c JOIN public.registrations r ON r.id=c.registration_id WHERE r.tournament_id=event_id AND r.status<>'rejected' AND c.phone=application->>'phone') THEN RAISE EXCEPTION 'This captain already has an application for this event.';END IF;
 INSERT INTO public.registrations(tournament_id,captain_id,team_name,roster_details,avg_faceit_level)
 VALUES(event_id,actor_id,trim(application->>'team_name'),roster,NULL) RETURNING * INTO entry;
 INSERT INTO public.registration_contacts(registration_id,captain_name,email,phone,city,notes,delete_token_hash)
 VALUES(entry.id,trim(application->>'captain_name'),lower(application->>'email'),application->>'phone',left(coalesce(application->>'city',''),80),left(coalesce(application->>'notes',''),1000),credential_hash);
 RETURN to_jsonb(entry);
END $$;
REVOKE ALL ON FUNCTION public.submit_team_application(uuid,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_team_application(uuid,uuid,jsonb,text) TO service_role;
CREATE FUNCTION public.checkin_team_application(entry_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE entry public.registrations; event public.tournaments;
BEGIN
 SELECT * INTO entry FROM public.registrations WHERE id=entry_id;
 SELECT * INTO event FROM public.tournaments WHERE id=entry.tournament_id FOR UPDATE;
 SELECT * INTO entry FROM public.registrations WHERE id=entry_id FOR UPDATE;
 IF entry.id IS NULL OR entry.status<>'approved' OR event.status<>'upcoming' OR now()<coalesce(event.checkin_open,event.start_date-interval '1 hour') OR now()>=coalesce(event.checkin_close,event.start_date) THEN RAISE EXCEPTION 'Check-in is unavailable for this application.';END IF;
 UPDATE public.registrations SET checked_in=true,checked_in_at=now(),updated_at=now() WHERE id=entry_id;
END $$;
REVOKE ALL ON FUNCTION public.checkin_team_application(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_team_application(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
