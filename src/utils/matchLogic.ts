import type { FinishAction, Match, MatchLogEntry } from '@/types/bxtm'
import { FINISH_POINTS } from '@/types/bxtm'

export function pointsForAction(action: FinishAction): number {
  return FINISH_POINTS[action]
}

export function applyScore(
  match: Match,
  winnerParticipantId: string,
  action: FinishAction,
): Match {
  if (match.status === 'completed') return match
  if (winnerParticipantId !== match.p1_participant_id && winnerParticipantId !== match.p2_participant_id) return match
  const points = pointsForAction(action)
  const now = new Date().toISOString()
  const log: MatchLogEntry = {
    winner_participant_id: winnerParticipantId,
    action,
    points,
    timestamp: now,
  }
  const p1_score = match.p1_score + (winnerParticipantId === match.p1_participant_id ? points : 0)
  const p2_score = match.p2_score + (winnerParticipantId === match.p2_participant_id ? points : 0)
  const target = match.target_points
  const finished = p1_score >= target || p2_score >= target
  return {
    ...match,
    p1_score,
    p2_score,
    logs: [...match.logs, log],
    status: finished ? 'completed' : 'in_progress',
    startedAt: match.startedAt ?? now,
    endedAt: finished ? now : undefined,
    winner_participant_id: finished
      ? p1_score > p2_score
        ? match.p1_participant_id
        : match.p2_participant_id
      : undefined,
  }
}

export function undoLast(match: Match): Match {
  if (match.logs.length === 0) return match
  const logs = [...match.logs]
  const last = logs.pop()
  if (!last) return match
  const p1_score =
    match.p1_score - (last.winner_participant_id === match.p1_participant_id ? last.points : 0)
  const p2_score =
    match.p2_score - (last.winner_participant_id === match.p2_participant_id ? last.points : 0)
  return {
    ...match,
    p1_score: Math.max(0, p1_score),
    p2_score: Math.max(0, p2_score),
    logs,
    status: logs.length === 0 ? 'pending' : 'in_progress',
    startedAt: logs.length === 0 ? undefined : match.startedAt,
    endedAt: undefined,
    winner_participant_id: undefined,
  }
}

export function isMatchFinished(match: Match): boolean {
  return (
    match.status === 'completed' ||
    match.p1_score >= match.target_points ||
    match.p2_score >= match.target_points
  )
}
