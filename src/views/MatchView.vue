<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { FinishAction, Match } from '@/types/bxtm'
import { FINISH_POINTS } from '@/types/bxtm'
import { useTournamentStore } from '@/stores/tournament'
import { applyScore as applyScorePure, undoLast as undoLastPure } from '@/utils/matchLogic'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const matchId = computed(() => route.params.id as string)
const match = computed(() => store.getMatch(matchId.value))
const isQuickMatch = computed(() => matchId.value === 'quick' || route.query.quick === '1')
const quickTargetPoints = ref(4)
const includeQuickInHistory = ref(false)
const lastSavedQuickMatchKey = ref<string | null>(null)
const visibleHistoryCount = ref(10)
const logsExpanded = ref(false)
const QUICK_P1_ID = 'P1'
const QUICK_P2_ID = 'P2'
const quickMatch = ref<Match | null>(null)

const p1 = computed(() => (match.value ? store.playerById(match.value.p1_participant_id) : undefined))
const p2 = computed(() => (match.value ? store.playerById(match.value.p2_participant_id) : undefined))
const activeMatch = computed(() => (isQuickMatch.value ? quickMatch.value : match.value))
const activeP1 = computed(() =>
  isQuickMatch.value ? { id: QUICK_P1_ID, name: 'P1', bey_name: '' } : p1.value,
)
const activeP2 = computed(() =>
  isQuickMatch.value ? { id: QUICK_P2_ID, name: 'P2', bey_name: '' } : p2.value,
)

const prevStatus = ref<string | null>(null)
const isScorable = computed(
  () => activeMatch.value?.status === 'pending' || activeMatch.value?.status === 'in_progress',
)
const displayedLogs = computed(() => {
  const logs = activeMatch.value?.logs ?? []
  return logs.slice(-visibleHistoryCount.value).reverse()
})
const hasMoreLogs = computed(() => {
  const logs = activeMatch.value?.logs ?? []
  return logs.length > visibleHistoryCount.value
})

const actions: { key: FinishAction; labelKey: string }[] = [
  { key: 'Spin Finish', labelKey: 'match.sf' },
  { key: 'Over Finish', labelKey: 'match.of' },
  { key: 'Burst Finish', labelKey: 'match.bf' },
  { key: 'Xtreme Finish', labelKey: 'match.xf' },
]

function triggerHaptic(action: FinishAction) {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  if (action === 'Xtreme Finish') {
    navigator.vibrate([100, 50, 100])
    return
  }
  navigator.vibrate(FINISH_POINTS[action] === 2 ? 70 : 50)
}

function score(winnerId: string, action: FinishAction) {
  if (!activeMatch.value || !isScorable.value) return
  triggerHaptic(action)
  if (isQuickMatch.value && quickMatch.value) {
    const nextQuick = applyScorePure(quickMatch.value, winnerId, action)
    quickMatch.value = nextQuick
    persistQuickMatchToHistory(nextQuick)
    return
  }
  store.applyScore(activeMatch.value.match_id, winnerId, action)
}

function undo() {
  if (!activeMatch.value) return
  if (isQuickMatch.value && quickMatch.value) {
    quickMatch.value = undoLastPure(quickMatch.value)
    return
  }
  store.undo(activeMatch.value.match_id)
}

function back() {
  void router.push(isQuickMatch.value ? '/' : '/lobby')
}

function loadMoreLogs() {
  visibleHistoryCount.value += 10
}

function actionLabel(action: FinishAction) {
  return t(actions.find((a) => a.key === action)?.labelKey ?? 'match.sf')
}

function startAgain() {
  if (!activeMatch.value) return
  if (isQuickMatch.value && quickMatch.value) {
    lastSavedQuickMatchKey.value = null
    quickMatch.value = {
      ...quickMatch.value,
      p1_score: 0,
      p2_score: 0,
      logs: [],
      status: 'pending',
      winner_participant_id: undefined,
      endedAt: undefined,
      startedAt: undefined,
      timestamp: new Date().toISOString(),
    }
    return
  }
  const newId = store.startMatch(activeMatch.value.p1_participant_id, activeMatch.value.p2_participant_id)
  void router.push(`/match/${newId}`)
}

watch(
  () => activeMatch.value?.status,
  (st) => {
    const wasLive = prevStatus.value === 'pending' || prevStatus.value === 'in_progress'
    prevStatus.value = st ?? null
    if (wasLive && st === 'completed') triggerHaptic('Xtreme Finish')
  },
  { immediate: true },
)

watch(
  [isQuickMatch, quickTargetPoints],
  ([quick]) => {
    if (!quick) return
    const safeTarget = Math.max(1, Math.floor(quickTargetPoints.value || 1))
    quickTargetPoints.value = safeTarget

    if (!quickMatch.value) {
      quickMatch.value = {
        match_id: 'quick-match',
        p1_participant_id: QUICK_P1_ID,
        p2_participant_id: QUICK_P2_ID,
        p1_score: 0,
        p2_score: 0,
        logs: [],
        status: 'pending',
        timestamp: new Date().toISOString(),
        target_points: safeTarget,
      }
      return
    }

    quickMatch.value = {
      ...quickMatch.value,
      target_points: safeTarget,
      status:
        quickMatch.value.p1_score >= safeTarget || quickMatch.value.p2_score >= safeTarget
          ? 'completed'
          : quickMatch.value.logs.length
            ? 'in_progress'
            : 'pending',
      winner_participant_id:
        quickMatch.value.p1_score >= safeTarget
          ? QUICK_P1_ID
          : quickMatch.value.p2_score >= safeTarget
            ? QUICK_P2_ID
            : undefined,
    }
  },
  { immediate: true },
)

function persistQuickMatchToHistory(m: Match | null) {
  if (!isQuickMatch.value || !m || m.status !== 'completed' || !includeQuickInHistory.value) return
  const saveKey = `${m.timestamp}-${m.logs.length}-${m.p1_score}-${m.p2_score}`
  if (lastSavedQuickMatchKey.value === saveKey) return
  const endedAt = m.endedAt ?? new Date().toISOString()
  const archived: Match = {
    ...m,
    match_id: `qm-${crypto.randomUUID().slice(0, 8)}`,
    status: 'completed',
    timestamp: endedAt,
    endedAt,
    tournament_name: 'Quick Match',
  }
  if (store.tournamentList.length === 0) {
    store.newTournament()
  }
  store.replaceState({
    ...store.state,
    matches: [...store.state.matches, archived],
  })
  lastSavedQuickMatchKey.value = saveKey
}

watch(
  [() => activeMatch.value, includeQuickInHistory],
  ([m]) => {
    persistQuickMatchToHistory(m)
  },
  { deep: true, immediate: true },
)

watch(
  () => activeMatch.value?.match_id,
  () => {
    visibleHistoryCount.value = 10
    logsExpanded.value = false
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="activeMatch && activeP1 && activeP2"
    class="flex min-h-dvh flex-col overflow-hidden bg-slate-950 p-2.5 text-white sm:p-4"
  >
    <header class="mb-1.5 flex shrink-0 flex-col items-stretch gap-1.5 sm:mb-2 sm:gap-2 md:flex-row md:items-center md:justify-between">
      <button
        type="button"
        class="inline-flex w-fit items-center gap-1.5 p-2 text-slate-400 transition-colors hover:text-white"
        @click="back"
      >
        <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="text-xs font-black uppercase tracking-widest">{{ t('match.back') }}</span>
      </button>

      <div class="flex flex-1 flex-wrap items-center gap-1 sm:gap-1.5 md:justify-end md:gap-2">
        <label
          v-if="isQuickMatch"
          class="flex h-8 items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 text-xs font-black uppercase tracking-wider text-slate-200 sm:h-9 sm:gap-1.5 sm:px-2.5 md:gap-2 md:px-3"
        >
          <input
            v-model="includeQuickInHistory"
            type="checkbox"
            class="h-3.5 w-3.5 accent-bx-primary"
          >
          {{ t('match.saveToHistory') }}
        </label>

        <label
          v-if="isQuickMatch"
          class="flex h-8 items-center gap-1 rounded-full border border-bx-primary/50 bg-bx-primary/10 px-2 text-xs font-black uppercase tracking-wider text-bx-primary sm:h-9 sm:gap-1.5 sm:px-2.5 md:gap-2 md:px-3"
        >
          {{ t('match.target') }}
          <input
            v-model.number="quickTargetPoints"
            type="number"
            min="1"
            class="w-11 rounded-md border border-bx-primary/40 bg-slate-950 px-1.5 py-0.5 text-right text-white outline-none sm:w-12 md:w-14"
          >
        </label>

        <div class="flex h-8 items-center rounded-full border border-white/10 bg-white/5 px-2 sm:h-9 sm:px-2.5 md:px-3">
          <span class="text-xs font-black uppercase tracking-tighter text-slate-300">
            {{ t('match.targetHint', { n: activeMatch.target_points }) }}
          </span>
        </div>
        
        <button
          type="button"
          class="ml-auto flex h-8 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 px-2 text-slate-300 transition-all opacity-100 active:scale-90 disabled:opacity-20 sm:ml-1 sm:h-9 sm:px-2.5"
          :disabled="activeMatch.logs.length === 0"
          @click="undo"
        >
          <svg class="h-4 w-4 text-bx-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-1.5 py-2 landscape:grid-cols-2 landscape:grid-rows-1 sm:gap-2 sm:pb-2 lg:grid-cols-2 lg:grid-rows-1">
      <section
        class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl transition-all duration-300 sm:rounded-[2.5rem] border border-white/10 bg-slate-900/40"
        :class="
          activeMatch.p1_score >= activeMatch.target_points
            ? 'ring-4 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
            : 'bg-slate-900/40 ring-1 ring-white/10'
        "
      >
        <div class="flex min-h-14 items-center justify-between border-b border-white/5 bg-red-500/10 px-3 py-1.5 sm:min-h-15 sm:py-2 md:min-h-16 md:px-4 md:py-2.5">
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h2 class="truncate text-base font-black uppercase italic sm:text-lg md:text-xl">
              {{ activeP1.name }}
            </h2>
            <p class="truncate text-xs font-bold italic text-red-400/70 sm:text-sm">
              {{ activeP1.bey_name || t('match.noBey') }}
            </p>
          </div>
        </div>

        <div class=" min-h-0 flex-1 items-center justify-center flex landscape:flex">
          <span
            class="text-7xl font-black italic tracking-tighter tabular-nums landscape:text-4xl lg:text-8xl lg:landscape:text-8xl text-red-400"
          >
            {{ activeMatch.p1_score }}
          </span>
        </div>

        <div class="my-1 grid grid-cols-2 gap-1 bg-black/20 p-1 landscape:mt-auto sm:my-1.5 sm:gap-1.5 sm:p-1.5 md:mt-2 md:gap-2 md:p-2">
          <button
            v-for="a in actions"
            :key="a.key + '-p1'"
            type="button"
            class="score-action-btn relative flex h-10 items-center justify-center gap-1 overflow-hidden rounded-lg transition-all active:scale-95 landscape:h-9 landscape:gap-0.5 sm:h-11 sm:gap-1.5 md:h-14 md:gap-2 md:rounded-2xl lg:h-20 lg:flex-col lg:gap-1 lg:landscape:h-20 lg:landscape:gap-1 xl:h-20 xl:gap-1 xl:rounded-3xl xl:landscape:h-20 xl:landscape:gap-1"
            :class="[
              a.key === 'Xtreme Finish' ? 'bg-red-600' : 'bg-slate-800',
              !isScorable ? 'grayscale opacity-30' : 'hover:brightness-110',
            ]"
            :disabled="!isScorable"
            @click="score(activeP1.id, a.key)"
          >
            <span class="score-action-label text-[11px] font-black uppercase italic text-white/80 landscape:text-[10px] sm:text-xs md:text-sm lg:text-base lg:landscape:text-base xl:text-base xl:landscape:text-base">
              {{ t(a.labelKey) }}
            </span>
            <span class="score-action-points text-xs font-black landscape:text-[11px] sm:text-sm md:text-lg lg:text-xl lg:landscape:text-xl xl:text-xl xl:landscape:text-xl">
              +{{ FINISH_POINTS[a.key] }}
            </span>
          </button>
        </div>
      </section>

      <section
        class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl transition-all duration-300 sm:rounded-[2.5rem] border border-white/10 bg-slate-900/40"
        :class="
          activeMatch.p2_score >= activeMatch.target_points
            ? 'ring-4 ring-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
            : 'bg-slate-900/40 ring-1 ring-white/10'
        "
      >
        <div class="flex min-h-14 items-center justify-between border-b border-white/5 bg-blue-500/10 px-3 py-1.5 sm:min-h-15 sm:py-2 md:min-h-16 md:px-4 md:py-2.5">
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h2
              class="truncate text-base font-black uppercase italic sm:text-lg md:text-xl"
              :class="
                activeMatch.status === 'completed' && activeMatch.p2_score < activeMatch.p1_score
                  ? 'text-red-400'
                  : 'text-white'
              "
            >
              {{ activeP2.name }}
            </h2>
            <p
              class="truncate text-xs font-bold italic sm:text-sm"
              :class="
                activeMatch.status === 'completed' && activeMatch.p2_score < activeMatch.p1_score
                  ? 'text-red-400/70'
                  : 'text-blue-400/70'
              "
            >
              {{ activeP2.bey_name || t('match.noBey') }}
            </p>
          </div>
        </div>

        <div class="min-h-0 flex-1 items-center justify-center flex landscape:flex">
          <span
            class="text-7xl font-black italic tracking-tighter tabular-nums landscape:text-4xl lg:text-8xl lg:landscape:text-8xl"
            :class="
              activeMatch.status === 'completed' && activeMatch.p2_score < activeMatch.p1_score
                ? 'text-red-400'
                : 'text-blue-400'
            "
          >
            {{ activeMatch.p2_score }}
          </span>
        </div>

        <div class="my-1 grid grid-cols-2 gap-1 bg-black/20 p-1 landscape:mt-auto sm:my-1.5 sm:gap-1.5 sm:p-1.5 md:mt-2 md:gap-2 md:p-2">
          <button
            v-for="a in actions"
            :key="a.key + '-p2'"
            type="button"
            class="score-action-btn relative flex h-10 items-center justify-center gap-1 overflow-hidden rounded-lg transition-all active:scale-95 landscape:h-9 landscape:gap-0.5 sm:h-11 sm:gap-1.5 md:h-14 md:gap-2 md:rounded-2xl lg:h-20 lg:flex-col lg:gap-1 lg:landscape:h-20 lg:landscape:gap-1 xl:h-20 xl:gap-1 xl:rounded-3xl xl:landscape:h-20 xl:landscape:gap-1"
            :class="[
              a.key === 'Xtreme Finish' ? 'bg-blue-600' : 'bg-slate-800',
              !isScorable ? 'grayscale opacity-30' : 'hover:brightness-110',
            ]"
            :disabled="!isScorable"
            @click="score(activeP2.id, a.key)"
          >
            <span class="score-action-label text-[11px] font-black uppercase italic text-white/80 landscape:text-[10px] sm:text-xs md:text-sm lg:text-base lg:landscape:text-base xl:text-base xl:landscape:text-base">
              {{ t(a.labelKey) }}
            </span>
            <span class="score-action-points text-xs font-black landscape:text-[11px] sm:text-sm md:text-lg lg:text-xl lg:landscape:text-xl xl:text-xl xl:landscape:text-xl">
              +{{ FINISH_POINTS[a.key] }}
            </span>
          </button>
        </div>
      </section>
    </div>

    <div v-if="activeMatch.logs.length" class="pointer-events-none fixed inset-x-0 bottom-2 z-40 px-2.5 sm:bottom-3 sm:px-4">
      <div class="mx-auto max-w-5xl">
        <div class="pointer-events-auto ml-auto w-fit">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-slate-700/90 bg-slate-900/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-200 backdrop-blur-sm transition hover:border-bx-primary/50"
            @click="logsExpanded = !logsExpanded"
          >
            <span>{{ t('match.historyTitle') }}</span>
            <span class="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{{ activeMatch.logs.length }}</span>
          </button>
        </div>

        <transition name="winner">
          <section
            v-if="logsExpanded"
            class="pointer-events-auto mt-2 max-h-[45dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl sm:p-4"
          >
            <div class="space-y-1.5">
              <div
                v-for="(log, i) in displayedLogs"
                :key="`${log.timestamp || 'log'}-${log.winner_participant_id}-${i}`"
                class="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 px-2.5 py-2 text-xs"
              >
                <span class="font-bold text-slate-300">
                  {{
                    log.winner_participant_id === activeP1.id
                      ? activeP1.name
                      : log.winner_participant_id === activeP2.id
                        ? activeP2.name
                        : log.winner_participant_id
                  }}
                </span>
                <span class="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                  {{ actionLabel(log.action) }}
                </span>
                <span class="ml-auto font-mono font-black text-bx-primary">+{{ log.points }}</span>
              </div>
            </div>
            <button
              v-if="hasMoreLogs"
              type="button"
              class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
              @click="loadMoreLogs"
            >
              {{ t('match.viewMore') }}
            </button>
          </section>
        </transition>
      </div>
    </div>

    <transition name="winner">
      <div
        v-if="activeMatch.status === 'completed'"
        class="fixed inset-0 z-100 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-slate-950/90 backdrop-blur-md"></div>
        <div class="relative w-full max-w-sm rounded-4xl border border-white/10 bg-slate-900 p-4 text-center shadow-2xl sm:p-8">
          <h3
            class="mb-4 text-3xl font-black uppercase italic leading-none tracking-tighter md:text-5xl"
            :class="activeMatch.p1_score > activeMatch.p2_score ? 'text-red-400' : 'text-blue-400'"
          >
            {{ t('match.finished') }}
          </h3>
          <p class="mb-4 text-lg font-bold text-slate-400 sm:mb-6 sm:text-xl">
            <i18n-t keypath="match.winnerIs" tag="span">
              <template #name>
                <span :class="activeMatch.p1_score > activeMatch.p2_score ? 'text-red-400' : 'text-blue-400'">
                  {{ activeMatch.p1_score > activeMatch.p2_score ? activeP1.name : activeP2.name }}
                </span>
              </template>
            </i18n-t>
          </p>
          <button
            v-if="isQuickMatch"
            type="button"
            class="mb-3 w-full rounded-xl border border-white/20 py-3 text-sm font-black uppercase italic tracking-widest text-white active:scale-95 md:rounded-2xl md:py-4 md:text-base"
            @click="startAgain"
          >
            {{ t('match.startAgain') }}
          </button>
          <button
            type="button"
            class="w-full rounded-xl bg-white py-3 text-sm font-black uppercase italic tracking-widest text-black active:scale-95 md:rounded-2xl md:py-4 md:text-base"
            @click="back"
          >
            {{ t('match.back') }}
          </button>
        </div>
      </div>
    </transition>
  </div>
  <p v-else class="text-slate-500">{{ t('nav.lobby') }}…</p>
</template>

<style scoped>
.winner-enter-active,
.winner-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.winner-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

@media (max-height: 700px) {
  .text-5xl {
    font-size: 2.25rem;
  }
}

@media (min-width: 640px) and (max-width: 1023px) and (orientation: landscape) {
  .score-action-btn {
    height: 2.5rem;
    gap: 0.25rem;
    border-radius: 0.625rem;
  }

  .score-action-label {
    font-size: 0.7rem;
    line-height: 1;
  }

  .score-action-points {
    font-size: 0.8rem;
    line-height: 1;
  }
}
</style>
