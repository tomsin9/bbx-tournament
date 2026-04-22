import { describe, expect, it } from 'vitest'
import { normalizeImportedState, parseBxTmJson } from '@/utils/exportImport'

describe('normalizeImportedState', () => {
  it('accepts spec-like minimal JSON', () => {
    const raw = {
      app_version: '1.0',
      participants: [
        { id: 'p-01', name: 'Tom', created_at: '2026-04-21' },
        { id: 'p-02', name: 'Jerry', created_at: '2026-04-21' },
      ],
      matches: [
        {
          match_id: 'm-101',
          p1_participant_id: 'p-01',
          p2_participant_id: 'p-02',
          p1_score: 4,
          p2_score: 1,
          logs: [
            { winner_participant_id: 'p-01', action: 'Xtreme Finish', points: 3 },
            { winner_participant_id: 'p-02', action: 'Spin Finish', points: 1 },
            { winner_participant_id: 'p-01', action: 'Spin Finish', points: 1 },
          ],
          status: 'finished',
          timestamp: '2026-04-21T15:30:00Z',
        },
      ],
    }
    const r = normalizeImportedState(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.participants).toHaveLength(2)
    expect(r.data.matches[0]?.target_points).toBe(4)
  })

  it('rejects bad log points', () => {
    const raw = {
      app_version: '1.0',
      participants: [],
      matches: [
        {
          match_id: 'm-1',
          p1_participant_id: 'a',
          p2_participant_id: 'b',
          p1_score: 0,
          p2_score: 0,
          logs: [{ winner_participant_id: 'a', action: 'Spin Finish', points: 99 }],
          status: 'live',
          timestamp: '2026-01-01T00:00:00Z',
        },
      ],
    }
    const r = normalizeImportedState(raw)
    expect(r.ok).toBe(false)
  })
})

describe('parseBxTmJson', () => {
  it('parses full document', () => {
    const doc = {
      app_version: '1.0',
      tournament_name: 'Test',
      target_points: 4,
      participants: [{ id: 'p1', player_id: 'pl1', name: 'A', created_at: '2026-01-01' }],
      matches: [],
    }
    const r = parseBxTmJson(JSON.stringify(doc))
    expect(r.ok).toBe(true)
  })
})
