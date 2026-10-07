-- Enable btree_gist extension for PostgreSQL exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. PROFILES / USERS
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    faceit_id TEXT UNIQUE,
    faceit_nickname TEXT NOT NULL,
    faceit_avatar_url TEXT,
    faceit_elo INTEGER DEFAULT 1000,
    faceit_level INTEGER DEFAULT 1 CHECK (faceit_level BETWEEN 1 AND 10),
    faceit_game_id TEXT DEFAULT 'cs2',
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin', 'banned')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_faceit_nickname ON public.profiles(faceit_nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. CABINS
CREATE TABLE IF NOT EXISTS public.cabins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    pc_count INTEGER NOT NULL DEFAULT 5,
    specs TEXT,
    hourly_rate NUMERIC(10, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CABIN SLOT REQUESTS
CREATE TABLE IF NOT EXISTS public.slot_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabin_id UUID NOT NULL REFERENCES public.cabins(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    player_count INTEGER NOT NULL DEFAULT 5,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    notes TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_at TIMESTAMPTZ,
    
    -- Ensure start_time is before end_time
    CONSTRAINT chk_slot_valid_timespan CHECK (end_time > start_time)
);

-- Exclusion constraint to prevent overlapping approved slots for the same cabin
ALTER TABLE public.slot_requests
ADD CONSTRAINT no_double_booking_approved_slots
EXCLUDE USING gist (
    cabin_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
) WHERE (status = 'approved');

CREATE INDEX IF NOT EXISTS idx_slot_requests_cabin_time ON public.slot_requests(cabin_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_slot_requests_status ON public.slot_requests(status);
CREATE INDEX IF NOT EXISTS idx_slot_requests_user ON public.slot_requests(user_id);

-- 4. 5V5 MATCH REQUEST BOARD
CREATE TABLE IF NOT EXISTS public.match_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'gather_5v5' CHECK (type IN ('solo_lfg', 'team_vs_team', 'gather_5v5')),
    description TEXT,
    preferred_cabin_id UUID REFERENCES public.cabins(id) ON DELETE SET NULL,
    scheduled_time TIMESTAMPTZ,
    min_faceit_level INTEGER NOT NULL DEFAULT 1 CHECK (min_faceit_level BETWEEN 1 AND 10),
    max_faceit_level INTEGER NOT NULL DEFAULT 10 CHECK (max_faceit_level BETWEEN 1 AND 10),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'closed', 'cancelled')),
    current_players_count INTEGER NOT NULL DEFAULT 1,
    target_players_count INTEGER NOT NULL DEFAULT 10,
    roster JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_level_range CHECK (max_faceit_level >= min_faceit_level)
);

CREATE INDEX IF NOT EXISTS idx_match_requests_status ON public.match_requests(status);
CREATE INDEX IF NOT EXISTS idx_match_requests_scheduled_time ON public.match_requests(scheduled_time);

-- 5. TOURNAMENTS
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    game TEXT NOT NULL DEFAULT 'Counter-Strike 2',
    format TEXT NOT NULL DEFAULT '5v5 Single Elimination',
    min_level INTEGER NOT NULL DEFAULT 1 CHECK (min_level BETWEEN 1 AND 10),
    max_level INTEGER NOT NULL DEFAULT 10 CHECK (max_level BETWEEN 1 AND 10),
    max_teams INTEGER NOT NULL DEFAULT 8,
    start_date TIMESTAMPTZ NOT NULL,
    registration_deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'cancelled')),
    prize_pool TEXT,
    rules TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_tournament_level_range CHECK (max_level >= min_level)
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);

-- 6. TEAMS (Simplified Phase 1: Team name + Captain)
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    captain_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    roster_nicknames TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TOURNAMENT REGISTRATIONS
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    captain_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    roster_details JSONB NOT NULL, -- Array of player metadata objects [{ nickname, faceit_id, level, elo }]
    avg_faceit_level NUMERIC(3, 1),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    checked_in BOOLEAN NOT NULL DEFAULT false,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_tournament_team UNIQUE (tournament_id, team_name)
);

CREATE INDEX IF NOT EXISTS idx_registrations_tournament ON public.registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_captain ON public.registrations(captain_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON public.registrations(status);

-- 8. NOTIFICATIONS LOG
CREATE TABLE IF NOT EXISTS public.notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL CHECK (channel IN ('telegram', 'email', 'system')),
    recipient TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications_log(status);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cabins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- Helper function: Is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Cabins Policies
CREATE POLICY "Cabins are viewable by everyone"
ON public.cabins FOR SELECT USING (true);

CREATE POLICY "Admins can manage cabins"
ON public.cabins FOR ALL USING (public.is_admin());

-- Slot Requests Policies
CREATE POLICY "Users can view their own slot requests or approved slots"
ON public.slot_requests FOR SELECT
USING (
    auth.uid() = user_id 
    OR status = 'approved' 
    OR public.is_admin()
);

CREATE POLICY "Authenticated users can submit slot requests"
ON public.slot_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their pending slot requests"
ON public.slot_requests FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can manage all slot requests"
ON public.slot_requests FOR ALL
USING (public.is_admin());

-- Match Requests Policies
CREATE POLICY "Anyone can view open match requests"
ON public.match_requests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create match requests"
ON public.match_requests FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their match requests"
ON public.match_requests FOR UPDATE USING (auth.uid() = creator_id OR public.is_admin());

-- Tournaments Policies
CREATE POLICY "Anyone can view active/upcoming tournaments"
ON public.tournaments FOR SELECT USING (true);

CREATE POLICY "Admins can manage tournaments"
ON public.tournaments FOR ALL USING (public.is_admin());

-- Registrations Policies
CREATE POLICY "Anyone can view approved registrations"
ON public.registrations FOR SELECT
USING (
    status = 'approved' 
    OR auth.uid() = captain_id 
    OR public.is_admin()
);

CREATE POLICY "Captains can register their teams"
ON public.registrations FOR INSERT
WITH CHECK (auth.uid() = captain_id);

CREATE POLICY "Admins can manage all registrations"
ON public.registrations FOR ALL
USING (public.is_admin());

-- Notifications Log Policies
CREATE POLICY "Admins can view notifications log"
ON public.notifications_log FOR SELECT USING (public.is_admin());

-- SEED DATA
INSERT INTO public.cabins (name, slug, pc_count, specs, hourly_rate) VALUES
('Cabin 1 - VIP Main Stage', 'cabin-1-vip', 5, '5x Intel Core i9-14900K, RTX 4080 Super, 32GB DDR5, ZOWIE 240Hz XL2546K, Secretlab Chairs', 35.00),
('Cabin 2 - Bootcamp Pro Arena', 'cabin-2-pro', 5, '5x AMD Ryzen 7 7800X3D, RTX 4080, 32GB RAM, 240Hz Alienware Fast-IPS', 30.00),
('Cabin 3 - Scrims Studio', 'cabin-3-scrims', 5, '5x Intel Core i7-14700K, RTX 4070 Ti, 32GB RAM, 240Hz ASUS ROG Swift', 25.00),
('Cabin 4 - Stealth 5v5 Room', 'cabin-4-stealth', 5, '5x AMD Ryzen 5 7600X, RTX 4070, 16GB RAM, 165Hz BenQ Gaming', 20.00)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tournaments (title, slug, description, min_level, max_level, max_teams, start_date, registration_deadline, status, prize_pool, rules) VALUES
(
    'OG CS2 Community Cup #1',
    'og-cs2-community-cup-1',
    'Open to all FACEIT Level 1 to 6 players. Single elimination, standard MR12 overtime rules, in-house LAN event at OG Gaming arena.',
    1, 6, 8,
    timezone('utc'::text, now() + interval '5 days'),
    timezone('utc'::text, now() + interval '3 days'),
    'upcoming',
    '$500 + OG Cabin Credits',
    'Standard Valve CS2 Competitive Rules. No coaching on stage during play. Check-in 30 mins before match start.'
),
(
    'OG Masters Invitational',
    'og-masters-invitational',
    'High-stakes LAN tournament strictly for FACEIT Level 7 to 10 players. Best of 3 Semi-Finals and Grand Finals.',
    7, 10, 8,
    timezone('utc'::text, now() + interval '12 days'),
    timezone('utc'::text, now() + interval '10 days'),
    'upcoming',
    '$1,500 Cash Prize',
    'VETO system on stage. Anti-cheat required on personal peripherals.'
)
ON CONFLICT (slug) DO NOTHING;
