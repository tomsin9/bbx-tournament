import type { FinishAction, Match, MatchLogEntry } from '@/types/bxtm'
import { FINISH_POINTS } from '@/types/bxtm'

export function pointsForAction(action: FinishAction): number {
  return FINISH_POINTS[action]
}

export function applyScore(
  match: Match,
  winnerId: string,
  action: FinishAction,
): Match {
  if (match.status !== 'live') return match
  if (winnerId !== match.p1_id && winnerId !== match.p2_id) return match
  const points = pointsForAction(action)
  const log: MatchLogEntry = { winner_id: winnerId, action, points }
  const p1_score = match.p1_score + (winnerId === match.p1_id ? points : 0)
  const p2_score = match.p2_score + (winnerId === match.p2_id ? points : 0)
  const target = match.target_points
  const finished = p1_score >= target || p2_score >= target
  return {
    ...match,
    p1_score,
    p2_score,
    logs: [...match.logs, log],
    status: finished ? 'finished' : 'live',
  }
}

export function undoLast(match: Match): Match {
  if (match.logs.length === 0) return match
  const logs = [...match.logs]
  const last = logs.pop()
  if (!last) return match
  const p1_score = match.p1_score - (last.winner_id === match.p1_id ? last.points : 0)
  const p2_score = match.p2_score - (last.winner_id === match.p2_id ? last.points : 0)
  return {
    ...match,
    p1_score: Math.max(0, p1_score),
    p2_score: Math.max(0, p2_score),
    logs,
    status: 'live',
  }
}

export function isMatchFinished(match: Match): boolean {
  return (
    match.status === 'finished' ||
    match.p1_score >= match.target_points ||
    match.p2_score >= match.target_points
  )
}
