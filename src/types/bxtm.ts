export interface Player {
  id: string
  name: string
  created_at: string
  bey_name?: string
}

export type MatchStatus = 'live' | 'finished'

export type FinishAction =
  | 'Over Finish'
  | 'Burst Finish'
  | 'Xtreme Finish'
  | 'Spin Finish'

export interface MatchLogEntry {
  winner_id: string
  action: FinishAction
  points: number
}

export interface Match {
  match_id: string
  p1_id: string
  p2_id: string
  p1_score: number
  p2_score: number
  logs: MatchLogEntry[]
  status: MatchStatus
  timestamp: string
  target_points: number
  tournament_name?: string
}

export interface BxTmState {
  app_version: string
  tournament_name: string
  target_points: number
  players: Player[]
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
}

export const FINISH_POINTS: Record<FinishAction, number> = {
  'Over Finish': 2,
  'Burst Finish': 2,
  'Xtreme Finish': 3,
  'Spin Finish': 1,
}

export const APP_VERSION = '1.0'

export function emptyState(): BxTmState {
  return {
    app_version: APP_VERSION,
    tournament_name: '',
    target_points: 4,
    players: [],
    matches: [],
  }
}
