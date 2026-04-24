<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import type { FinishAction } from '@/types/bxtm'
import { computePlayerStats, winRate } from '@/utils/playerStats'
import { shortPlayerIdSuffix } from '@/utils/playerIdDisplay'

const { t } = useI18n()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const p1 = ref('')
const p2 = ref('')
const startError = ref<string | null>(null)

const stats = computed(() => computePlayerStats(store.players, store.matches))
const currentRound = computed(() => store.matches.length + 1)
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

function lastActionLabel(action: FinishAction) {
  const keyMap: Record<FinishAction, string> = {
    'Over Finish': 'match.of',
    'Burst Finish': 'match.bf',
    'Xtreme Finish': 'match.xf',
    'Spin Finish': 'match.sf',
  }
  return t(keyMap[action])
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
          {{ store.tournamentName || t('home.unnamedBattle') }} — {{ t('lobby.roundPreparing', { n: currentRound }) }}
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

    <section v-if="store.hasPlayers" class="group relative">
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
              VS
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
          v-for="m in store.liveMatches"
          :key="m.match_id"
          class="group rounded-4xl border border-slate-700 bg-slate-900/45 p-4 ring-1 ring-white/8 transition-all hover:border-bx-primary/35 hover:shadow-[0_10px_26px_rgba(0,0,0,0.22)] sm:p-5"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <span class="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[10px] font-medium text-slate-400">
              {{ m.logs.length }} {{ t('history.matchDetails') }}
            </span>
            <p v-if="m.logs.length" class="hidden text-xs text-slate-400 sm:block">
              {{ t('lobby.lastAction') }}: {{ lastActionLabel(m.logs[m.logs.length - 1]!.action) }}
            </p>
          </div>

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

          <p class="text-xs text-slate-400">{{ pl.bey_name || t('match.noBey') }}</p>
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
                <div class="text-sm font-medium text-slate-400">{{ pl.bey_name || '-' }}</div>
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
