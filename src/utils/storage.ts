import type {
  BxTmState,
  Combo,
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
  function normalizeBeys(values: Array<string | undefined>): string[] {
    const seen = new Set<string>()
    const next: string[] = []
    for (const raw of values) {
      const pieces = (raw ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
      for (const bey of pieces) {
        if (seen.has(bey)) continue
        seen.add(bey)
        next.push(bey)
      }
    }
    return next
  }

  function normalizeCombos(
    existing: PlayerProfile | undefined,
    incomingCombos: Combo[],
    legacyIncomingBeys: Array<string | undefined>,
  ): Combo[] {
    const map = new Map<string, Combo>()
    const comboKey = (combo: Combo) => normalizeBeys(combo.beys).join('|')
    function upsertByBeys(candidate: Combo): void {
      const beys = normalizeBeys(candidate.beys)
      if (beys.length === 0) return
      const next: Combo = { ...candidate, beys }
      const key = comboKey(next)
      const prev = map.get(key)
      if (!prev) {
        map.set(key, next)
        return
      }
      // Keep the most recently used version while preserving optional display name.
      const prevTime = prev.lastUsed || ''
      const nextTime = next.lastUsed || ''
      map.set(
        key,
        nextTime >= prevTime
          ? { ...next, name: next.name ?? prev.name }
          : { ...prev, name: prev.name ?? next.name },
      )
    }
    for (const combo of existing?.combos ?? []) {
      if (!combo.id || combo.beys.length === 0) continue
      upsertByBeys(combo)
    }
    for (const combo of incomingCombos) {
      if (!combo.id || combo.beys.length === 0) continue
      upsertByBeys(combo)
    }
    for (const bey of legacyIncomingBeys) {
      const beys = normalizeBeys([bey])
      if (beys.length === 0) continue
      upsertByBeys({
        id: `legacy-${beys[0]}`,
        beys,
        lastUsed: new Date().toISOString(),
      })
    }
    return [...map.values()].sort((a, b) => (b.lastUsed || '').localeCompare(a.lastUsed || ''))
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
      const rawComboObjects = Array.isArray(o.combos)
        ? o.combos
            .map((combo): Combo | null => {
              if (!combo || typeof combo !== 'object') return null
              const c = combo as Record<string, unknown>
              if (typeof c.id !== 'string' || !Array.isArray(c.beys)) return null
              const beys = c.beys.filter((b): b is string => typeof b === 'string')
              return {
                id: c.id,
                beys,
                lastUsed:
                  typeof c.lastUsed === 'string' ? c.lastUsed : new Date().toISOString(),
                name: typeof c.name === 'string' ? c.name : undefined,
              }
            })
            .filter((v): v is Combo => Boolean(v))
        : []
      const legacyIncoming =
        rawComboObjects.length > 0
          ? []
          : [
              typeof o.default_bey_name === 'string' ? o.default_bey_name : undefined,
              ...rawCombos,
            ]
      const combos = normalizeCombos(existing, rawComboObjects, [
        ...legacyIncoming,
      ])
      map.set(o.id, {
        id: o.id,
        name: o.name,
        created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString().slice(0, 10),
        combos,
        default_bey_name: typeof o.default_bey_name === 'string' ? o.default_bey_name : combos[0]?.beys[0],
        bey_combos: combos.map((c) => c.beys.join(', ')),
      })
    }
  }
  for (const t of tournaments) {
    const participants = t.state.participants as TournamentParticipant[]
    for (const p of participants) {
      const existing = map.get(p.player_id)
      const participantCombo =
        p.beys && p.beys.length > 0
          ? [
              {
                id: `participant-${p.id}`,
                beys: normalizeBeys(p.beys),
                lastUsed: new Date().toISOString(),
              } as Combo,
            ]
          : []
      const legacyBeys = participantCombo.length > 0 ? [] : [p.bey_name]
      const combos = normalizeCombos(existing, participantCombo, legacyBeys)
      if (existing) {
        map.set(p.player_id, {
          ...existing,
          combos,
          default_bey_name: existing.default_bey_name ?? combos[0]?.beys[0],
          bey_combos: combos.map((c) => c.beys.join(', ')),
        })
        continue
      }
      map.set(p.player_id, {
        id: p.player_id,
        name: p.name,
        created_at: p.created_at,
        combos,
        default_bey_name: combos[0]?.beys[0],
        bey_combos: combos.map((c) => c.beys.join(', ')),
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
