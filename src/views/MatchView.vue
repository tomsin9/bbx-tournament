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
  isQuickMatch.value ? { id: QUICK_P1_ID, name: t('lobby.p1'), bey_name: '' } : p1.value,
)
const activeP2 = computed(() =>
  isQuickMatch.value ? { id: QUICK_P2_ID, name: t('lobby.p2'), bey_name: '' } : p2.value,
)
const targetPoints = computed(() => Math.max(1, activeMatch.value?.target_points ?? 4))
const isMatchCompleted = computed(
  () =>
    !!activeMatch.value &&
    (activeMatch.value.status === 'completed' ||
      activeMatch.value.p1_score >= targetPoints.value ||
      activeMatch.value.p2_score >= targetPoints.value),
)
const winnerName = computed(() => {
  if (!activeMatch.value) return ''
  if (activeMatch.value.winner_participant_id === activeMatch.value.p1_participant_id) return activeP1.value?.name ?? t('lobby.p1')
  if (activeMatch.value.winner_participant_id === activeMatch.value.p2_participant_id) return activeP2.value?.name ?? t('lobby.p2')
  if (activeMatch.value.p1_score >= targetPoints.value) return activeP1.value?.name ?? t('lobby.p1')
  if (activeMatch.value.p2_score >= targetPoints.value) return activeP2.value?.name ?? t('lobby.p2')
  return activeMatch.value.p1_score >= activeMatch.value.p2_score
    ? (activeP1.value?.name ?? t('lobby.p1'))
    : (activeP2.value?.name ?? t('lobby.p2'))
})
const winnerIsP1 = computed(
  () =>
    !!activeMatch.value &&
    (
      activeMatch.value.winner_participant_id === activeMatch.value.p1_participant_id ||
      (activeMatch.value.winner_participant_id == null &&
        activeMatch.value.p1_score >= activeMatch.value.p2_score)
    ),
)

const prevStatus = ref<string | null>(null)
const isScorable = computed(
  () =>
    !!activeMatch.value &&
    !isMatchCompleted.value &&
    (activeMatch.value.status === 'pending' || activeMatch.value.status === 'in_progress'),
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
    persistQuickMatchToHistory(m ?? null)
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
  <div v-if="activeMatch && activeP1 && activeP2" class="h-dvh flex flex-col overflow-hidden bg-slate-950 text-white">
    
    <header class="shrink-0 flex items-center justify-between px-4 py-2 sm:px-6">
      <button @click="back" class="p-2 -ml-2 text-slate-500 hover:text-white transition-colors">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>

      <div class="flex items-center gap-3">
        <div v-if="isQuickMatch" class="flex items-center bg-white/5 rounded-full border border-white/10 px-3 py-1">
          <span class="text-[10px] font-black text-slate-500 mr-2 uppercase italic tracking-wider">{{ t('match.target') }}</span>
          <input v-model.number="quickTargetPoints" type="number" class="w-8 bg-transparent text-center font-black text-bx-primary outline-none text-sm">
        </div>
        <button @click="undo" :disabled="activeMatch.logs.length === 0" class="rounded-2xl bg-slate-900 border border-slate-800 p-2.5 text-bx-primary active:scale-75 disabled:opacity-20 transition-all shadow-lg">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </button>
      </div>
    </header>

    <main class="flex-1 grid grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1 gap-4 px-4 pb-6 pt-2 sm:px-6 sm:pb-8">
      
      <section v-for="(p, idx) in [activeP1, activeP2]" :key="p.id"
        class="relative flex flex-col overflow-hidden rounded-[2.5rem] border-2 transition-all duration-500"
        :class="[
          idx === 0 ? (activeMatch.p1_score >= targetPoints ? 'border-red-500 bg-red-600/10 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 'border-white/10 bg-slate-900/60')
                    : (activeMatch.p2_score >= targetPoints ? 'border-blue-500 bg-blue-600/10 shadow-[0_0_40px_rgba(59,130,246,0.2)]' : 'border-white/10 bg-slate-900/60')
        ]"
      >
        <div class="z-10 px-6 py-4 shrink-0">
          <h2 class="truncate text-xl font-black uppercase italic leading-none tracking-tight">{{ p.name }}</h2>
          <p class="truncate text-xs font-bold text-slate-500 italic mt-1.5">{{ p.bey_name || t('match.noBey') }}</p>
        </div>

        <div class="flex-1 flex items-center justify-center z-10 min-h-0">
          <span class="text-[25vw] landscape:text-[20vh] font-black italic tracking-tighter tabular-nums leading-none drop-shadow-[0_15px_20px_rgba(0,0,0,0.7)]"
            :class="idx === 0 ? 'text-red-400' : 'text-blue-400'">
            {{ idx === 0 ? activeMatch.p1_score : activeMatch.p2_score }}
          </span>
        </div>

        <div class="z-10 grid grid-cols-2 gap-3 p-4 bg-black/40 shrink-0">
          <button v-for="a in actions" :key="a.key + p.id"
            @click="score(p.id, a.key)"
            :disabled="!isScorable"
            class="group relative flex flex-col items-center justify-center rounded-[1.25rem] transition-all active:scale-95"
            :class="[
              a.key === 'Xtreme Finish' ? (idx === 0 ? 'bg-red-600' : 'bg-blue-600') : 'bg-slate-800',
              'h-16 sm:h-20 lg:h-24',
              !isScorable ? 'grayscale opacity-20' : 'hover:brightness-110 shadow-lg'
            ]"
          >
            <div class="px-2.5">
              <span class="text-[11px] sm:text-sm font-black uppercase italic tracking-widest text-white">
                {{ t(a.labelKey) }}
              </span>
            </div>
            
            <span class="text-xl sm:text-3xl font-black tracking-tighter leading-none">
              +{{ FINISH_POINTS[a.key] }}
            </span>
          </button>
        </div>
      </section>
    </main>

    <div class="shrink-0 flex justify-center pb-4">
      <button @click="logsExpanded = !logsExpanded" class="px-8 py-2 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-bx-primary transition-colors">
        {{ t('match.historyTitle') }}
      </button>
    </div>
    <section
      v-if="logsExpanded"
      class="mx-4 mb-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:mx-6"
    >
      <div class="max-h-56 overflow-y-auto pr-1">
        <ul v-if="displayedLogs.length" class="space-y-2">
          <li
            v-for="(log, idx) in displayedLogs"
            :key="`${log.timestamp ?? 'no-ts'}-${idx}`"
            class="rounded-xl border border-slate-800 bg-black/30 px-3 py-2 text-xs text-slate-300"
          >
            <span class="font-black uppercase tracking-wide text-bx-primary">
              {{ actionLabel(log.action) }} +{{ FINISH_POINTS[log.action] }}
            </span>
            <span class="mx-1.5 text-slate-600">•</span>
            <span :class="log.winner_participant_id === activeMatch.p1_participant_id ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'">
              {{ log.winner_participant_id === activeMatch.p1_participant_id ? activeP1.name : activeP2.name }}
            </span>
            <span class="mx-1.5 text-slate-600">•</span>
            <span class="tabular-nums text-slate-400">
              {{
                log.timestamp && !Number.isNaN(new Date(log.timestamp).getTime())
                  ? new Date(log.timestamp).toLocaleTimeString()
                  : '--:--'
              }}
            </span>
          </li>
        </ul>
        <p v-else class="text-center text-xs font-bold uppercase tracking-wider text-slate-500">
          {{ t('match.noLogsYet') }}
        </p>
      </div>
      <div v-if="hasMoreLogs" class="mt-3 flex justify-center">
        <button
          @click="loadMoreLogs"
          class="rounded-full border border-slate-700 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-bx-primary transition-colors"
        >
          {{ t('match.viewMore') }}
        </button>
      </div>
    </section>

    <transition name="winner">
      <div
        v-if="isMatchCompleted"
        class="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl"
      >
        <div class="w-full max-w-md text-center">
          <div class="text-bx-primary font-black uppercase tracking-widest text-sm mb-2 animate-pulse">{{ t('match.finished') }}</div>
          <h3 class="text-7xl font-black uppercase italic tracking-tighter text-white mb-8 leading-none">
            <span :class="winnerIsP1 ? 'text-red-400' : 'text-blue-400'">{{ winnerName }}</span><br>
            <span class="uppercase">{{ t('match.wins') }}</span>
          </h3>
          <div class="flex flex-col gap-3">
            <label
              class="w-full py-4 text-white font-black uppercase italic tracking-widest transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <input
                v-model="includeQuickInHistory"
                type="checkbox"
                class="h-4 w-4 rounded border-slate-500 bg-slate-900 text-bx-primary focus:ring-bx-primary"
              >
              <span>{{ t('match.saveToHistory') }}</span>
            </label>
            <button
              v-if="isQuickMatch"
              @click="startAgain"
              class="w-full bg-white text-black py-4 rounded-2xl font-black uppercase italic tracking-widest active:scale-95 transition-all"
            >
              {{ t('match.startAgain') }}
            </button>
            <button
              @click="back"
              class="w-full bg-slate-800 text-white py-4 rounded-2xl font-black uppercase italic tracking-widest active:scale-95 transition-all"
            >
              {{ t('match.returnToLobby') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
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

/* 讓 input 唔好有箭咀 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 針對超級細手機的細節調整 */
@media (max-height: 600px) {
  .h-12 { height: 2.75rem; }
  .text-5xl { font-size: 2rem; }
}

/* 使用動態單位確保分數在各種螢幕都巨大 */
.text-\[28vw\] { font-size: 28vw; }

@media (orientation: landscape) {
  .landscape\:text-\[20vh\] { font-size: 20vh; }
}

/* 防止數字太闊撐開容器 */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.winner-enter-active, .winner-leave-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.winner-enter-from { opacity: 0; transform: scale(0.8) rotate(-2deg); }
</style>
