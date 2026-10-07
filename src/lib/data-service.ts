import { Cabin, SlotRequest, MatchRequest, Tournament, Registration, Profile, NotificationLog } from '@/types';
import { notifyAdminNewBooking, notifyAdminTournamentRegistration } from './notifications';
import { getFaceitPlayerByNickname } from './faceit';

// Initial Cabins from oggaming.pk
const INITIAL_CABINS: Cabin[] = [
  {
    id: 'cabin-1',
    name: 'CABIN 01 - PC Cabin',
    slug: 'cabin-01',
    pc_count: 5,
    specs: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors, Japanese Aqua custom gaming chairs, Chilled AC',
    hourly_rate: 200,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cabin-2',
    name: 'CABIN 02 - PC Cabin',
    slug: 'cabin-02',
    pc_count: 5,
    specs: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors, Japanese Aqua custom gaming chairs, Chilled AC',
    hourly_rate: 200,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cabin-3',
    name: 'CABIN 03 - PC Cabin',
    slug: 'cabin-03',
    pc_count: 5,
    specs: '5 eSports-styled high-end gaming PCs, 240Hz MSI monitors, Japanese Aqua custom gaming chairs, Chilled AC',
    hourly_rate: 200,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cabin-4',
    name: 'CABIN 04 - PC Cabin (Coming Soon)',
    slug: 'cabin-04',
    pc_count: 5,
    specs: 'A fourth 5-seat PC cabin, currently being built out with 240Hz MSI setups',
    hourly_rate: 200,
    is_active: false,
    created_at: new Date().toISOString(),
  },
  {
    id: 'cabin-ps5',
    name: 'PS5 LOUNGE',
    slug: 'ps5-lounge',
    pc_count: 4,
    specs: '4 PS5 Slim Digital Edition consoles, comfortable bean bags, 2 DualSense controllers, Chilled AC',
    hourly_rate: 500,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Initial Profiles
const INITIAL_PROFILES: Profile[] = [
  {
    id: 'usr-admin',
    faceit_id: 'faceit-admin',
    faceit_nickname: 'OG_Admin',
    faceit_avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    faceit_elo: 2200,
    faceit_level: 8,
    faceit_game_id: 'cs2',
    phone: '+92 300 1234567',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'usr-s1mple',
    faceit_id: 'faceit-s1mple',
    faceit_nickname: 's1mple',
    faceit_avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    faceit_elo: 3650,
    faceit_level: 10,
    faceit_game_id: 'cs2',
    phone: '+92 301 9876543',
    role: 'player',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'usr-casual',
    faceit_id: 'faceit-casual',
    faceit_nickname: 'CasualFragger',
    faceit_avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    faceit_elo: 1120,
    faceit_level: 4,
    faceit_game_id: 'cs2',
    role: 'player',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'usr-noob',
    faceit_id: 'faceit-noob',
    faceit_nickname: 'NoobMaster69',
    faceit_avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    faceit_elo: 750,
    faceit_level: 2,
    faceit_game_id: 'cs2',
    role: 'player',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Initial Bookings
const getTodayDate = (hour: number) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const INITIAL_BOOKINGS: SlotRequest[] = [
  {
    id: 'slot-1',
    cabin_id: 'cabin-1',
    user_id: 'usr-s1mple',
    start_time: getTodayDate(14),
    end_time: getTodayDate(17),
    player_count: 5,
    status: 'approved',
    notes: 'Team NAVI bootcamp scrims vs FaZe',
    admin_notes: 'Confirmed by admin on WhatsApp',
    approved_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'slot-2',
    cabin_id: 'cabin-2',
    user_id: 'usr-casual',
    start_time: getTodayDate(18),
    end_time: getTodayDate(21),
    player_count: 5,
    status: 'pending',
    notes: '5v5 casual Friday night CS2 stack',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Initial 5v5 Board
const INITIAL_MATCHES: MatchRequest[] = [
  {
    id: 'match-1',
    creator_id: 'usr-s1mple',
    title: 'High Elo LAN Scrim (Level 9-10 Only)',
    type: 'team_vs_team',
    description: 'Looking for a full 5-stack to play Best of 3 on Inferno & Mirage. 128 tick LAN settings.',
    preferred_cabin_id: 'cabin-1',
    scheduled_time: getTodayDate(19),
    min_faceit_level: 9,
    max_faceit_level: 10,
    status: 'open',
    current_players_count: 5,
    target_players_count: 10,
    roster: [
      { id: 'usr-s1mple', nickname: 's1mple', level: 10, elo: 3650, role: 'AWP / Captain' },
      { id: 'p2', nickname: 'b1t', level: 10, elo: 3410, role: 'Rifler' },
      { id: 'p3', nickname: 'Aleksib', level: 10, elo: 3200, role: 'IGL' },
      { id: 'p4', nickname: 'iM', level: 10, elo: 3180, role: 'Entry' },
      { id: 'p5', nickname: 'jL', level: 10, elo: 3350, role: 'Lurker' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'match-2',
    creator_id: 'usr-casual',
    title: 'Casual 5v5 Community Fun Match',
    type: 'gather_5v5',
    description: 'Chill games for levels 3 to 6. Solo players welcome, we will shuffle teams on stage!',
    preferred_cabin_id: 'cabin-3',
    scheduled_time: getTodayDate(21),
    min_faceit_level: 2,
    max_faceit_level: 6,
    status: 'open',
    current_players_count: 4,
    target_players_count: 10,
    roster: [
      { id: 'usr-casual', nickname: 'CasualFragger', level: 4, elo: 1120, role: 'Captain' },
      { id: 'usr-noob', nickname: 'NoobMaster69', level: 2, elo: 750, role: 'Support' },
      { id: 'p7', nickname: 'SmokeKing', level: 5, elo: 1350, role: 'Rifler' },
      { id: 'p8', nickname: 'FlashBangGG', level: 3, elo: 980, role: 'Rifler' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Initial Tournaments
const getFutureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const INITIAL_TOURNAMENTS: Tournament[] = [
  {
    id: 'tour-1',
    title: 'OG CS2 Community Cup #1',
    slug: 'og-cs2-community-cup-1',
    description: 'Single elimination LAN tournament exclusively designed for mid-tier competitive players. Free energy drinks provided for all participants!',
    game: 'Counter-Strike 2',
    format: '5v5 Single Elimination MR12',
    min_level: 1,
    max_level: 6,
    max_teams: 8,
    start_date: getFutureDate(5),
    registration_deadline: getFutureDate(3),
    status: 'upcoming',
    prize_pool: '$500 Cash + 20 Hours Cabin Time',
    rules: 'Standard Valve MR12 rules. Players must have active FACEIT account between level 1 and 6. Smurfing will lead to immediate disqualification.',
    registrations_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tour-2',
    title: 'OG Masters Invitational',
    slug: 'og-masters-invitational',
    description: 'Premier high-tier championship for elite CS2 stacks. Broadcasted live on venue big screens with casted commentary.',
    game: 'Counter-Strike 2',
    format: '5v5 Double Elimination BO3 Finals',
    min_level: 7,
    max_level: 10,
    max_teams: 8,
    start_date: getFutureDate(12),
    registration_deadline: getFutureDate(10),
    status: 'upcoming',
    prize_pool: '$1,500 Cash + Championship Trophy',
    rules: 'Strictly Level 7 to Level 10. In-house anti-cheat check on peripherals. Captains meeting 45 mins prior to match 1.',
    registrations_count: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Initial Registrations
const INITIAL_REGISTRATIONS: Registration[] = [
  {
    id: 'reg-1',
    tournament_id: 'tour-1',
    captain_id: 'usr-casual',
    team_name: 'Rush B Cyka',
    avg_faceit_level: 3.8,
    status: 'approved',
    checked_in: true,
    checked_in_at: new Date().toISOString(),
    roster_details: [
      { nickname: 'CasualFragger', level: 4, elo: 1120 },
      { nickname: 'NoobMaster69', level: 2, elo: 750 },
      { nickname: 'SmokeKing', level: 5, elo: 1350 },
      { nickname: 'FlashBangGG', level: 3, elo: 980 },
      { nickname: 'TriggerHappy', level: 5, elo: 1390 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'reg-2',
    tournament_id: 'tour-2',
    captain_id: 'usr-s1mple',
    team_name: 'Born To Win',
    avg_faceit_level: 10.0,
    status: 'approved',
    checked_in: false,
    roster_details: [
      { nickname: 's1mple', level: 10, elo: 3650 },
      { nickname: 'ZywOo', level: 10, elo: 3580 },
      { nickname: 'donk', level: 10, elo: 3820 },
      { nickname: 'm0NESY', level: 10, elo: 3750 },
      { nickname: 'NiKo', level: 10, elo: 3420 },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Global In-Memory Stores
let cabins = [...INITIAL_CABINS];
let profiles = [...INITIAL_PROFILES];
let bookings = [...INITIAL_BOOKINGS];
let matches = [...INITIAL_MATCHES];
let tournaments = [...INITIAL_TOURNAMENTS];
let registrations = [...INITIAL_REGISTRATIONS];
let notificationLogs: NotificationLog[] = [];

// Service Layer Functions
export const DataService = {
  // Profiles
  async getProfiles(): Promise<Profile[]> {
    return profiles;
  },

  async getProfileById(id: string): Promise<Profile | undefined> {
    return profiles.find((p) => p.id === id);
  },

  async createOrUpdateProfile(profileData: Partial<Profile> & { faceit_nickname: string }): Promise<Profile> {
    const existingIndex = profiles.findIndex(
      (p) => p.faceit_nickname.toLowerCase() === profileData.faceit_nickname.toLowerCase()
    );

    const faceitData = await getFaceitPlayerByNickname(profileData.faceit_nickname);

    if (existingIndex >= 0) {
      profiles[existingIndex] = {
        ...profiles[existingIndex],
        ...profileData,
        faceit_id: faceitData?.id || profiles[existingIndex].faceit_id,
        faceit_avatar_url: faceitData?.avatar || profiles[existingIndex].faceit_avatar_url,
        faceit_elo: faceitData?.elo || profiles[existingIndex].faceit_elo,
        faceit_level: faceitData?.level || profiles[existingIndex].faceit_level,
        updated_at: new Date().toISOString(),
      };
      return profiles[existingIndex];
    } else {
      const newProfile: Profile = {
        id: profileData.id || `usr-${Date.now()}`,
        faceit_id: faceitData?.id || null,
        faceit_nickname: profileData.faceit_nickname,
        faceit_avatar_url: faceitData?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profileData.faceit_nickname)}`,
        faceit_elo: faceitData?.elo || 1000,
        faceit_level: faceitData?.level || 3,
        faceit_game_id: 'cs2',
        role: profileData.role || 'player',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      profiles.push(newProfile);
      return newProfile;
    }
  },

  // Cabins
  async getCabins(): Promise<Cabin[]> {
    return cabins;
  },

  // Slot Bookings
  async getBookings(): Promise<SlotRequest[]> {
    return bookings.map((b) => ({
      ...b,
      cabin: cabins.find((c) => c.id === b.cabin_id),
      user: profiles.find((u) => u.id === b.user_id),
    }));
  },

  // Check overlap (mirrors PostgreSQL exclusion constraint)
  checkBookingConflict(cabinId: string, startTime: string, endTime: string, ignoreBookingId?: string): boolean {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return bookings.some((b) => {
      if (b.cabin_id !== cabinId || b.status !== 'approved') return false;
      if (ignoreBookingId && b.id === ignoreBookingId) return false;

      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();

      // Overlap condition: start < bEnd && end > bStart
      return start < bEnd && end > bStart;
    });
  },

  async createSlotRequest(params: {
    cabin_id: string;
    user_id: string;
    start_time: string;
    end_time: string;
    player_count?: number;
    notes?: string;
  }): Promise<{ success: boolean; error?: string; booking?: SlotRequest }> {
    const user = profiles.find((p) => p.id === params.user_id);
    const cabin = cabins.find((c) => c.id === params.cabin_id);

    if (!user) return { success: false, error: 'User profile not found' };
    if (!cabin) return { success: false, error: 'Cabin not found' };

    const newBooking: SlotRequest = {
      id: `slot-${Date.now()}`,
      cabin_id: params.cabin_id,
      cabin,
      user_id: params.user_id,
      user,
      start_time: params.start_time,
      end_time: params.end_time,
      player_count: params.player_count || 5,
      status: 'pending',
      notes: params.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    bookings.push(newBooking);

    // Trigger Telegram Notification for venue admin
    notifyAdminNewBooking({
      userName: user.faceit_nickname,
      cabinName: cabin.name,
      startTime: new Date(params.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date(params.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      playerCount: newBooking.player_count,
    });

    return { success: true, booking: newBooking };
  },

  async updateBookingStatus(
    bookingId: string,
    status: 'approved' | 'rejected' | 'cancelled',
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const index = bookings.findIndex((b) => b.id === bookingId);
    if (index === -1) return { success: false, error: 'Booking not found' };

    const booking = bookings[index];

    // If approving, enforce double-booking exclusion constraint!
    if (status === 'approved') {
      const hasConflict = this.checkBookingConflict(booking.cabin_id, booking.start_time, booking.end_time, booking.id);
      if (hasConflict) {
        return {
          success: false,
          error: 'Double-Booking Conflict: Another approved reservation overlaps with this time slot!',
        };
      }
      booking.approved_at = new Date().toISOString();
    }

    booking.status = status;
    booking.admin_notes = adminNotes || booking.admin_notes;
    booking.updated_at = new Date().toISOString();

    return { success: true };
  },

  // 5v5 Match Requests
  async getMatches(): Promise<MatchRequest[]> {
    return matches.map((m) => ({
      ...m,
      creator: profiles.find((p) => p.id === m.creator_id),
      preferred_cabin: cabins.find((c) => c.id === m.preferred_cabin_id),
    }));
  },

  async createMatch(params: {
    creator_id: string;
    title: string;
    type: MatchRequest['type'];
    description?: string;
    preferred_cabin_id?: string;
    scheduled_time?: string;
    min_faceit_level: number;
    max_faceit_level: number;
    target_players_count?: number;
  }): Promise<MatchRequest> {
    const creator = profiles.find((p) => p.id === params.creator_id);
    const newMatch: MatchRequest = {
      id: `match-${Date.now()}`,
      creator_id: params.creator_id,
      creator,
      title: params.title,
      type: params.type,
      description: params.description || null,
      preferred_cabin_id: params.preferred_cabin_id || null,
      scheduled_time: params.scheduled_time || null,
      min_faceit_level: params.min_faceit_level,
      max_faceit_level: params.max_faceit_level,
      status: 'open',
      current_players_count: 1,
      target_players_count: params.target_players_count || 10,
      roster: creator
        ? [
            {
              id: creator.id,
              nickname: creator.faceit_nickname,
              level: creator.faceit_level,
              elo: creator.faceit_elo,
              role: 'Captain / Creator',
            },
          ]
        : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    matches.unshift(newMatch);
    return newMatch;
  },

  async joinMatch(matchId: string, player: Profile, role?: string): Promise<{ success: boolean; error?: string }> {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return { success: false, error: 'Match not found' };

    if (match.status !== 'open') return { success: false, error: 'Match is already full or closed' };

    if (player.faceit_level < match.min_faceit_level || player.faceit_level > match.max_faceit_level) {
      return {
        success: false,
        error: `Level mismatch: This match requires FACEIT Level ${match.min_faceit_level}-${match.max_faceit_level}. Your level is ${player.faceit_level}.`,
      };
    }

    if (match.roster.some((p) => p.nickname.toLowerCase() === player.faceit_nickname.toLowerCase())) {
      return { success: false, error: 'You are already in this match roster' };
    }

    match.roster.push({
      id: player.id,
      nickname: player.faceit_nickname,
      level: player.faceit_level,
      elo: player.faceit_elo,
      role: role || 'Player',
    });

    match.current_players_count = match.roster.length;
    if (match.current_players_count >= match.target_players_count) {
      match.status = 'matched';
    }
    match.updated_at = new Date().toISOString();

    return { success: true };
  },

  // Tournaments
  async getTournaments(): Promise<Tournament[]> {
    return tournaments.map((t) => ({
      ...t,
      registrations_count: registrations.filter((r) => r.tournament_id === t.id && r.status === 'approved').length,
    }));
  },

  async getTournamentById(id: string): Promise<Tournament | undefined> {
    const t = tournaments.find((item) => item.id === id || item.slug === id);
    if (!t) return undefined;
    return {
      ...t,
      registrations_count: registrations.filter((r) => r.tournament_id === t.id && r.status === 'approved').length,
    };
  },

  // Registrations with FACEIT Level Check
  async getRegistrations(tournamentId?: string): Promise<Registration[]> {
    const list = tournamentId ? registrations.filter((r) => r.tournament_id === tournamentId) : registrations;
    return list.map((r) => ({
      ...r,
      tournament: tournaments.find((t) => t.id === r.tournament_id),
      captain: profiles.find((p) => p.id === r.captain_id),
    }));
  },

  async registerTournamentTeam(params: {
    tournament_id: string;
    captain_id: string;
    team_name: string;
    roster_nicknames: string[];
  }): Promise<{ success: boolean; error?: string; registration?: Registration }> {
    const tournament = tournaments.find((t) => t.id === params.tournament_id);
    const captain = profiles.find((p) => p.id === params.captain_id);

    if (!tournament) return { success: false, error: 'Tournament not found' };
    if (!captain) return { success: false, error: 'Captain profile not found' };

    // Check existing team name in this tournament
    if (
      registrations.some(
        (r) => r.tournament_id === params.tournament_id && r.team_name.toLowerCase() === params.team_name.toLowerCase()
      )
    ) {
      return { success: false, error: 'A team with this name is already registered for this tournament' };
    }

    // Resolve all 5 player nicknames via FACEIT API / Cache
    const rosterDetails = [];
    let totalLevel = 0;

    for (const nick of params.roster_nicknames) {
      const faceitData = await getFaceitPlayerByNickname(nick);
      if (!faceitData) {
        return { success: false, error: `Could not verify player "${nick}" on FACEIT` };
      }

      // Check level bounds against tournament restrictions
      if (faceitData.level < tournament.min_level || faceitData.level > tournament.max_level) {
        return {
          success: false,
          error: `Eligibility Violation: Player "${faceitData.nickname}" is FACEIT Level ${faceitData.level}. This tournament allows Level ${tournament.min_level} to ${tournament.max_level} only.`,
        };
      }

      totalLevel += faceitData.level;
      rosterDetails.push({
        nickname: faceitData.nickname,
        faceit_id: faceitData.id,
        level: faceitData.level,
        elo: faceitData.elo,
      });
    }

    const avgLevel = Number((totalLevel / rosterDetails.length).toFixed(1));

    const newReg: Registration = {
      id: `reg-${Date.now()}`,
      tournament_id: params.tournament_id,
      tournament,
      captain_id: params.captain_id,
      captain,
      team_name: params.team_name,
      roster_details: rosterDetails,
      avg_faceit_level: avgLevel,
      status: 'pending',
      checked_in: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    registrations.push(newReg);

    // Notify venue admin via Telegram
    notifyAdminTournamentRegistration({
      teamName: newReg.team_name,
      tournamentTitle: tournament.title,
      captainNickname: captain.faceit_nickname,
      avgLevel,
    });

    return { success: true, registration: newReg };
  },

  async toggleRegistrationCheckIn(registrationId: string): Promise<{ success: boolean; checked_in: boolean }> {
    const reg = registrations.find((r) => r.id === registrationId);
    if (!reg) return { success: false, checked_in: false };

    reg.checked_in = !reg.checked_in;
    reg.checked_in_at = reg.checked_in ? new Date().toISOString() : null;
    reg.updated_at = new Date().toISOString();

    return { success: true, checked_in: reg.checked_in };
  },

  async updateRegistrationStatus(
    registrationId: string,
    status: 'approved' | 'rejected'
  ): Promise<{ success: boolean }> {
    const reg = registrations.find((r) => r.id === registrationId);
    if (!reg) return { success: false };

    reg.status = status;
    reg.updated_at = new Date().toISOString();
    return { success: true };
  },
};
