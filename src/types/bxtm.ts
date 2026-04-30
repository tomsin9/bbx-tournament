export interface Combo {
  id: string
  beys: string[]
  lastUsed: string
  name?: string
}

export interface PlayerProfile {
  id: string
  name: string
  created_at: string
  combos: Combo[]
  // Legacy fields kept for backward compatibility and migration.
  default_bey_name?: string
  bey_combos?: string[]
}

export interface TournamentParticipant {
  id: string
  player_id: string
  name: string
  created_at: string
  bey_name?: string
  beys?: string[]
}

export type MatchStatus = 'pending' | 'in_progress' | 'completed'
export type MatchStage =
  | 'round_robin'
  | 'semifinal'
  | 'final'
  | 'third_place'
  | 'elimination'
  | 'manual'

export type FinishAction =
  | 'Over Finish'
  | 'Burst Finish'
  | 'Xtreme Finish'
  | 'Spin Finish'

export interface MatchLogEntry {
  winner_participant_id: string
  action: FinishAction
  points: number
  timestamp?: string
}

export interface Match {
  match_id: string
  p1_participant_id: string
  p2_participant_id: string
  p1_bey_name?: string
  p2_bey_name?: string
  p1_score: number
  p2_score: number
  logs: MatchLogEntry[]
  status: MatchStatus
  timestamp: string
  startedAt?: string
  endedAt?: string
  target_points: number
  tournament_name?: string
  winner_participant_id?: string
  stage?: MatchStage
}

export type BattleFormat = 'singles' | 'doubles'
export type TournamentFormat = 'free' | 'round_robin' | 'single_elimination'

export type StadiumType =
  | 'xtreme_standard'
  | 'infinity'
  | 'electric'
  | 'three_player'
  | 'custom'

export interface BxTmState {
  app_version: string
  tournament_name: string
  target_points: number
  max_beys_per_player: number
  battle_format: BattleFormat
  tournament_format: TournamentFormat
  playoff_enabled: boolean
  playoff_third_place: boolean
  stadium_type: StadiumType
  participants: TournamentParticipant[]
  matches: Match[]
}

export interface TournamentRecord {
  id: string
  created_at: string
  updated_at: string
  state: BxTmState
}

export interface TournamentCollection {
  app_version: string
  active_tournament_id: string | null
  tournaments: TournamentRecord[]
  player_catalog: PlayerProfile[]
}

export const FINISH_POINTS: Record<FinishAction, number> = {
  'Over Finish': 2,
  'Burst Finish': 2,
  'Xtreme Finish': 3,
  'Spin Finish': 1,
}

export const APP_VERSION = '1.5'

export function emptyState(): BxTmState {
  return {
    app_version: APP_VERSION,
    tournament_name: '',
    target_points: 4,
    max_beys_per_player: 3,
    battle_format: 'singles',
    tournament_format: 'free',
    playoff_enabled: false,
    playoff_third_place: true,
    stadium_type: 'xtreme_standard',
    participants: [],
    matches: [],
  }
}
