CREATE INDEX registration_contact_email_lookup ON public.registration_contacts(lower(email));
CREATE FUNCTION arena_private.claim_my_guest_applications() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); verified_email text; changed integer;
BEGIN
 SELECT lower(u.email) INTO verified_email FROM auth.users u JOIN public.profiles p ON p.id=u.id
 WHERE u.id=actor AND u.email_confirmed_at IS NOT NULL AND p.role<>'banned';
 IF verified_email IS NULL THEN RETURN 0; END IF;
 UPDATE public.registrations r SET captain_id=actor
 FROM public.registration_contacts c
 WHERE c.registration_id=r.id AND lower(c.email)=verified_email AND r.captain_id IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.tournament_matches m WHERE m.tournament_id=r.tournament_id);
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END $$;
REVOKE ALL ON FUNCTION arena_private.claim_my_guest_applications() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION arena_private.claim_my_guest_applications() TO authenticated;
CREATE FUNCTION public.claim_my_guest_applications() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT arena_private.claim_my_guest_applications() $$;
REVOKE ALL ON FUNCTION public.claim_my_guest_applications() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.claim_my_guest_applications() TO authenticated;
NOTIFY pgrst,'reload schema';
