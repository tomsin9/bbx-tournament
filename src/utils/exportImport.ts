import type { BxTmState, FinishAction, Match, MatchLogEntry, Player } from '@/types/bxtm'
import { APP_VERSION, FINISH_POINTS, emptyState } from '@/types/bxtm'

const FINISH_ACTIONS = new Set<FinishAction>([
  'Over Finish',
  'Burst Finish',
  'Xtreme Finish',
  'Spin Finish',
])

export type ParseResult =
  | { ok: true; data: BxTmState }
  | { ok: false; error: string }

function isFinishAction(v: unknown): v is FinishAction {
  return typeof v === 'string' && FINISH_ACTIONS.has(v as FinishAction)
}

function isLogEntry(v: unknown): v is MatchLogEntry {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.winner_id !== 'string') return false
  if (!isFinishAction(o.action)) return false
  if (typeof o.points !== 'number' || !Number.isFinite(o.points)) return false
  const expected = FINISH_POINTS[o.action]
  if (o.points !== expected) return false
  return true
}

function isPlayer(v: unknown): v is Player {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id) return false
  if (typeof o.name !== 'string' || !o.name) return false
  if (typeof o.created_at !== 'string') return false
  if (o.bey_name !== undefined && typeof o.bey_name !== 'string') return false
  return true
}

function coerceMatch(v: unknown, defaultTargetPoints: number): Match | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.match_id !== 'string' || !o.match_id) return null
  if (typeof o.p1_id !== 'string' || typeof o.p2_id !== 'string') return null
  if (o.p1_id === o.p2_id) return null
  if (typeof o.p1_score !== 'number' || typeof o.p2_score !== 'number') return null
  if (!Number.isFinite(o.p1_score) || !Number.isFinite(o.p2_score)) return null
  if (o.status !== 'live' && o.status !== 'finished') return null
  if (typeof o.timestamp !== 'string') return null
  const tp =
    typeof o.target_points === 'number' && o.target_points >= 1
      ? o.target_points
      : defaultTargetPoints
  if (!Array.isArray(o.logs) || !o.logs.every(isLogEntry)) return null
  if (o.tournament_name !== undefined && typeof o.tournament_name !== 'string') return null
  return {
    match_id: o.match_id,
    p1_id: o.p1_id,
    p2_id: o.p2_id,
    p1_score: o.p1_score,
    p2_score: o.p2_score,
    logs: o.logs,
    status: o.status,
    timestamp: o.timestamp,
    target_points: tp,
    tournament_name: o.tournament_name as string | undefined,
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
  if (!Array.isArray(root.players) || !root.players.every(isPlayer)) {
    return { ok: false, error: 'Invalid players' }
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
    players: root.players,
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

/** Minimal import: only players + matches (spec sample); merge into empty tournament shell. */
export function normalizeImportedState(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Root must be an object' }
  }
  const root = raw as Record<string, unknown>
  const hasFull =
    typeof root.tournament_name === 'string' &&
    typeof root.target_points === 'number' &&
    Array.isArray(root.players) &&
    Array.isArray(root.matches)

  if (hasFull) {
    return parseBxTmJson(JSON.stringify(raw))
  }

  if (Array.isArray(root.players) && Array.isArray(root.matches)) {
    if (!root.players.every(isPlayer)) {
      return { ok: false, error: 'Invalid players' }
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
      players: root.players,
      matches,
    }
    return { ok: true, data }
  }

  return { ok: false, error: 'Unsupported JSON shape' }
}
