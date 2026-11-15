ALTER TABLE public.registrations ADD COLUMN cancelled_at timestamptz;
ALTER TABLE public.registrations ADD CONSTRAINT cancelled_registration_rejected CHECK(cancelled_at IS NULL OR status='rejected');
DROP INDEX public.registrations_captain_unique;
CREATE UNIQUE INDEX registrations_captain_unique ON public.registrations(tournament_id,captain_id) WHERE cancelled_at IS NULL;

CREATE FUNCTION arena_private.guard_cancelled_registration() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF OLD.cancelled_at IS NOT NULL AND (NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at OR NEW.status<>'rejected') THEN
  RAISE EXCEPTION 'This registration was cancelled. Submit a new application instead.';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION arena_private.guard_cancelled_registration() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER cancelled_registration_guard BEFORE UPDATE ON public.registrations
 FOR EACH ROW EXECUTE FUNCTION arena_private.guard_cancelled_registration();

CREATE FUNCTION public.cancel_team_registration(actor_id uuid,entry_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE event_id uuid; entry public.registrations;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor_id AND role='admin') THEN RAISE EXCEPTION 'Administrator access required.'; END IF;
 SELECT tournament_id INTO event_id FROM public.registrations WHERE id=entry_id;
 IF event_id IS NULL THEN RAISE EXCEPTION 'Team registration not found.'; END IF;
 PERFORM 1 FROM public.tournaments WHERE id=event_id FOR UPDATE;
 SELECT * INTO entry FROM public.registrations WHERE id=entry_id FOR UPDATE;
 IF entry.id IS NULL OR entry.tournament_id<>event_id THEN RAISE EXCEPTION 'Registration changed. Refresh and try again.'; END IF;
 IF entry.cancelled_at IS NOT NULL THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.tournament_matches WHERE tournament_id=event_id) THEN
  RAISE EXCEPTION 'The bracket has started. Reset the bracket before cancelling a team registration.';
 END IF;
 UPDATE public.registrations SET status='rejected',cancelled_at=now(),updated_at=now() WHERE id=entry_id;
END $$;
REVOKE ALL ON FUNCTION public.cancel_team_registration(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_team_registration(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION arena_private.claim_my_guest_applications() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); verified_email text; changed integer;
BEGIN
 SELECT lower(u.email) INTO verified_email FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.id=actor AND u.email_confirmed_at IS NOT NULL AND p.role<>'banned';
 IF verified_email IS NULL THEN RETURN 0; END IF;
 UPDATE public.registrations r SET captain_id=actor FROM public.registration_contacts c
 WHERE c.registration_id=r.id AND lower(c.email)=verified_email AND r.captain_id IS NULL AND r.cancelled_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.tournament_matches m WHERE m.tournament_id=r.tournament_id);
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;
NOTIFY pgrst,'reload schema';
