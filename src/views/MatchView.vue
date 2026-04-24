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
    quickMatch.value = applyScorePure(quickMatch.value, winnerId, action)
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

watch(
  () => activeMatch.value,
  (m) => {
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
    store.replaceState({
      ...store.state,
      matches: [...store.state.matches, archived],
    })
    lastSavedQuickMatchKey.value = saveKey
  },
  { deep: true },
)
</script>

<template>
  <div v-if="activeMatch && activeP1 && activeP2" class="h-screen flex flex-col overflow-hidden bg-slate-950 p-3 text-white sm:p-4">
    <header class="mb-2 flex shrink-0 items-center justify-between sm:mb-3">
      <button
        type="button"
        class="flex items-center gap-1.5 p-2 text-slate-400 transition-colors hover:text-white"
        @click="back"
      >
        <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="text-xs font-black uppercase tracking-widest">{{ t('match.back') }}</span>
      </button>

      <div class="flex items-center gap-3">
        <div class="rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <span class="text-xs font-black uppercase tracking-tighter text-slate-300">
            {{ t('match.targetHint', { n: activeMatch.target_points }) }}
          </span>
        </div>
        <label
          v-if="isQuickMatch"
          class="flex items-center gap-2 rounded-full border border-bx-primary/50 bg-bx-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-bx-primary"
        >
          {{ t('match.target') }}
          <input
            v-model.number="quickTargetPoints"
            type="number"
            min="1"
            class="w-14 rounded-md border border-bx-primary/40 bg-slate-950 px-2 py-0.5 text-right text-white outline-none"
          >
        </label>
        <label
          v-if="isQuickMatch"
          class="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-200"
        >
          <input
            v-model="includeQuickInHistory"
            type="checkbox"
            class="h-3.5 w-3.5 accent-bx-primary"
          >
          {{ t('match.saveToHistory') }}
        </label>
        <button
          type="button"
          class="rounded-xl border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition-all opacity-100 active:scale-90 disabled:opacity-20 sm:p-2"
          :disabled="activeMatch.logs.length === 0"
          @click="undo"
        >
          <svg class="h-4 w-4 text-bx-primary sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-2 pb-2 landscape:grid-cols-2 landscape:grid-rows-1 sm:grid-cols-2 sm:grid-rows-1">
      <section
        class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl transition-all duration-300 sm:rounded-[2.5rem] border border-white/10 bg-slate-900/40"
        :class="
          activeMatch.p1_score >= activeMatch.target_points
            ? 'ring-4 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
            : 'bg-slate-900/40 ring-1 ring-white/10'
        "
      >
        <div class="flex h-18 items-center justify-between border-b border-white/5 bg-red-500/10 px-3 py-2.5 sm:px-4 sm:py-3.5">
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h2 class="truncate text-lg font-black uppercase italic sm:text-base">
              {{ activeP1.name }}
            </h2>
            <p class="truncate text-sm font-bold italic text-red-400/70">
              {{ activeP1.bey_name || t('match.noBey') }}
            </p>
          </div>
        </div>

        <div class=" min-h-0 flex-1 items-center justify-center flex landscape:flex">
          <span
            class="text-7xl text-red-400 font-black italic tracking-tighter tabular-nums landscape:text-4xl lg:text-8xl lg:landscape:text-8xl"
          >
            {{ activeMatch.p1_score }}
          </span>
        </div>

        <div class="my-1.5 grid grid-cols-2 gap-1.5 bg-black/20 p-1.5 landscape:mt-auto sm:mt-2 sm:gap-2 sm:p-2">
          <button
            v-for="a in actions"
            :key="a.key + '-p1'"
            type="button"
            class="relative flex h-12 lg:flex-col gap-2 lg:gap-0 items-center justify-center overflow-hidden rounded-lg transition-all active:scale-95 sm:h-16 sm:rounded-2xl"
            :class="[
              a.key === 'Xtreme Finish' ? 'bg-red-600' : 'bg-slate-800',
              !isScorable ? 'grayscale opacity-30' : 'hover:brightness-110',
            ]"
            :disabled="!isScorable"
            @click="score(activeP1.id, a.key)"
          >
            <span class="text-sm font-black uppercase italic text-white/80">
              {{ t(a.labelKey) }}
            </span>
            <span class="text-base font-black sm:text-lg">
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
        <div class="flex h-18 items-center justify-between border-b border-white/5 bg-blue-500/10 px-3 py-2.5 sm:px-4 sm:py-3.5">
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h2
              class="truncate text-lg font-black uppercase italic"
              :class="
                activeMatch.status === 'completed' && activeMatch.p2_score < activeMatch.p1_score
                  ? 'text-red-400'
                  : 'text-white'
              "
            >
              {{ activeP2.name }}
            </h2>
            <p
              class="truncate text-sm font-bold italic"
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

        <div class="my-1.5 grid grid-cols-2 gap-1.5 bg-black/20 p-1.5 landscape:mt-auto sm:mt-2 sm:gap-2 sm:p-2">
          <button
            v-for="a in actions"
            :key="a.key + '-p2'"
            type="button"
            class="relative flex h-12 lg:flex-col gap-2 lg:gap-0 items-center justify-center overflow-hidden rounded-lg transition-all active:scale-95 sm:h-16 sm:rounded-2xl"
            :class="[
              a.key === 'Xtreme Finish' ? 'bg-blue-600' : 'bg-slate-800',
              !isScorable ? 'grayscale opacity-30' : 'hover:brightness-110',
            ]"
            :disabled="!isScorable"
            @click="score(activeP2.id, a.key)"
          >
            <span class="text-sm font-black uppercase italic text-white/80">
              {{ t(a.labelKey) }}
            </span>
            <span class="text-base font-black sm:text-lg">
              +{{ FINISH_POINTS[a.key] }}
            </span>
          </button>
        </div>
      </section>
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
          <p class="mb-4 font-bold text-slate-400 md:mb-8 text-xl md:text-lg">
            <i18n-t keypath="match.winnerIs" tag="span">
              <template #name>
                <span :class="activeMatch.p1_score > activeMatch.p2_score ? 'text-red-400' : 'text-blue-400'">
                  {{ activeMatch.p1_score > activeMatch.p2_score ? activeP1.name : activeP2.name }}
                </span>
              </template>
            </i18n-t>
          </p>
          <button
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
</style>
