import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type {
  BattleFormat,
  BxTmState,
  FinishAction,
  Match,
  PlayerProfile,
  StadiumType,
  TournamentFormat,
  TournamentParticipant,
  TournamentRecord,
} from '@/types/bxtm'
import { APP_VERSION, emptyState } from '@/types/bxtm'
import { normalizeImportedState, serializeState } from '@/utils/exportImport'
import { applyScore as applyScorePure, undoLast as undoLastPure } from '@/utils/matchLogic'
import { loadFromLocalStorage, saveToLocalStorage } from '@/utils/storage'

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function uniqueCombos(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of values) {
    const combo = raw?.trim()
    if (!combo || seen.has(combo)) continue
    seen.add(combo)
    result.push(combo)
  }
  return result
}

function mergeProfileCombos(profile: PlayerProfile, beyName?: string): string[] {
  return uniqueCombos([...(profile.bey_combos ?? []), profile.default_bey_name, beyName])
}

function shuffle<T>(values: T[]): T[] {
  const out = [...values]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function createRoundRobinPairs(ids: string[]): Array<[string, string]> {
  if (ids.length < 2) return []
  const all = [...ids]
  if (all.length % 2 === 1) all.push('__BYE__')
  const rounds = all.length - 1
  const half = all.length / 2
  const rotation = [...all]
  const pairs: Array<[string, string]> = []
  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = rotation[i]!
      const b = rotation[rotation.length - 1 - i]!
      if (a !== '__BYE__' && b !== '__BYE__') pairs.push([a, b])
    }
    const fixed = rotation[0]!
    const moved = rotation.pop()!
    rotation.splice(1, 0, moved)
    rotation[0] = fixed
  }
  return pairs
}

function completedWinnerId(match: Match): string | null {
  if (match.status !== 'completed') return null
  if (match.winner_participant_id) return match.winner_participant_id
  if (match.p1_score > match.p2_score) return match.p1_participant_id
  if (match.p2_score > match.p1_score) return match.p2_participant_id
  return null
}

export const useTournamentStore = defineStore('tournament', () => {
  const tournaments = ref<TournamentRecord[]>([])
  const activeTournamentId = ref<string | null>(null)
  const playerCatalog = ref<PlayerProfile[]>([])
  const hydrated = ref(false)

  const state = computed<BxTmState>(() => {
    const active = tournaments.value.find((t) => t.id === activeTournamentId.value)
    return active?.state ?? emptyState()
  })

  function ensureActive(): void {
    if (tournaments.value.length === 0) {
      activeTournamentId.value = null
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
    playerCatalog.value = payload.player_catalog
    ensureActive()
    hydrated.value = true
  }

  watch(
    [tournaments, activeTournamentId, playerCatalog],
    () => {
      if (!hydrated.value) return
      ensureActive()
      saveToLocalStorage({
        app_version: APP_VERSION,
        active_tournament_id: activeTournamentId.value,
        tournaments: tournaments.value,
        player_catalog: playerCatalog.value,
      })
    },
    { deep: true },
  )

  const players = computed(() => state.value.participants)
  const matches = computed(() => state.value.matches)
  const tournamentList = computed(() =>
    tournaments.value.map((t) => ({
      isCompleted:
        t.state.matches.length > 0 &&
        t.state.matches.every((m) => m.status === 'completed'),
      id: t.id,
      name: t.state.tournament_name || 'Untitled',
      players: t.state.participants.length,
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
  const battleFormat = computed({
    get: () => state.value.battle_format,
    set: (v: BattleFormat) => {
      state.value.battle_format = v
    },
  })
  const tournamentFormat = computed({
    get: () => state.value.tournament_format,
    set: (v: TournamentFormat) => {
      state.value.tournament_format = v
    },
  })
  const playoffEnabled = computed({
    get: () => state.value.playoff_enabled,
    set: (v: boolean) => {
      state.value.playoff_enabled = v
    },
  })
  const playoffThirdPlace = computed({
    get: () => state.value.playoff_third_place,
    set: (v: boolean) => {
      state.value.playoff_third_place = v
    },
  })
  const stadiumType = computed({
    get: () => state.value.stadium_type,
    set: (v: StadiumType) => {
      state.value.stadium_type = v
    },
  })

  const hasPlayers = computed(() => state.value.participants.length > 0)
  const playerLibrary = computed(() =>
    [...playerCatalog.value].sort((a, b) => a.name.localeCompare(b.name)),
  )
  const playerCatalogMap = computed(() => {
    const map = new Map<string, PlayerProfile>()
    for (const p of playerCatalog.value) map.set(p.id, p)
    return map
  })
  const liveMatches = computed(() =>
    state.value.matches.filter((m) => m.status === 'pending' || m.status === 'in_progress'),
  )
  const finishedMatches = computed(() =>
    state.value.matches.filter((m) => m.status === 'completed'),
  )
  const allFinishedMatches = computed(() => {
    return tournaments.value.flatMap((t) => {
      const participantNameById = new Map(
        t.state.participants.map((p) => [p.id, p.name] as const),
      )
      const tournamentName = t.state.tournament_name?.trim() || 'Untitled'
      return t.state.matches
        .filter((m) => m.status === 'completed')
        .map((m) => ({
          ...m,
          tournament_id: t.id,
          tournament_name: m.tournament_name?.trim() || tournamentName,
          p1_name: participantNameById.get(m.p1_participant_id) ?? m.p1_participant_id,
          p2_name: participantNameById.get(m.p2_participant_id) ?? m.p2_participant_id,
          p1_bey_name: m.p1_bey_name,
          p2_bey_name: m.p2_bey_name,
        }))
    })
  })

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
    tournaments.value = tournaments.value.filter((t) => t.id !== id)
    ensureActive()
  }

  function applySetup(payload: {
    tournamentName: string
    targetPoints: number
    battleFormat: BattleFormat
    tournamentFormat: TournamentFormat
    playoffEnabled: boolean
    playoffThirdPlace: boolean
    stadiumType: StadiumType
    players: TournamentParticipant[]
  }) {
    updateState((s) => ({
      ...s,
      tournament_name: payload.tournamentName.trim(),
      target_points: Math.max(1, Math.floor(payload.targetPoints)),
      battle_format: payload.battleFormat,
      tournament_format: payload.tournamentFormat,
      playoff_enabled: payload.playoffEnabled,
      playoff_third_place: payload.playoffThirdPlace,
      stadium_type: payload.stadiumType,
      participants: payload.players,
      matches: [],
    }))
  }

  function buildInitialScheduledMatches() {
    if (state.value.tournament_format === 'free') return
    if (state.value.matches.length > 0) return
    const ids = state.value.participants.map((p) => p.id)
    if (ids.length < 2) return
    if (state.value.tournament_format === 'round_robin') {
      const pairs = createRoundRobinPairs(ids)
      const now = new Date().toISOString()
      const created = pairs.map((pair) => {
        const p1 = state.value.participants.find((p) => p.id === pair[0])
        const p2 = state.value.participants.find((p) => p.id === pair[1])
        return {
          match_id: newId('m'),
          p1_participant_id: pair[0],
          p2_participant_id: pair[1],
          p1_bey_name: p1?.bey_name?.trim() || undefined,
          p2_bey_name: p2?.bey_name?.trim() || undefined,
          p1_score: 0,
          p2_score: 0,
          logs: [],
          status: 'pending' as const,
          timestamp: now,
          target_points: state.value.target_points,
          tournament_name: state.value.tournament_name || undefined,
          stage: 'round_robin' as const,
        }
      })
      updateState((s) => ({ ...s, matches: [...s.matches, ...created] }))
      return
    }
    // Single elimination now requires an explicit draw action
    // before creating first-round pairings.
  }

  function eliminationAliveParticipantIds(): string[] {
    const eliminated = new Set<string>()
    for (const m of state.value.matches) {
      if (m.status !== 'completed') continue
      if (m.p1_score > m.p2_score) eliminated.add(m.p2_participant_id)
      else if (m.p2_score > m.p1_score) eliminated.add(m.p1_participant_id)
    }
    return state.value.participants.map((p) => p.id).filter((id) => !eliminated.has(id))
  }

  function ensureNextEliminationRound() {
    if (state.value.tournament_format !== 'single_elimination') return
    if (state.value.matches.length === 0) return
    const hasLiveOrPending = state.value.matches.some(
      (m) => m.status === 'pending' || m.status === 'in_progress',
    )
    if (hasLiveOrPending) return
    const alive = eliminationAliveParticipantIds()
    if (alive.length <= 1) return
    const shuffled = shuffle(alive)
    const toCreate: Match[] = []
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const p1Id = shuffled[i]!
      const p2Id = shuffled[i + 1]!
      const p1 = state.value.participants.find((p) => p.id === p1Id)
      const p2 = state.value.participants.find((p) => p.id === p2Id)
      toCreate.push({
        match_id: newId('m'),
        p1_participant_id: p1Id,
        p2_participant_id: p2Id,
        p1_bey_name: p1?.bey_name?.trim() || undefined,
        p2_bey_name: p2?.bey_name?.trim() || undefined,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: new Date().toISOString(),
        target_points: state.value.target_points,
        tournament_name: state.value.tournament_name || undefined,
        stage: 'elimination',
      })
    }
    if (toCreate.length > 0) {
      updateState((s) => ({ ...s, matches: [...s.matches, ...toCreate] }))
    }
  }

  function drawSingleEliminationFirstRound() {
    if (state.value.tournament_format !== 'single_elimination') return
    if (state.value.matches.length > 0) return
    const shuffled = shuffle(state.value.participants.map((p) => p.id))
    if (shuffled.length < 2) return
    const now = new Date().toISOString()
    const toCreate: Match[] = []
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      const p1Id = shuffled[i]!
      const p2Id = shuffled[i + 1]!
      const p1 = state.value.participants.find((p) => p.id === p1Id)
      const p2 = state.value.participants.find((p) => p.id === p2Id)
      toCreate.push({
        match_id: newId('m'),
        p1_participant_id: p1Id,
        p2_participant_id: p2Id,
        p1_bey_name: p1?.bey_name?.trim() || undefined,
        p2_bey_name: p2?.bey_name?.trim() || undefined,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: now,
        target_points: state.value.target_points,
        tournament_name: state.value.tournament_name || undefined,
        stage: 'elimination',
      })
    }
    if (toCreate.length > 0) {
      updateState((s) => ({ ...s, matches: [...s.matches, ...toCreate] }))
    }
  }

  function createSingleEliminationFirstRoundFromPairs(pairs: Array<[string, string]>) {
    if (state.value.tournament_format !== 'single_elimination') return
    if (state.value.matches.length > 0) return
    if (pairs.length === 0) return
    const now = new Date().toISOString()
    const toCreate: Match[] = []
    for (const [p1Id, p2Id] of pairs) {
      const p1 = state.value.participants.find((p) => p.id === p1Id)
      const p2 = state.value.participants.find((p) => p.id === p2Id)
      if (!p1 || !p2 || p1Id === p2Id) continue
      toCreate.push({
        match_id: newId('m'),
        p1_participant_id: p1Id,
        p2_participant_id: p2Id,
        p1_bey_name: p1.bey_name?.trim() || undefined,
        p2_bey_name: p2.bey_name?.trim() || undefined,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: now,
        target_points: state.value.target_points,
        tournament_name: state.value.tournament_name || undefined,
        stage: 'elimination',
      })
    }
    if (toCreate.length > 0) {
      updateState((s) => ({ ...s, matches: [...s.matches, ...toCreate] }))
    }
  }

  function regularSeasonMatches(): Match[] {
    return state.value.matches.filter((m) => m.stage === 'round_robin')
  }

  function rankRoundRobinParticipants(): string[] {
    const regular = regularSeasonMatches().filter((m) => m.status === 'completed')
    const stat = new Map<string, { wins: number; losses: number; scored: number; conceded: number }>()
    const ensure = (id: string) => {
      if (!stat.has(id)) stat.set(id, { wins: 0, losses: 0, scored: 0, conceded: 0 })
      return stat.get(id)!
    }
    for (const p of state.value.participants) ensure(p.id)
    for (const m of regular) {
      const p1 = ensure(m.p1_participant_id)
      const p2 = ensure(m.p2_participant_id)
      p1.scored += m.p1_score
      p1.conceded += m.p2_score
      p2.scored += m.p2_score
      p2.conceded += m.p1_score
      const winner = completedWinnerId(m)
      if (winner === m.p1_participant_id) {
        p1.wins += 1
        p2.losses += 1
      } else if (winner === m.p2_participant_id) {
        p2.wins += 1
        p1.losses += 1
      }
    }
    return [...state.value.participants]
      .sort((a, b) => {
        const sa = stat.get(a.id)!
        const sb = stat.get(b.id)!
        const winsDiff = sb.wins - sa.wins
        if (winsDiff !== 0) return winsDiff
        const diffA = sa.scored - sa.conceded
        const diffB = sb.scored - sb.conceded
        if (diffB !== diffA) return diffB - diffA
        if (sb.scored !== sa.scored) return sb.scored - sa.scored
        return a.name.localeCompare(b.name)
      })
      .map((p) => p.id)
  }

  function maybeCreateTop4Playoff() {
    if (state.value.tournament_format !== 'round_robin' || !state.value.playoff_enabled) return
    const regular = regularSeasonMatches()
    if (regular.length === 0) return
    if (regular.some((m) => m.status !== 'completed')) return
    const hasPlayoff = state.value.matches.some(
      (m) => m.stage === 'semifinal' || m.stage === 'final' || m.stage === 'third_place',
    )
    if (hasPlayoff) return
    const ranked = rankRoundRobinParticipants()
    if (ranked.length < 4) return
    const semiPairs: Array<[string, string]> = [
      [ranked[0]!, ranked[3]!],
      [ranked[1]!, ranked[2]!],
    ]
    const now = new Date().toISOString()
    const semis: Match[] = semiPairs.map(([p1Id, p2Id]) => {
      const p1 = state.value.participants.find((p) => p.id === p1Id)
      const p2 = state.value.participants.find((p) => p.id === p2Id)
      return {
        match_id: newId('m'),
        p1_participant_id: p1Id,
        p2_participant_id: p2Id,
        p1_bey_name: p1?.bey_name?.trim() || undefined,
        p2_bey_name: p2?.bey_name?.trim() || undefined,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: now,
        target_points: state.value.target_points,
        tournament_name: state.value.tournament_name || undefined,
        stage: 'semifinal',
      }
    })
    updateState((s) => ({ ...s, matches: [...s.matches, ...semis] }))
  }

  function maybeAdvanceTop4Playoff() {
    if (state.value.tournament_format !== 'round_robin' || !state.value.playoff_enabled) return
    const semis = state.value.matches.filter((m) => m.stage === 'semifinal')
    if (semis.length < 2 || semis.some((m) => m.status !== 'completed')) return
    const winners = semis.map((m) => completedWinnerId(m)).filter((id): id is string => Boolean(id))
    if (winners.length !== 2) return
    const loserOf = (m: Match, winnerId: string) =>
      winnerId === m.p1_participant_id ? m.p2_participant_id : m.p1_participant_id
    const losers = [loserOf(semis[0]!, winners[0]!), loserOf(semis[1]!, winners[1]!)]
    const hasFinal = state.value.matches.some((m) => m.stage === 'final')
    const hasThird = state.value.matches.some((m) => m.stage === 'third_place')
    const toCreate: Match[] = []
    const now = new Date().toISOString()
    if (!hasFinal) {
      const p1 = state.value.participants.find((p) => p.id === winners[0])
      const p2 = state.value.participants.find((p) => p.id === winners[1])
      toCreate.push({
        match_id: newId('m'),
        p1_participant_id: winners[0]!,
        p2_participant_id: winners[1]!,
        p1_bey_name: p1?.bey_name?.trim() || undefined,
        p2_bey_name: p2?.bey_name?.trim() || undefined,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: now,
        target_points: state.value.target_points,
        tournament_name: state.value.tournament_name || undefined,
        stage: 'final',
      })
    }
    if (state.value.playoff_third_place && !hasThird) {
      const p1 = state.value.participants.find((p) => p.id === losers[0])
      const p2 = state.value.participants.find((p) => p.id === losers[1])
      toCreate.push({
        match_id: newId('m'),
        p1_participant_id: losers[0]!,
        p2_participant_id: losers[1]!,
        p1_bey_name: p1?.bey_name?.trim() || undefined,
        p2_bey_name: p2?.bey_name?.trim() || undefined,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: now,
        target_points: state.value.target_points,
        tournament_name: state.value.tournament_name || undefined,
        stage: 'third_place',
      })
    }
    if (toCreate.length > 0) {
      updateState((s) => ({ ...s, matches: [...s.matches, ...toCreate] }))
    }
  }

  function nextScheduledMatch(): Match | undefined {
    buildInitialScheduledMatches()
    maybeCreateTop4Playoff()
    maybeAdvanceTop4Playoff()
    ensureNextEliminationRound()
    return state.value.matches.find((m) => m.status === 'pending' || m.status === 'in_progress')
  }

  function addOrUpdatePlayer(payload: { id?: string; name: string; bey_name?: string }) {
    const name = payload.name.trim()
    const bey_name = payload.bey_name?.trim() || undefined
    if (!name) return
    const today = new Date().toISOString().slice(0, 10)
    const participantId = payload.id
    const participant = participantId ? state.value.participants.find((p) => p.id === participantId) : undefined
    const profileId = participant?.player_id ?? newId('pl')

    const catalogIdx = playerCatalog.value.findIndex((p) => p.id === profileId)
    if (catalogIdx >= 0) {
      const current = playerCatalog.value[catalogIdx]!
      const combos = mergeProfileCombos(current, bey_name)
      const nextCatalog = [...playerCatalog.value]
      nextCatalog[catalogIdx] = {
        ...current,
        name,
        default_bey_name: current.default_bey_name ?? bey_name,
        bey_combos: combos,
      }
      playerCatalog.value = nextCatalog
    } else {
      const combos = uniqueCombos([bey_name])
      playerCatalog.value = [
        ...playerCatalog.value,
        {
          id: profileId,
          name,
          default_bey_name: bey_name,
          bey_combos: combos,
          created_at: today,
        },
      ]
    }

    updateState((s) => {
      const next = [...s.participants]
      const idx = payload.id ? next.findIndex((p) => p.id === payload.id) : -1
      if (idx >= 0) {
        next[idx] = { ...next[idx]!, name, bey_name, player_id: profileId }
      } else {
        next.push({
          id: newId('tp'),
          player_id: profileId,
          name,
          bey_name,
          created_at: today,
        })
      }
      return { ...s, participants: next }
    })
  }

  function removePlayer(id: string) {
    updateState((s) => ({
      ...s,
      participants: s.participants.filter((p) => p.id !== id),
      matches: s.matches.filter(
        (m) => m.p1_participant_id !== id && m.p2_participant_id !== id,
      ),
    }))
  }

  function addPlayersFromLibrary(
    playersToAdd: Array<{ profile: PlayerProfile; bey_name?: string }>,
  ) {
    const today = new Date().toISOString().slice(0, 10)
    for (const row of playersToAdd) {
      const p = row.profile
      const name = p.name.trim()
      if (!name) continue
      const chosen =
        row.bey_name !== undefined
          ? row.bey_name.trim() || undefined
          : (p.default_bey_name ?? p.bey_combos?.[0])?.trim() || undefined

      const catalogIdx = playerCatalog.value.findIndex((c) => c.id === p.id)
      if (catalogIdx >= 0) {
        const current = playerCatalog.value[catalogIdx]!
        const combos = mergeProfileCombos(current, chosen)
        const nextCatalog = [...playerCatalog.value]
        nextCatalog[catalogIdx] = {
          ...current,
          default_bey_name: current.default_bey_name ?? chosen,
          bey_combos: combos,
        }
        playerCatalog.value = nextCatalog
      }
    }

    updateState((s) => {
      const existing = new Set(s.participants.map((p) => p.player_id))
      const next = [...s.participants]
      for (const row of playersToAdd) {
        const p = row.profile
        const name = p.name.trim()
        if (!name) continue
        const bey_name =
          row.bey_name !== undefined
            ? row.bey_name.trim() || undefined
            : (p.default_bey_name ?? p.bey_combos?.[0])?.trim() || undefined
        if (existing.has(p.id)) continue
        existing.add(p.id)
        next.push({
          id: newId('tp'),
          player_id: p.id,
          name,
          bey_name,
          created_at: p.created_at ?? today,
        })
      }
      return { ...s, participants: next }
    })
  }

  function updatePlayerProfile(payload: {
    id: string
    name: string
    default_bey_name?: string
    bey_combos?: string[]
  }) {
    const id = payload.id
    const name = payload.name.trim()
    const default_bey_name = payload.default_bey_name?.trim() || undefined
    if (!name) return

    const idx = playerCatalog.value.findIndex((p) => p.id === id)
    if (idx === -1) return
    const current = playerCatalog.value[idx]!
    const combos = payload.bey_combos
      ? uniqueCombos([...payload.bey_combos, default_bey_name])
      : uniqueCombos([...(current.bey_combos ?? []), current.default_bey_name, default_bey_name])
    const nextCatalog = [...playerCatalog.value]
    nextCatalog[idx] = { ...current, name, default_bey_name, bey_combos: combos }
    playerCatalog.value = nextCatalog

    tournaments.value = tournaments.value.map((t) => ({
      ...t,
      updated_at: new Date().toISOString(),
      state: {
        ...t.state,
        participants: t.state.participants.map((p) =>
          p.player_id === id ? { ...p, name } : p,
        ),
      },
    }))
  }

  function deletePlayerProfile(profileId: string) {
    playerCatalog.value = playerCatalog.value.filter((p) => p.id !== profileId)
    tournaments.value = tournaments.value.map((t) => {
      const removedIds = new Set(
        t.state.participants.filter((p) => p.player_id === profileId).map((p) => p.id),
      )
      if (removedIds.size === 0) return t
      return {
        ...t,
        updated_at: new Date().toISOString(),
        state: {
          ...t.state,
          participants: t.state.participants.filter((p) => !removedIds.has(p.id)),
          matches: t.state.matches.filter(
            (m) =>
              !removedIds.has(m.p1_participant_id) &&
              !removedIds.has(m.p2_participant_id),
          ),
        },
      }
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
    const p1 = state.value.participants.find((p) => p.id === p1_id)
    const p2 = state.value.participants.find((p) => p.id === p2_id)
    const match: Match = {
      match_id: newId('m'),
      p1_participant_id: p1_id,
      p2_participant_id: p2_id,
      p1_bey_name: p1?.bey_name?.trim() || undefined,
      p2_bey_name: p2?.bey_name?.trim() || undefined,
      p1_score: 0,
      p2_score: 0,
      logs: [],
      status: 'pending',
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
    maybeCreateTop4Playoff()
    maybeAdvanceTop4Playoff()
    ensureNextEliminationRound()
  }

  function undo(matchId: string) {
    const idx = state.value.matches.findIndex((m) => m.match_id === matchId)
    if (idx === -1) return
    const updated = undoLastPure(state.value.matches[idx]!)
    const next = [...state.value.matches]
    next[idx] = updated
    updateState((s) => ({ ...s, matches: next }))
  }

  function playerById(id: string): TournamentParticipant | undefined {
    return state.value.participants.find((p) => p.id === id)
  }

  function profileById(id: string): PlayerProfile | undefined {
    return playerCatalogMap.value.get(id)
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
    battleFormat,
    tournamentFormat,
    playoffEnabled,
    playoffThirdPlace,
    stadiumType,
    hasPlayers,
    playerLibrary,
    liveMatches,
    finishedMatches,
    allFinishedMatches,
    newTournament,
    switchTournament,
    deleteTournament,
    applySetup,
    buildInitialScheduledMatches,
    nextScheduledMatch,
    drawSingleEliminationFirstRound,
    createSingleEliminationFirstRoundFromPairs,
    addOrUpdatePlayer,
    removePlayer,
    addPlayersFromLibrary,
    updatePlayerProfile,
    deletePlayerProfile,
    importJsonText,
    exportJsonText,
    getMatch,
    startMatch,
    applyScore,
    undo,
    playerById,
    profileById,
    replaceState,
  }
})
