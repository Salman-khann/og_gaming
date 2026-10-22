-- Steam IDs are written only after Steam verifies its signed OpenID assertion.
CREATE TABLE public.steam_identities (
  steam_id text PRIMARY KEY CHECK (steam_id ~ '^7656119[0-9]{10}$'),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.steam_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.steam_identities FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.steam_identities TO service_role;

-- Explicit grants support projects that disable automatic Data API exposure.
GRANT SELECT ON public.profiles, public.match_requests, public.tournaments, public.registrations TO anon, authenticated;
GRANT INSERT ON public.match_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.match_requests, public.tournaments, public.registrations TO service_role;
REVOKE ALL ON FUNCTION public.create_player_profile(), public.initialize_arena_match(), public.validate_arena_roster(), public.check_tournament_capacity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

CREATE INDEX match_requests_creator_idx ON public.match_requests (creator_id);
CREATE INDEX match_requests_open_created_idx ON public.match_requests (created_at DESC) WHERE status = 'open';
CREATE INDEX tournaments_start_idx ON public.tournaments (start_date);

-- For upgrades, retain historic booking records privately with no application API.
CREATE SCHEMA IF NOT EXISTS retired_bookings;
REVOKE ALL ON SCHEMA retired_bookings FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'match_requests' AND column_name = 'preferred_cabin_id') THEN
    ALTER TABLE public.match_requests DROP COLUMN preferred_cabin_id;
  END IF;
  IF to_regclass('public.slot_requests') IS NOT NULL THEN
    REVOKE ALL ON public.slot_requests FROM anon, authenticated;
    ALTER TABLE public.slot_requests SET SCHEMA retired_bookings;
  END IF;
  IF to_regclass('public.cabins') IS NOT NULL THEN
    REVOKE ALL ON public.cabins FROM anon, authenticated;
    ALTER TABLE public.cabins SET SCHEMA retired_bookings;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
