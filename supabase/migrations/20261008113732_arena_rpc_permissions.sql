-- Policy helper only reads public profiles and needs no elevated privileges.
ALTER FUNCTION public.is_admin() SECURITY INVOKER;

-- Keep privileged operations outside the exposed API schema. Public wrappers
-- run as the caller; private implementations validate auth.uid()/admin role.
CREATE SCHEMA IF NOT EXISTS arena_private;
REVOKE ALL ON SCHEMA arena_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA arena_private TO authenticated, service_role;
ALTER FUNCTION public.join_arena_match(uuid) SET SCHEMA arena_private;
ALTER FUNCTION public.review_arena_registration(uuid, text) SET SCHEMA arena_private;
ALTER FUNCTION public.toggle_arena_checkin(uuid) SET SCHEMA arena_private;
REVOKE ALL ON FUNCTION arena_private.join_arena_match(uuid), arena_private.review_arena_registration(uuid, text), arena_private.toggle_arena_checkin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION arena_private.join_arena_match(uuid), arena_private.review_arena_registration(uuid, text), arena_private.toggle_arena_checkin(uuid) TO authenticated;
CREATE FUNCTION public.join_arena_match(match_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT arena_private.join_arena_match(match_id); $$;
CREATE FUNCTION public.review_arena_registration(registration_id uuid, next_status text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT arena_private.review_arena_registration(registration_id, next_status); $$;
CREATE FUNCTION public.toggle_arena_checkin(registration_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT arena_private.toggle_arena_checkin(registration_id); $$;
REVOKE ALL ON FUNCTION public.join_arena_match(uuid), public.review_arena_registration(uuid, text), public.toggle_arena_checkin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_arena_match(uuid), public.review_arena_registration(uuid, text), public.toggle_arena_checkin(uuid) TO authenticated;

-- Supabase's automatic RLS event trigger is not an application RPC endpoint.
DO $$ BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
REVOKE ALL ON public.teams FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
