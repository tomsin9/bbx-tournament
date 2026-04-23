import type {
  BattleFormat,
  BxTmState,
  FinishAction,
  Match,
  MatchLogEntry,
  StadiumType,
  TournamentParticipant,
} from '@/types/bxtm'
import { APP_VERSION, FINISH_POINTS, emptyState } from '@/types/bxtm'

const FINISH_ACTIONS = new Set<FinishAction>([
  'Over Finish',
  'Burst Finish',
  'Xtreme Finish',
  'Spin Finish',
])
const BATTLE_FORMATS = new Set<BattleFormat>(['singles', 'doubles'])
const STADIUM_TYPES = new Set<StadiumType>([
  'xtreme_standard',
  'infinity',
  'electric',
  'three_player',
  'custom',
])

function coerceBattleFormat(v: unknown): BattleFormat {
  return typeof v === 'string' && BATTLE_FORMATS.has(v as BattleFormat) ? (v as BattleFormat) : 'singles'
}

function coerceStadiumType(v: unknown): StadiumType {
  return typeof v === 'string' && STADIUM_TYPES.has(v as StadiumType)
    ? (v as StadiumType)
    : 'xtreme_standard'
}

export type ParseResult =
  | { ok: true; data: BxTmState }
  | { ok: false; error: string }

function isFinishAction(v: unknown): v is FinishAction {
  return typeof v === 'string' && FINISH_ACTIONS.has(v as FinishAction)
}

function isLogEntry(v: unknown): v is MatchLogEntry {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.winner_participant_id !== 'string' && typeof o.winner_id !== 'string') return false
  if (!isFinishAction(o.action)) return false
  if (typeof o.points !== 'number' || !Number.isFinite(o.points)) return false
  const expected = FINISH_POINTS[o.action]
  if (o.points !== expected) return false
  return true
}

function isParticipant(v: unknown): v is TournamentParticipant {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return false
  if (typeof o.player_id !== 'string' || !o.player_id) return false
  if (typeof o.name !== 'string' || !o.name) return false
  if (typeof o.created_at !== 'string') return false
  if (o.bey_name !== undefined && typeof o.bey_name !== 'string') return false
  return true
}

function coerceMatch(v: unknown, defaultTargetPoints: number): Match | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.match_id !== 'string' || !o.match_id) return null
  const p1 = typeof o.p1_participant_id === 'string' ? o.p1_participant_id : o.p1_id
  const p2 = typeof o.p2_participant_id === 'string' ? o.p2_participant_id : o.p2_id
  if (typeof p1 !== 'string' || typeof p2 !== 'string') return null
  if (p1 === p2) return null
  if (typeof o.p1_score !== 'number' || typeof o.p2_score !== 'number') return null
  if (!Number.isFinite(o.p1_score) || !Number.isFinite(o.p2_score)) return null
  const rawStatus = o.status
  const status =
    rawStatus === 'pending' || rawStatus === 'in_progress' || rawStatus === 'completed'
      ? rawStatus
      : rawStatus === 'live'
        ? 'in_progress'
        : rawStatus === 'finished'
          ? 'completed'
          : null
  if (!status) return null
  if (typeof o.timestamp !== 'string') return null
  if (o.startedAt !== undefined && typeof o.startedAt !== 'string') return null
  if (o.endedAt !== undefined && typeof o.endedAt !== 'string') return null
  const tp =
    typeof o.target_points === 'number' && o.target_points >= 1
      ? o.target_points
      : defaultTargetPoints
  if (!Array.isArray(o.logs) || !o.logs.every(isLogEntry)) return null
  if (o.tournament_name !== undefined && typeof o.tournament_name !== 'string') return null
  const logs: MatchLogEntry[] = o.logs.map((log) => {
    const l = log as unknown as Record<string, unknown>
    return {
      winner_participant_id:
        typeof l.winner_participant_id === 'string'
          ? l.winner_participant_id
          : (l.winner_id as string),
      action: l.action as FinishAction,
      points: l.points as number,
      timestamp: typeof l.timestamp === 'string' ? l.timestamp : undefined,
    }
  })
  return {
    match_id: o.match_id,
    p1_participant_id: p1,
    p2_participant_id: p2,
    p1_score: o.p1_score,
    p2_score: o.p2_score,
    logs,
    status,
    timestamp: o.timestamp,
    startedAt: o.startedAt as string | undefined,
    endedAt: o.endedAt as string | undefined,
    target_points: tp,
    tournament_name: o.tournament_name as string | undefined,
    winner_participant_id:
      typeof o.winner_participant_id === 'string'
        ? o.winner_participant_id
        : typeof o.winner_id === 'string'
          ? o.winner_id
          : undefined,
  }
}

export function parseBxTmJson(text: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    return { ok: false, error: 'Invalid JSON' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Root must be an object' }
  }
  const root = parsed as Record<string, unknown>
  const version = root.app_version
  if (typeof version !== 'string' || !version) {
    return { ok: false, error: 'Missing app_version' }
  }
  if (typeof root.tournament_name !== 'string') {
    return { ok: false, error: 'Invalid tournament_name' }
  }
  if (typeof root.target_points !== 'number' || root.target_points < 1) {
    return { ok: false, error: 'Invalid target_points' }
  }
  const participantsRaw = Array.isArray(root.participants) ? root.participants : root.players
  if (!Array.isArray(participantsRaw)) {
    return { ok: false, error: 'Invalid participants' }
  }
  const participants: TournamentParticipant[] = participantsRaw
    .map((p) => {
      if (isParticipant(p)) return p
      if (!p || typeof p !== 'object') return null
      const o = p as Record<string, unknown>
      if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.created_at !== 'string') return null
      return {
        id: o.id,
        player_id: typeof o.player_id === 'string' ? o.player_id : o.id,
        name: o.name,
        created_at: o.created_at,
        bey_name: typeof o.bey_name === 'string' ? o.bey_name : undefined,
      }
    })
    .filter((v): v is TournamentParticipant => Boolean(v))
  if (participants.length !== participantsRaw.length) {
    return { ok: false, error: 'Invalid participants' }
  }
  if (!Array.isArray(root.matches)) {
    return { ok: false, error: 'Invalid matches' }
  }
  const matches: Match[] = []
  for (const m of root.matches) {
    const cm = coerceMatch(m, root.target_points)
    if (!cm) return { ok: false, error: 'Invalid matches' }
    matches.push(cm)
  }
  const data: BxTmState = {
    app_version: version,
    tournament_name: root.tournament_name,
    target_points: root.target_points,
    battle_format: coerceBattleFormat(root.battle_format),
    stadium_type: coerceStadiumType(root.stadium_type),
    participants,
    matches,
  }
  return { ok: true, data }
}

export function serializeState(state: BxTmState): string {
  return JSON.stringify(
    { ...state, app_version: APP_VERSION },
    null,
    2,
  )
}

/** Minimal import: only participants/players + matches; merge into empty tournament shell. */
export function normalizeImportedState(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Root must be an object' }
  }
  const root = raw as Record<string, unknown>
  const hasFull =
    typeof root.tournament_name === 'string' &&
    typeof root.target_points === 'number' &&
    (Array.isArray(root.participants) || Array.isArray(root.players)) &&
    Array.isArray(root.matches)

  if (hasFull) {
    return parseBxTmJson(JSON.stringify(raw))
  }

  if ((Array.isArray(root.participants) || Array.isArray(root.players)) && Array.isArray(root.matches)) {
    const participantsRaw: unknown[] = Array.isArray(root.participants)
      ? root.participants
      : Array.isArray(root.players)
        ? root.players
        : []
    const participants: TournamentParticipant[] = participantsRaw
      .map((p) => {
        if (isParticipant(p)) return p
        if (!p || typeof p !== 'object') return null
        const o = p as Record<string, unknown>
        if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.created_at !== 'string') return null
        return {
          id: o.id,
          player_id: typeof o.player_id === 'string' ? o.player_id : o.id,
          name: o.name,
          created_at: o.created_at,
          bey_name: typeof o.bey_name === 'string' ? o.bey_name : undefined,
        }
      })
      .filter((v): v is TournamentParticipant => Boolean(v))
    if (participants.length !== participantsRaw.length) {
      return { ok: false, error: 'Invalid participants' }
    }
    const defaultTarget =
      typeof root.target_points === 'number' && root.target_points >= 1
        ? root.target_points
        : 4
    const matches: Match[] = []
    for (const m of root.matches) {
      const cm = coerceMatch(m, defaultTarget)
      if (!cm) return { ok: false, error: 'Invalid matches' }
      matches.push(cm)
    }
    const base = emptyState()
    const data: BxTmState = {
      ...base,
      app_version: typeof root.app_version === 'string' ? root.app_version : APP_VERSION,
      tournament_name: typeof root.tournament_name === 'string' ? root.tournament_name : '',
      target_points: defaultTarget,
      battle_format: coerceBattleFormat(root.battle_format),
      stadium_type: coerceStadiumType(root.stadium_type),
      participants,
      matches,
    }
    return { ok: true, data }
  }

  return { ok: false, error: 'Unsupported JSON shape' }
}
