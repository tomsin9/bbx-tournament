import { describe, expect, it } from 'vitest'
import type { Match } from '@/types/bxtm'
import { applyScore, isMatchFinished, undoLast } from '@/utils/matchLogic'

function baseMatch(overrides?: Partial<Match>): Match {
  return {
    match_id: 'm-1',
    p1_participant_id: 'a',
    p2_participant_id: 'b',
    p1_score: 0,
    p2_score: 0,
    logs: [],
    status: 'pending',
    timestamp: '2026-01-01T00:00:00Z',
    target_points: 4,
    ...overrides,
  }
}

describe('applyScore', () => {
  it('adds points and log', () => {
    const m = applyScore(baseMatch(), 'a', 'Spin Finish')
    expect(m.p1_score).toBe(1)
    expect(m.p2_score).toBe(0)
    expect(m.logs).toHaveLength(1)
    expect(m.status).toBe('in_progress')
    expect(typeof m.startedAt).toBe('string')
    expect(m.endedAt).toBeUndefined()
  })

  it('finishes when target reached', () => {
    let m = baseMatch({ p1_score: 3 })
    m = applyScore(m, 'a', 'Spin Finish')
    expect(m.p1_score).toBe(4)
    expect(m.status).toBe('completed')
    expect(typeof m.endedAt).toBe('string')
  })

  it('ignores when already finished', () => {
    const m0 = baseMatch({ status: 'completed', p1_score: 4, p2_score: 0 })
    const m = applyScore(m0, 'b', 'Xtreme Finish')
    expect(m.p2_score).toBe(0)
    expect(m.logs.length).toBe(m0.logs.length)
  })
})

describe('undoLast', () => {
  it('reverts last log and keeps in_progress when logs remain', () => {
    let m = baseMatch()
    m = applyScore(m, 'a', 'Xtreme Finish')
    m = applyScore(m, 'b', 'Spin Finish')
    m = undoLast(m)
    expect(m.p1_score).toBe(3)
    expect(m.p2_score).toBe(0)
    expect(m.logs).toHaveLength(1)
    expect(m.status).toBe('in_progress')
  })

  it('returns pending when undo clears all logs', () => {
    let m = baseMatch()
    m = applyScore(m, 'a', 'Spin Finish')
    m = undoLast(m)
    expect(m.status).toBe('pending')
    expect(m.startedAt).toBeUndefined()
    expect(m.endedAt).toBeUndefined()
  })
})

describe('isMatchFinished', () => {
  it('detects score threshold', () => {
    expect(isMatchFinished(baseMatch({ p1_score: 4, status: 'in_progress' }))).toBe(true)
  })
})
