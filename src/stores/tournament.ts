import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { BxTmState, FinishAction, Match, Player, TournamentRecord } from '@/types/bxtm'
import { APP_VERSION, emptyState } from '@/types/bxtm'
import { normalizeImportedState, serializeState } from '@/utils/exportImport'
import { applyScore as applyScorePure, undoLast as undoLastPure } from '@/utils/matchLogic'
import { emptyCollection, loadFromLocalStorage, saveToLocalStorage } from '@/utils/storage'

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export const useTournamentStore = defineStore('tournament', () => {
  const tournaments = ref<TournamentRecord[]>([])
  const activeTournamentId = ref<string | null>(null)
  const hydrated = ref(false)

  const state = computed<BxTmState>(() => {
    const active = tournaments.value.find((t) => t.id === activeTournamentId.value)
    return active?.state ?? emptyState()
  })

  function ensureActive(): void {
    if (tournaments.value.length === 0) {
      const base = emptyCollection()
      tournaments.value = base.tournaments
      activeTournamentId.value = base.active_tournament_id
      return
    }
    if (!activeTournamentId.value || !tournaments.value.some((t) => t.id === activeTournamentId.value)) {
      activeTournamentId.value = tournaments.value[0]!.id
    }
  }

  function updateState(updater: (draft: BxTmState) => BxTmState): void {
    const idx = tournaments.value.findIndex((t) => t.id === activeTournamentId.value)
    if (idx === -1) return
    const current = tournaments.value[idx]!
    const nextState = { ...updater(current.state), app_version: APP_VERSION }
    const nextTournament: TournamentRecord = {
      ...current,
      updated_at: new Date().toISOString(),
      state: nextState,
    }
    const next = [...tournaments.value]
    next[idx] = nextTournament
    tournaments.value = next
  }

  function replaceState(next: BxTmState) {
    updateState(() => ({
      ...next,
      app_version: APP_VERSION,
    }))
  }

  function hydrate() {
    if (hydrated.value) return
    const payload = loadFromLocalStorage()
    tournaments.value = payload.tournaments
    activeTournamentId.value = payload.active_tournament_id
    ensureActive()
    hydrated.value = true
  }

  watch(
    [tournaments, activeTournamentId],
    () => {
      if (!hydrated.value) return
      ensureActive()
      saveToLocalStorage({
        app_version: APP_VERSION,
        active_tournament_id: activeTournamentId.value,
        tournaments: tournaments.value,
      })
    },
    { deep: true },
  )

  const players = computed(() => state.value.players)
  const matches = computed(() => state.value.matches)
  const tournamentList = computed(() =>
    tournaments.value.map((t) => ({
      id: t.id,
      name: t.state.tournament_name || 'Untitled',
      players: t.state.players.length,
      matches: t.state.matches.length,
      updatedAt: t.updated_at,
      isActive: t.id === activeTournamentId.value,
    })),
  )
  const tournamentName = computed({
    get: () => state.value.tournament_name,
    set: (v: string) => {
      state.value.tournament_name = v
    },
  })
  const targetPoints = computed({
    get: () => state.value.target_points,
    set: (v: number) => {
      state.value.target_points = Math.max(1, Math.floor(v))
    },
  })

  const hasPlayers = computed(() => state.value.players.length > 0)
  const playerLibrary = computed<Player[]>(() => {
    const map = new Map<string, Player>()
    for (const t of tournaments.value) {
      for (const p of t.state.players) {
        const key = `${p.name.trim().toLowerCase()}|${(p.bey_name ?? '').trim().toLowerCase()}`
        if (!map.has(key)) {
          map.set(key, {
            id: p.id,
            name: p.name,
            bey_name: p.bey_name,
            created_at: p.created_at,
          })
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  })
  const liveMatches = computed(() => state.value.matches.filter((m) => m.status === 'live'))
  const finishedMatches = computed(() =>
    state.value.matches.filter((m) => m.status === 'finished'),
  )

  function newTournament() {
    const now = new Date().toISOString()
    const record: TournamentRecord = {
      id: newId('t'),
      created_at: now,
      updated_at: now,
      state: emptyState(),
    }
    tournaments.value = [record, ...tournaments.value]
    activeTournamentId.value = record.id
  }

  function switchTournament(id: string) {
    if (!tournaments.value.some((t) => t.id === id)) return
    activeTournamentId.value = id
  }

  function deleteTournament(id: string) {
    if (tournaments.value.length <= 1) return
    tournaments.value = tournaments.value.filter((t) => t.id !== id)
    ensureActive()
  }

  function applySetup(payload: { tournamentName: string; targetPoints: number; players: Player[] }) {
    updateState((s) => ({
      ...s,
      tournament_name: payload.tournamentName.trim(),
      target_points: Math.max(1, Math.floor(payload.targetPoints)),
      players: payload.players,
    }))
  }

  function addOrUpdatePlayer(payload: { id?: string; name: string; bey_name?: string }) {
    const name = payload.name.trim()
    const bey_name = payload.bey_name?.trim() || undefined
    if (!name) return
    updateState((s) => {
      const next = [...s.players]
      const idx = payload.id ? next.findIndex((p) => p.id === payload.id) : -1
      if (idx >= 0) {
        next[idx] = { ...next[idx]!, name, bey_name }
      } else {
        next.push({
          id: newId('p'),
          name,
          bey_name,
          created_at: new Date().toISOString().slice(0, 10),
        })
      }
      return { ...s, players: next }
    })
  }

  function removePlayer(id: string) {
    updateState((s) => ({
      ...s,
      players: s.players.filter((p) => p.id !== id),
      matches: s.matches.filter((m) => m.p1_id !== id && m.p2_id !== id),
    }))
  }

  function addPlayersFromLibrary(playersToAdd: Array<{ name: string; bey_name?: string }>) {
    const today = new Date().toISOString().slice(0, 10)
    updateState((s) => {
      const existing = new Set(
        s.players.map((p) => `${p.name.trim().toLowerCase()}|${(p.bey_name ?? '').trim().toLowerCase()}`),
      )
      const next = [...s.players]
      for (const p of playersToAdd) {
        const name = p.name.trim()
        const bey_name = p.bey_name?.trim() || undefined
        if (!name) continue
        const key = `${name.toLowerCase()}|${(bey_name ?? '').toLowerCase()}`
        if (existing.has(key)) continue
        existing.add(key)
        next.push({
          id: newId('p'),
          name,
          bey_name,
          created_at: today,
        })
      }
      return { ...s, players: next }
    })
  }

  function importJsonText(text: string) {
    let raw: unknown
    try {
      raw = JSON.parse(text) as unknown
    } catch {
      throw new Error('Invalid JSON')
    }
    const result = normalizeImportedState(raw)
    if (!result.ok) throw new Error(result.error)
    const now = new Date().toISOString()
    const name = result.data.tournament_name?.trim()
      ? result.data.tournament_name
      : `Imported ${now.slice(0, 10)}`
    const record: TournamentRecord = {
      id: newId('t'),
      created_at: now,
      updated_at: now,
      state: {
        ...result.data,
        tournament_name: name,
      },
    }
    tournaments.value = [record, ...tournaments.value]
    activeTournamentId.value = record.id
  }

  function exportJsonText(): string {
    return serializeState(state.value)
  }

  function getMatch(id: string): Match | undefined {
    return state.value.matches.find((m) => m.match_id === id)
  }

  function startMatch(p1_id: string, p2_id: string): string {
    if (p1_id === p2_id) throw new Error('same_player')
    const match: Match = {
      match_id: newId('m'),
      p1_id,
      p2_id,
      p1_score: 0,
      p2_score: 0,
      logs: [],
      status: 'live',
      timestamp: new Date().toISOString(),
      target_points: state.value.target_points,
      tournament_name: state.value.tournament_name || undefined,
    }
    updateState((s) => ({ ...s, matches: [...s.matches, match] }))
    return match.match_id
  }

  function applyScore(matchId: string, winnerId: string, action: FinishAction) {
    const idx = state.value.matches.findIndex((m) => m.match_id === matchId)
    if (idx === -1) return
    const updated = applyScorePure(state.value.matches[idx]!, winnerId, action)
    const next = [...state.value.matches]
    next[idx] = updated
    updateState((s) => ({ ...s, matches: next }))
  }

  function undo(matchId: string) {
    const idx = state.value.matches.findIndex((m) => m.match_id === matchId)
    if (idx === -1) return
    const updated = undoLastPure(state.value.matches[idx]!)
    const next = [...state.value.matches]
    next[idx] = updated
    updateState((s) => ({ ...s, matches: next }))
  }

  function playerById(id: string): Player | undefined {
    return state.value.players.find((p) => p.id === id)
  }

  return {
    state,
    hydrated,
    hydrate,
    players,
    matches,
    tournamentList,
    tournamentName,
    targetPoints,
    hasPlayers,
    playerLibrary,
    liveMatches,
    finishedMatches,
    newTournament,
    switchTournament,
    deleteTournament,
    applySetup,
    addOrUpdatePlayer,
    removePlayer,
    addPlayersFromLibrary,
    importJsonText,
    exportJsonText,
    getMatch,
    startMatch,
    applyScore,
    undo,
    playerById,
    replaceState,
  }
})
