<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import { computePlayerStats, winRate } from '@/utils/playerStats'
import { shortPlayerIdSuffix } from '@/utils/playerIdDisplay'

const { t } = useI18n()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const p1 = ref('')
const p2 = ref('')
const startError = ref<string | null>(null)
const nextScheduled = computed(() => store.nextScheduledMatch())
const isManualMode = computed(() => store.tournamentFormat === 'free')
const eliminationDrawPending = computed(
  () => store.tournamentFormat === 'single_elimination' && store.matches.length === 0,
)
const eliminationDrawRemaining = ref<string[]>([])
const eliminationDrawPairs = ref<Array<[string, string]>>([])
const eliminationPairsTarget = computed(() => Math.floor(store.players.length / 2))
const drawSessionStarted = ref(false)
const effectiveDrawRemainingCount = computed(() =>
  drawSessionStarted.value ? eliminationDrawRemaining.value.length : store.players.length,
)
const canDrawOneMatch = computed(() => effectiveDrawRemainingCount.value > 1)
const canFinalizeDraw = computed(() =>
  effectiveDrawRemainingCount.value <= 1 && eliminationDrawPairs.value.length > 0,
)
const isDrawing = ref(false)
const drawRevealPair = ref<[string, string] | null>(null)
const showAllLiveMatches = ref(false)

const stats = computed(() => computePlayerStats(store.players, store.matches))
const currentRound = computed(() => {
  const next = nextScheduled.value
  if (!next) return null
  const nextIdx = store.matches.findIndex((m) => m.match_id === next.match_id)
  if (nextIdx <= 0) return 1
  const completedBefore = store.matches
    .slice(0, nextIdx)
    .filter((m) => m.status === 'completed').length
  return completedBefore + 1
})
const rankedPlayers = computed(() =>
  [...store.players].sort((a, b) => {
    const sa = stats.value.get(a.id)
    const sb = stats.value.get(b.id)
    const winsDiff = (sb?.wins ?? 0) - (sa?.wins ?? 0)
    if (winsDiff !== 0) return winsDiff
    const lossesDiff = (sa?.losses ?? 0) - (sb?.losses ?? 0)
    if (lossesDiff !== 0) return lossesDiff
    const pointsDiff = (sb?.totalPointsScored ?? 0) - (sa?.totalPointsScored ?? 0)
    if (pointsDiff !== 0) return pointsDiff
    return a.name.localeCompare(b.name)
  }),
)
const topPlayers = computed(() => rankedPlayers.value.slice(0, 3))
const visibleLiveMatches = computed(() =>
  showAllLiveMatches.value ? store.liveMatches : store.liveMatches.slice(0, 3),
)
const hasMoreLiveMatches = computed(() => store.liveMatches.length > 3)
const podiumBgClasses = [
  'bg-amber-300/12 ring-amber-300/30 border-amber-300/35',
  'bg-slate-300/10 ring-slate-300/30 border-slate-300/30',
  'bg-orange-400/10 ring-orange-400/30 border-orange-400/30',
]
const podiumNameClasses = ['text-amber-300', 'text-slate-200', 'text-orange-300']

function playerName(pid: string) {
  return store.playerById(pid)?.name ?? pid
}

function participantShortId(participantId: string) {
  const p = store.playerById(participantId)
  return p ? shortPlayerIdSuffix(p.player_id) : shortPlayerIdSuffix(participantId)
}

function comboText(participant: { beys?: string[]; bey_name?: string } | undefined): string {
  if (!participant) return t('match.noBey')
  const beys = participant.beys?.map((item) => item.trim()).filter(Boolean) ?? []
  if (beys.length > 0) return beys.join(', ')
  return participant.bey_name?.trim() || t('match.noBey')
}

function comboParts(participant: { beys?: string[]; bey_name?: string } | undefined): string[] {
  if (!participant) return []
  const fromBeys = participant.beys?.map((item) => item.trim()).filter(Boolean) ?? []
  if (fromBeys.length > 0) return fromBeys
  return (participant.bey_name ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function pickRandomPlayer(excludeId?: string) {
  const candidates = store.players.filter((pl) => pl.id !== excludeId)
  if (candidates.length === 0) return ''
  const idx = Math.floor(Math.random() * candidates.length)
  return candidates[idx]?.id ?? ''
}

function randomP1() {
  p1.value = pickRandomPlayer(p2.value || undefined)
}

function randomP2() {
  p2.value = pickRandomPlayer(p1.value || undefined)
}

function syncDistinctPlayers(changed: 'p1' | 'p2') {
  if (!p1.value || !p2.value) return
  if (p1.value !== p2.value) return
  if (changed === 'p1') {
    p2.value = pickRandomPlayer(p1.value || undefined)
    return
  }
  p1.value = pickRandomPlayer(p2.value || undefined)
}

function start() {
  startError.value = null
  if (!p1.value || !p2.value) return
  if (p1.value === p2.value) {
    startError.value = t('errors.same_player')
    return
  }
  try {
    const id = store.startMatch(p1.value, p2.value)
    void router.push(`/match/${id}`)
  } catch {
    startError.value = t('errors.same_player')
  }
}

function startNextScheduled() {
  const m = nextScheduled.value
  if (!m) return
  void router.push(`/match/${m.match_id}`)
}

function randomPickAndRemove(ids: string[]): string | null {
  if (ids.length === 0) return null
  const idx = Math.floor(Math.random() * ids.length)
  const [picked] = ids.splice(idx, 1)
  return picked ?? null
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ensureDrawPoolReady() {
  if (!eliminationDrawPending.value) return
  if (eliminationDrawRemaining.value.length > 0 || eliminationDrawPairs.value.length > 0) return
  eliminationDrawRemaining.value = store.players.map((p) => p.id)
  drawSessionStarted.value = true
}

async function drawOneEliminationMatch() {
  if (isDrawing.value) return
  ensureDrawPoolReady()
  if (eliminationDrawRemaining.value.length < 2) return
  const pool = [...eliminationDrawRemaining.value]
  const p1 = randomPickAndRemove(pool)
  const p2 = randomPickAndRemove(pool)
  if (!p1 || !p2) return
  isDrawing.value = true
  drawRevealPair.value = [p1, p2]
  await delay(900)
  eliminationDrawPairs.value = [...eliminationDrawPairs.value, [p1, p2]]
  eliminationDrawRemaining.value = pool
  drawRevealPair.value = null
  isDrawing.value = false
}

function finalizeEliminationDraw() {
  if (eliminationDrawPairs.value.length === 0) return
  store.createSingleEliminationFirstRoundFromPairs(eliminationDrawPairs.value)
  eliminationDrawPairs.value = []
  eliminationDrawRemaining.value = []
  drawSessionStarted.value = false
}

function resume(id: string) {
  void router.push(`/match/${id}`)
}

const pct = (pid: string) => {
  const s = stats.value.get(pid)
  if (!s) return '0'
  return `${Math.round(winRate(s) * 100)}%`
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-10 pb-20">
    <header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div class="space-y-1">
        <h1 class="text-3xl font-black uppercase italic tracking-tighter text-white">
          {{ t('lobby.title') }}
        </h1>
        <p v-if="!store.hasPlayers" class="text-bx-primary/90">{{ t('lobby.noPlayers') }}</p>
        <p v-else class="text-sm text-slate-500">
          {{ store.tournamentName || t('home.unnamedBattle') }} —
          {{
            currentRound
              ? t('lobby.roundPreparing', { n: currentRound })
              : t('lobby.noScheduledRemaining')
          }}
        </p>
      </div>

      <div class="flex gap-4">
        <div class="border-r border-slate-800 px-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {{ t('lobby.totalMatches') }}
          </p>
          <p class="text-xl font-black text-white">{{ store.matches.length }}</p>
        </div>
        <div class="px-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {{ t('lobby.activeWarriors') }}
          </p>
          <p class="text-xl font-black text-white">{{ store.players.length }}</p>
        </div>
      </div>
    </header>

    <!-- <section v-if="store.hasPlayers && isManualMode" class="group relative">
      <div
        class="absolute -inset-1 rounded-[2.5rem] bg-linear-to-r from-bx-primary to-bx-accent opacity-25 blur transition duration-1000 group-hover:opacity-40"
      ></div>
      <div class="relative rounded-4xl border border-white/10 bg-slate-950 p-6 sm:p-8">
        <div class="flex flex-col items-center gap-6 md:flex-row">
          <div class="w-full flex-1 space-y-3">
            <div class="flex items-center justify-between px-2">
              <span class="text-xs font-black uppercase tracking-widest text-bx-primary">{{ t('lobby.p1') }}</span>
              <span v-if="p1" class="text-[10px] font-bold text-slate-500">
                {{ t('lobby.winRate') }}: {{ pct(p1) }}
              </span>
            </div>
            <select
              v-model="p1"
              class="w-full appearance-none rounded-2xl border-2 border-slate-800 bg-slate-900 px-4 py-4 text-lg font-bold text-white outline-none transition-all focus:border-bx-primary"
              @change="syncDistinctPlayers('p1')"
            >
              <option value="" disabled>{{ t('lobby.selectWarrior') }}</option>
              <option v-for="pl in store.players" :key="pl.id" :value="pl.id" :disabled="pl.id === p2">
                {{
                  pl.name +
                    ' - ' +
                    (pl.bey_name ? pl.bey_name : '')
                }}
              </option>
            </select>
            <button
              type="button"
              class="w-full rounded-xl border border-bx-primary/40 bg-bx-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-bx-primary transition hover:bg-bx-primary/20"
              @click="randomP1"
            >
              {{ t('lobby.random') }}
            </button>
          </div>

          <div class="relative mx-2 flex items-center justify-center md:mx-3">
            <div class="h-px w-12 bg-slate-800 md:h-12 md:w-px"></div>
            <div
              class="absolute flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-950 text-xl font-black italic tracking-tighter text-white"
            >
              {{ t('history.vs') }}
            </div>
          </div>

          <div class="w-full flex-1 space-y-3">
            <div class="flex items-center justify-between px-2">
              <span class="text-xs font-black uppercase tracking-widest text-bx-primary">{{ t('lobby.p2') }}</span>
              <span v-if="p2" class="text-[10px] font-bold text-slate-500">
                {{ t('lobby.winRate') }}: {{ pct(p2) }}
              </span>
            </div>
            <select
              v-model="p2"
              class="w-full appearance-none rounded-2xl border-2 border-slate-800 bg-slate-900 px-4 py-4 text-lg font-bold text-white outline-none transition-all focus:border-bx-primary"
              @change="syncDistinctPlayers('p2')"
            >
              <option value="" disabled>{{ t('lobby.selectWarrior') }}</option>
              <option v-for="pl in store.players" :key="pl.id" :value="pl.id" :disabled="pl.id === p1">
                {{
                  pl.name +
                    ' - ' +
                    (pl.bey_name ? pl.bey_name : '')
                }}
              </option>
            </select>
            <button
              type="button"
              class="w-full rounded-xl border border-bx-primary/40 bg-bx-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-bx-primary transition hover:bg-bx-primary/20"
              @click="randomP2"
            >
              {{ t('lobby.random') }}
            </button>
          </div>
        </div>

        <p v-if="startError" class="mt-4 animate-pulse text-center text-sm font-bold text-bx-primary">
          {{ startError }}
        </p>

        <button
          type="button"
          class="group relative mt-8 w-full overflow-hidden rounded-2xl bg-bx-primary py-4 font-black uppercase italic tracking-tighter text-black transition-all hover:scale-[1.01] hover:brightness-110 active:scale-[0.98] disabled:opacity-20"
          :disabled="!p1 || !p2"
          @click="start"
        >
          <span class="relative z-10 flex items-center justify-center gap-2">
            {{ t('lobby.letsBattle') }}
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>
      </div>
    </section> -->

    <section v-if="store.hasPlayers && isManualMode" class="relative group">
      <div class="absolute -inset-1 rounded-[3rem] bg-linear-to-r from-red-600 via-bx-primary to-blue-600 opacity-20 blur-xl group-hover:opacity-30 transition duration-700"></div>
      
      <div class="relative rounded-[2.5rem] border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 sm:p-10">
        <div class="flex flex-col items-center gap-8 md:flex-row">
          
          <div class="w-full flex-1 space-y-4">
            <div class="flex items-center justify-between px-1">
              <span class="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">{{ t('lobby.p1') }}</span>
              <span v-if="p1" class="text-[10px] font-bold text-slate-500 uppercase italic">
                {{ t('lobby.winRate') }}: {{ pct(p1) }}
              </span>
            </div>
            <div class="relative">
              <select
                v-model="p1"
                class="w-full appearance-none rounded-2xl border-2 border-slate-800 bg-slate-900/50 px-5 py-5 text-xl font-black text-white outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                @change="syncDistinctPlayers('p1')"
              >
                <option value="" disabled>{{ t('lobby.selectWarrior') }}</option>
                <option v-for="pl in store.players" :key="pl.id" :value="pl.id" :disabled="pl.id === p2">
                  {{ pl.name }} ({{ comboText(pl) }})
                </option>
              </select>
              <div class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-slate-500">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <button @click="randomP1" class="w-full py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all active:scale-95">
              {{ t('lobby.random') }}
            </button>
          </div>

          <div class="relative flex flex-col items-center justify-center">
            <div class="hidden md:block h-32 w-px bg-linear-to-b from-red-500/50 to-blue-500/50"></div>
            <div class="md:hidden w-32 h-px bg-linear-to-r from-red-500/50 to-blue-500/50"></div>
            <div class="absolute flex h-14 w-14 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-950 shadow-2xl shadow-bx-primary/20">
              <span class="text-2xl font-black italic tracking-tighter text-white">{{ t('history.vs') }}</span>
            </div>
          </div>

          <div class="w-full flex-1 space-y-4">
            <div class="flex items-center justify-between px-1">
              <span class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">{{ t('lobby.p2') }}</span>
              <span v-if="p2" class="text-[10px] font-bold text-slate-500 uppercase italic">
                {{ t('lobby.winRate') }}: {{ pct(p2) }}
              </span>
            </div>
            <div class="relative">
              <select
                v-model="p2"
                class="w-full appearance-none rounded-2xl border-2 border-slate-800 bg-slate-900/50 px-5 py-5 text-xl font-black text-white outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                @change="syncDistinctPlayers('p2')"
              >
                <option value="" disabled>{{ t('lobby.selectWarrior') }}</option>
                <option v-for="pl in store.players" :key="pl.id" :value="pl.id" :disabled="pl.id === p1">
                  {{ pl.name }} ({{ comboText(pl) }})
                </option>
              </select>
              <div class="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-slate-500">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <button @click="randomP2" class="w-full py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-500/10 transition-all active:scale-95">
              {{ t('lobby.random') }}
            </button>
          </div>
        </div>

        <button
          :disabled="!p1 || !p2"
          @click="start"
          class="mt-10 group relative w-full overflow-hidden rounded-3xl bg-bx-primary p-5 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale"
        >
          <div class="relative z-10 flex items-center justify-center gap-3 text-black font-black italic text-xl tracking-widest uppercase">
            {{ t('lobby.letsBattle') }}
            <svg class="w-6 h-6 animate-bounce-x" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </div>
          <div class="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
        </button>
      </div>
    </section>

    <section
      v-if="store.hasPlayers && !isManualMode"
      class="rounded-4xl border border-white/10 bg-slate-950 p-6 sm:p-8"
    >
      <h2 class="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
        {{ t('lobby.scheduledModeTitle') }}
      </h2>
      <p class="mt-2 text-sm text-slate-400">
        {{
          store.tournamentFormat === 'round_robin'
            ? t('lobby.roundRobinModeHint')
            : t('lobby.singleEliminationModeHint')
        }}
      </p>
      <div
        v-if="eliminationDrawPending"
        class="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
      >
        <p class="text-xs font-bold uppercase tracking-widest text-slate-500">
          {{ t('lobby.drawStageTitle') }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          {{ t('lobby.drawStageHint') }}
        </p>
        <p class="mt-2 text-xs text-slate-500">
          {{ t('lobby.drawParticipants', { n: store.players.length }) }}
        </p>
        <p class="mt-1 text-xs text-slate-500">
          {{ t('lobby.drawProgress', { n: eliminationDrawPairs.length, total: eliminationPairsTarget }) }}
        </p>
        <div
          v-if="isDrawing && drawRevealPair"
          class="mt-3 rounded-xl border border-bx-primary/40 bg-bx-primary/10 p-3"
        >
          <p class="text-[10px] font-black uppercase tracking-widest text-bx-primary">
            {{ t('lobby.drawInProgress') }}
          </p>
          <p class="mt-2 text-sm font-black text-white animate-pulse">
            {{ playerName(drawRevealPair[0]) }} <span class="text-bx-primary">{{ t('history.vs') }}</span> {{ playerName(drawRevealPair[1]) }}
          </p>
        </div>
        <ul v-if="eliminationDrawPairs.length" class="mt-3 space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <li
            v-for="(pair, idx) in eliminationDrawPairs"
            :key="pair[0] + '-' + pair[1]"
            class="text-xs font-semibold text-slate-300"
          >
            {{ t('lobby.drawMatchNo', { n: idx + 1 }) }}:
            {{ playerName(pair[0]) }} {{ t('history.vs') }} {{ playerName(pair[1]) }}
          </li>
        </ul>
        <p v-if="eliminationDrawRemaining.length === 1" class="mt-2 text-xs font-semibold text-amber-300">
          {{ t('lobby.drawOddPlayer', { name: playerName(eliminationDrawRemaining[0]!) }) }}
        </p>
        <div class="mt-4">
          <button
            v-if="canDrawOneMatch"
            type="button"
            class="w-full rounded-xl bg-bx-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-black transition-all hover:brightness-110 disabled:opacity-40"
            :disabled="effectiveDrawRemainingCount < 2 || isDrawing"
            @click="drawOneEliminationMatch"
          >
            {{ t('lobby.drawOneMatch') }}
          </button>
          <button
            v-else-if="canFinalizeDraw"
            type="button"
            class="w-full rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-200 transition-all hover:border-bx-primary/60 disabled:opacity-30"
            :disabled="eliminationDrawPairs.length === 0 || isDrawing"
            @click="finalizeEliminationDraw"
          >
            {{ t('lobby.drawFinalize') }}
          </button>
        </div>
      </div>
      <div v-if="nextScheduled" class="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <p class="text-xs font-bold uppercase tracking-widest text-slate-500">{{ t('lobby.nextMatch') }}</p>
        <p class="mt-2 text-lg font-black text-white">
          {{ playerName(nextScheduled.p1_participant_id) }} <span class="text-bx-primary">{{ t('history.vs') }}</span>
          {{ playerName(nextScheduled.p2_participant_id) }}
        </p>
        <button
          type="button"
          class="mt-4 w-full rounded-xl bg-bx-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-black transition-all hover:brightness-110"
          @click="startNextScheduled"
        >
          {{ t('lobby.startNextScheduled') }}
        </button>
      </div>
      <p
        v-else-if="!eliminationDrawPending"
        class="mt-5 rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-center text-sm text-slate-500"
      >
        {{ t('lobby.noScheduledRemaining') }}
      </p>
    </section>

    <section v-if="store.liveMatches.length" class="space-y-4">
      <div class="flex items-center gap-3">
        <span class="relative flex h-3 w-3">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-bx-primary opacity-75"></span>
          <span class="relative inline-flex h-3 w-3 rounded-full bg-bx-primary"></span>
        </span>
        <h2 class="text-sm font-black uppercase tracking-[0.2em] text-white">{{ t('lobby.live') }}</h2>
      </div>
      <div class="grid gap-3">
        <div
          v-for="m in visibleLiveMatches"
          :key="m.match_id"
          class="group rounded-4xl border border-slate-700 bg-slate-900/45 p-4 ring-1 ring-white/8 transition-all hover:border-bx-primary/35 hover:shadow-[0_10px_26px_rgba(0,0,0,0.22)] sm:p-5"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div class="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5">
              <div class="rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-3 text-center sm:px-4">
                <p class="truncate text-sm font-bold text-white">{{ playerName(m.p1_participant_id) }}</p>
                <p class="font-mono text-[10px] font-semibold text-slate-500">
                  {{ t('players.shortId', { id: participantShortId(m.p1_participant_id) }) }}
                </p>
                <p class="mt-2 text-3xl font-black text-red-400">
                  {{ m.p1_score }}
                </p>
              </div>

              <div class="text-center text-xs font-black text-bx-primary">
                {{ t('history.vs') }}
              </div>

              <div class="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-3 py-3 text-center sm:px-4">
                <p class="truncate text-sm font-bold text-white">{{ playerName(m.p2_participant_id) }}</p>
                <p class="font-mono text-[10px] font-semibold text-slate-500">
                  {{ t('players.shortId', { id: participantShortId(m.p2_participant_id) }) }}
                </p>
                <p class="mt-2 text-3xl font-black text-blue-400">
                  {{ m.p2_score }}
                </p>
              </div>
            </div>

            <button
              type="button"
              class="w-full rounded-xl bg-bx-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-black transition-all hover:brightness-110 md:w-auto"
              @click="resume(m.match_id)"
            >
              {{ t('lobby.resume') }}
            </button>
          </div>
        </div>
      </div>
      <button
        v-if="hasMoreLiveMatches"
        type="button"
        class="w-full rounded-xl border border-slate-700 bg-slate-900 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-300 transition-all hover:border-bx-primary/50 hover:text-bx-primary"
        @click="showAllLiveMatches = !showAllLiveMatches"
      >
        {{ showAllLiveMatches ? 'View less' : t('history.viewMore') }}
      </button>
    </section>

    <section v-if="store.hasPlayers" class="space-y-4">
      <h2 class="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{{ t('lobby.leaderboard') }}</h2>
      <div class="grid gap-3 md:grid-cols-3">
        <article
          v-for="(pl, idx) in topPlayers"
          :key="pl.id"
          class="rounded-2xl border bg-slate-900/35 p-4 ring-1"
          :class="podiumBgClasses[idx] ?? 'border-slate-800 ring-white/5'"
        >
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-black uppercase tracking-widest text-bx-primary">#{{ idx + 1 }}</span>
            <span class="rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-300">
              {{ pct(pl.id) }}
            </span>
          </div>

          <div class="flex items-end gap-2">
            <p
              class="truncate font-bold inline-block"
              :class="podiumNameClasses[idx] ?? 'text-white'"
            >
              {{ pl.name }}
            </p>
            <p class="font-mono text-[10px] font-semibold text-slate-600 inline-block">
              {{ t('players.shortId', { id: shortPlayerIdSuffix(pl.player_id) }) }}
            </p>
          </div>

          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="(part, partIdx) in comboParts(pl)"
              :key="'podium-combo-' + pl.id + '-' + partIdx"
              class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300"
            >
              {{ part }}
            </span>
            <span
              v-if="comboParts(pl).length === 0"
              class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
            >
              {{ t('match.noBey') }}
            </span>
          </div>
          <p class="mt-3 text-xs text-slate-400">
            {{ t('lobby.record') }}:
            <span class="font-bold text-bx-primary">{{ stats.get(pl.id)?.wins ?? 0 }}</span>
            /
            <span class="font-bold text-red-400">{{ stats.get(pl.id)?.losses ?? 0 }}</span>
          </p>
        </article>
      </div>
    </section>

    <section v-if="store.hasPlayers" class="space-y-4">
      <h2 class="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{{ t('lobby.stats') }}</h2>
      <div class="overflow-hidden rounded-4xl border border-slate-800 bg-slate-900/20">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/50">
              <th class="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">
                {{ t('lobby.warrior') }}
              </th>
              <th class="px-4 py-4 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                {{ t('lobby.recordShort') }}
              </th>
              <th class="px-4 py-4 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                {{ t('lobby.winRate') }}
              </th>
              <th class="px-4 py-4 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                {{ t('lobby.pts') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/50">
            <tr
              v-for="(pl, idx) in rankedPlayers"
              :key="pl.id"
              class="transition-colors"
              :class="
                idx === 0
                  ? 'bg-amber-300/12 hover:bg-amber-300/12'
                  : idx === 1
                    ? 'bg-slate-300/10 hover:bg-slate-300/10'
                    : idx === 2
                      ? 'bg-orange-400/10 hover:bg-orange-400/10'
                      : 'hover:bg-white/2'
              "
            >
              <td class="px-6 py-4">
                <div class="flex items-end gap-2">
                  <div
                    class="font-bold inline-block"
                    :class="podiumNameClasses[idx] ?? 'text-white'"
                  >
                    {{ pl.name }}
                  </div>
                  <div class="font-mono text-[10px] font-semibold text-slate-600 inline-block">
                    {{ t('players.shortId', { id: shortPlayerIdSuffix(pl.player_id) }) }}
                  </div>
                </div>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span
                    v-for="(part, partIdx) in comboParts(pl)"
                    :key="'stats-combo-' + pl.id + '-' + partIdx"
                    class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300"
                  >
                    {{ part }}
                  </span>
                  <span
                    v-if="comboParts(pl).length === 0"
                    class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    {{ t('match.noBey') }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-4 text-center tabular-nums">
                <span class="font-bold text-bx-primary">{{ stats.get(pl.id)?.wins ?? 0 }}</span>
                <span class="mx-1 text-slate-600">/</span>
                <span class="font-bold text-red-400">{{ stats.get(pl.id)?.losses ?? 0 }}</span>
              </td>
              <td class="px-4 py-4 text-center">
                <div class="inline-flex items-center justify-center rounded-lg bg-slate-800 px-3 py-1 text-xs font-black text-bx-primary">
                  {{ pct(pl.id) }}
                </div>
              </td>
              <td class="px-4 py-4 text-center font-bold tabular-nums text-slate-300">
                {{ stats.get(pl.id)?.totalPointsScored ?? 0 }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section v-else class="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
      <p class="text-sm text-slate-400">{{ t('lobby.noPlayers') }}</p>
      <p class="mt-2 text-xs text-slate-500">{{ t('home.goSetup') }}</p>
    </section>
  </div>
</template>
