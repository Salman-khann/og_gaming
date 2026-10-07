export type UserRole = 'player' | 'admin' | 'banned';

export interface Profile {
  id: string;
  faceit_id?: string | null;
  faceit_nickname: string;
  faceit_avatar_url?: string | null;
  faceit_elo: number;
  faceit_level: number;
  faceit_game_id: string;
  phone?: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Cabin {
  id: string;
  name: string;
  slug: string;
  pc_count: number;
  specs: string;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
}

export type SlotStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface SlotRequest {
  id: string;
  cabin_id: string;
  cabin?: Cabin;
  user_id: string;
  user?: Profile;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  player_count: number;
  status: SlotStatus;
  notes?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
}

export type MatchType = 'solo_lfg' | 'team_vs_team' | 'gather_5v5';
export type MatchStatus = 'open' | 'matched' | 'closed' | 'cancelled';

export interface MatchPlayer {
  id: string;
  nickname: string;
  level: number;
  elo: number;
  role?: string;
}

export interface MatchRequest {
  id: string;
  creator_id: string;
  creator?: Profile;
  title: string;
  type: MatchType;
  description?: string | null;
  preferred_cabin_id?: string | null;
  preferred_cabin?: Cabin;
  scheduled_time?: string | null;
  min_faceit_level: number;
  max_faceit_level: number;
  status: MatchStatus;
  current_players_count: number;
  target_players_count: number;
  roster: MatchPlayer[];
  created_at: string;
  updated_at: string;
}

export type TournamentStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Tournament {
  id: string;
  title: string;
  slug: string;
  description: string;
  game: string;
  format: string;
  min_level: number;
  max_level: number;
  max_teams: number;
  start_date: string;
  registration_deadline: string;
  status: TournamentStatus;
  prize_pool: string;
  rules: string;
  registrations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRosterMember {
  nickname: string;
  faceit_id?: string;
  level: number;
  elo: number;
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface Registration {
  id: string;
  tournament_id: string;
  tournament?: Tournament;
  team_id?: string | null;
  captain_id: string;
  captain?: Profile;
  team_name: string;
  roster_details: RegistrationRosterMember[];
  avg_faceit_level: number;
  status: RegistrationStatus;
  checked_in: boolean;
  checked_in_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  channel: 'telegram' | 'email' | 'system';
  recipient: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string | null;
  created_at: string;
  sent_at?: string | null;
}
