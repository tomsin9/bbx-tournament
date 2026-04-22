import type { BxTmState, TournamentCollection, TournamentRecord } from '@/types/bxtm'
import { APP_VERSION, emptyState } from '@/types/bxtm'
import { normalizeImportedState } from '@/utils/exportImport'

export const STORAGE_KEY = 'bxtm_state'

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function makeRecord(state: BxTmState): TournamentRecord {
  const now = new Date().toISOString()
  return {
    id: newId('t'),
    created_at: now,
    updated_at: now,
    state,
  }
}

export function emptyCollection(): TournamentCollection {
  const rec = makeRecord(emptyState())
  return {
    app_version: APP_VERSION,
    active_tournament_id: rec.id,
    tournaments: [rec],
  }
}

export function loadFromLocalStorage(): TournamentCollection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyCollection()
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      const root = parsed as Record<string, unknown>
      if (Array.isArray(root.tournaments)) {
        const tournaments: TournamentRecord[] = []
        for (const item of root.tournaments) {
          if (!item || typeof item !== 'object') continue
          const rec = item as Record<string, unknown>
          if (typeof rec.id !== 'string') continue
          const norm = normalizeImportedState(rec.state)
          if (!norm.ok) continue
          const created_at =
            typeof rec.created_at === 'string' ? rec.created_at : new Date().toISOString()
          const updated_at =
            typeof rec.updated_at === 'string' ? rec.updated_at : new Date().toISOString()
          tournaments.push({
            id: rec.id,
            created_at,
            updated_at,
            state: norm.data,
          })
        }
        if (tournaments.length > 0) {
          const active =
            typeof root.active_tournament_id === 'string' &&
            tournaments.some((t) => t.id === root.active_tournament_id)
              ? root.active_tournament_id
              : tournaments[0]!.id
          return {
            app_version: APP_VERSION,
            active_tournament_id: active,
            tournaments,
          }
        }
      }
    }
    // Backward compatibility: old single-tournament payload
    const norm = normalizeImportedState(parsed)
    if (norm.ok) {
      const rec = makeRecord(norm.data)
      return {
        app_version: APP_VERSION,
        active_tournament_id: rec.id,
        tournaments: [rec],
      }
    }
    return emptyCollection()
  } catch {
    return emptyCollection()
  }
}

export function saveToLocalStorage(state: TournamentCollection): void {
  const payload: TournamentCollection = { ...state, app_version: APP_VERSION }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
