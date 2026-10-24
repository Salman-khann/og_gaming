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

export type MatchType = 'solo_lfg' | 'team_vs_team' | 'gather_5v5';
export type MatchStatus = 'open' | 'matched' | 'closed' | 'cancelled';

export interface MatchPlayer {
  team_id?: string;
  team_name?: string;
  id: string;
  nickname: string;
  level: number | null;
  elo: number | null;
  role?: string;
}

export interface MatchRequest {
  balanced_teams?: { a: MatchPlayer[]; b: MatchPlayer[]; difference: number } | null;
  id: string;
  creator_id: string | null;
  can_delete?: boolean;
  host_name?: string | null;
  contact_phone?: string | null;
  creator?: Profile;
  title: string;
  type: MatchType;
  description?: string | null;
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
  bracket_type: 'single' | 'double';
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
  entry_fee: number;
  payment_instructions: string;
  rules: string;
  registrations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRosterMember {
  nickname: string;
  faceit_id?: string;
  game_id?: string;
  level: number | null;
  elo: number | null;
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface Registration {
  can_manage?: boolean;
  contact?: {
    captain_name: string;
    email: string;
    phone: string;
    city: string;
    notes: string;
  } | null;
  amount_due: number;
  no_show: boolean;
  id: string;
  tournament_id: string;
  tournament?: Tournament;
  team_id?: string | null;
  captain_id: string | null;
  captain?: Profile;
  team_name: string;
  roster_details: RegistrationRosterMember[];
  avg_faceit_level: number;
  status: RegistrationStatus;
  payment_status: 'not_required' | 'pending' | 'verified';
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

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  bracket: 'winners' | 'losers' | 'final' | 'reset';
  round: number;
  position: number;
  team_a: string | null;
  team_b: string | null;
  winner_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: 'pending' | 'completed' | 'bye';
  node_key?: string | null;
  source_a?: string | null;
  source_b?: string | null;
  outcome_a?: 'winner' | 'loser';
  outcome_b?: 'winner' | 'loser';
  scheduled_at?: string | null;
}
