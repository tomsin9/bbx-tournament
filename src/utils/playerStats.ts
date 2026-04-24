import type { FinishAction, Match, TournamentParticipant } from '@/types/bxtm'

export interface PlayerStats {
  playerId: string
  wins: number
  losses: number
  totalPointsScored: number
  finishBreakdown: Record<FinishAction, number>
}

function emptyBreakdown(): Record<FinishAction, number> {
  return {
    'Over Finish': 0,
    'Burst Finish': 0,
    'Xtreme Finish': 0,
    'Spin Finish': 0,
  }
}

export function computePlayerStats(
  players: TournamentParticipant[],
  matches: Match[],
): Map<string, PlayerStats> {
  const map = new Map<string, PlayerStats>()
  const ensureStats = (participantId: string): PlayerStats => {
    let stats = map.get(participantId)
    if (!stats) {
      stats = {
        playerId: participantId,
        wins: 0,
        losses: 0,
        totalPointsScored: 0,
        finishBreakdown: emptyBreakdown(),
      }
      map.set(participantId, stats)
    }
    return stats
  }

  for (const p of players) {
    ensureStats(p.id)
  }

  for (const m of matches) {
    if (m.status !== 'completed') continue
    const p1Won = m.p1_score > m.p2_score
    const p2Won = m.p2_score > m.p1_score
    const p1Stats = ensureStats(m.p1_participant_id)
    const p2Stats = ensureStats(m.p2_participant_id)

    if (p1Won) {
      p1Stats.wins += 1
      p2Stats.losses += 1
    } else if (p2Won) {
      p2Stats.wins += 1
      p1Stats.losses += 1
    }

    for (const log of m.logs) {
      const st = ensureStats(log.winner_participant_id)
      st.totalPointsScored += log.points
      st.finishBreakdown[log.action] += 1
    }
  }

  return map
}

export function winRate(stats: PlayerStats): number {
  const played = stats.wins + stats.losses
  if (played === 0) return 0
  return stats.wins / played
}
