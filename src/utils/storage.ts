import type {
  BxTmState,
  PlayerProfile,
  TournamentCollection,
  TournamentParticipant,
  TournamentRecord,
} from '@/types/bxtm'
import { APP_VERSION } from '@/types/bxtm'
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
  return {
    app_version: APP_VERSION,
    active_tournament_id: null,
    tournaments: [],
    player_catalog: [],
  }
}

function buildCatalog(tournaments: TournamentRecord[], rawCatalog: unknown): PlayerProfile[] {
  function mergeCombos(existing: PlayerProfile | undefined, incoming: Array<string | undefined>): string[] {
    const seen = new Set<string>()
    const next: string[] = []
    for (const raw of [...(existing?.bey_combos ?? []), existing?.default_bey_name, ...incoming]) {
      const combo = raw?.trim()
      if (!combo || seen.has(combo)) continue
      seen.add(combo)
      next.push(combo)
    }
    return next
  }

  const map = new Map<string, PlayerProfile>()
  if (Array.isArray(rawCatalog)) {
    for (const p of rawCatalog) {
      if (!p || typeof p !== 'object') continue
      const o = p as Record<string, unknown>
      if (typeof o.id !== 'string' || typeof o.name !== 'string') continue
      const existing = map.get(o.id)
      const rawCombos = Array.isArray(o.bey_combos)
        ? o.bey_combos.filter((v): v is string => typeof v === 'string')
        : []
      const combos = mergeCombos(existing, [
        typeof o.default_bey_name === 'string' ? o.default_bey_name : undefined,
        ...rawCombos,
      ])
      map.set(o.id, {
        id: o.id,
        name: o.name,
        created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString().slice(0, 10),
        default_bey_name: typeof o.default_bey_name === 'string' ? o.default_bey_name : undefined,
        bey_combos: combos,
      })
    }
  }
  for (const t of tournaments) {
    const participants = t.state.participants as TournamentParticipant[]
    for (const p of participants) {
      const existing = map.get(p.player_id)
      const combos = mergeCombos(existing, [p.bey_name])
      if (existing) {
        map.set(p.player_id, {
          ...existing,
          bey_combos: combos,
          default_bey_name: existing.default_bey_name ?? p.bey_name,
        })
        continue
      }
      map.set(p.player_id, {
        id: p.player_id,
        name: p.name,
        created_at: p.created_at,
        default_bey_name: p.bey_name,
        bey_combos: combos,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
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
            player_catalog: buildCatalog(tournaments, root.player_catalog),
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
        player_catalog: buildCatalog([rec], []),
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
