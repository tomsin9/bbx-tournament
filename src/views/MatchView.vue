<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { FinishAction } from '@/types/bxtm'
import { FINISH_POINTS } from '@/types/bxtm'
import { useTournamentStore } from '@/stores/tournament'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const matchId = computed(() => route.params.id as string)
const match = computed(() => store.getMatch(matchId.value))

const p1 = computed(() => (match.value ? store.playerById(match.value.p1_participant_id) : undefined))
const p2 = computed(() => (match.value ? store.playerById(match.value.p2_participant_id) : undefined))

const prevStatus = ref<string | null>(null)

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
  if (!match.value || match.value.status !== 'live') return
  triggerHaptic(action)
  store.applyScore(match.value.match_id, winnerId, action)
}

function undo() {
  if (!match.value) return
  store.undo(match.value.match_id)
}

function back() {
  void router.push('/lobby')
}

watch(
  () => match.value?.status,
  (st) => {
    const wasLive = prevStatus.value === 'live'
    prevStatus.value = st ?? null
    if (wasLive && st === 'finished') triggerHaptic('Xtreme Finish')
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="match && p1 && p2" class="h-screen flex flex-col overflow-hidden bg-slate-950 p-3 text-white sm:p-4">
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
            {{ t('match.targetHint', { n: match.target_points }) }}
          </span>
        </div>
        <button
          type="button"
          class="rounded-xl border border-slate-800 bg-slate-900 p-1.5 text-slate-300 transition-all active:scale-90 disabled:opacity-20 sm:p-2"
          :disabled="match.logs.length === 0"
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
          match.p1_score >= match.target_points
            ? 'ring-4 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
            : 'bg-slate-900/40 ring-1 ring-white/10'
        "
      >
        <div class="flex h-18 items-center justify-between border-b border-white/5 bg-red-500/10 px-3 py-2.5 sm:px-4 sm:py-3.5">
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h2 class="truncate text-lg font-black uppercase italic sm:text-base">
              {{ p1.name }}
            </h2>
            <p class="truncate text-sm font-bold italic text-red-400/70">
              {{ p1.bey_name || t('match.noBey') }}
            </p>
          </div>
        </div>

        <div class=" min-h-0 flex-1 items-center justify-center flex landscape:flex">
          <span
            class="text-7xl text-red-400 font-black italic tracking-tighter tabular-nums landscape:text-4xl lg:text-8xl lg:landscape:text-8xl"
          >
            {{ match.p1_score }}
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
              match.status !== 'live' ? 'grayscale opacity-30' : 'hover:brightness-110',
            ]"
            :disabled="match.status !== 'live'"
            @click="score(p1.id, a.key)"
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
          match.p2_score >= match.target_points
            ? 'ring-4 ring-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
            : 'bg-slate-900/40 ring-1 ring-white/10'
        "
      >
        <div class="flex h-18 items-center justify-between border-b border-white/5 bg-blue-500/10 px-3 py-2.5 sm:px-4 sm:py-3.5">
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <h2
              class="truncate text-lg font-black uppercase italic"
              :class="
                match.status === 'finished' && match.p2_score < match.p1_score
                  ? 'text-red-400'
                  : 'text-white'
              "
            >
              {{ p2.name }}
            </h2>
            <p
              class="truncate text-sm font-bold italic"
              :class="
                match.status === 'finished' && match.p2_score < match.p1_score
                  ? 'text-red-400/70'
                  : 'text-blue-400/70'
              "
            >
              {{ p2.bey_name || t('match.noBey') }}
            </p>
          </div>
        </div>

        <div class="min-h-0 flex-1 items-center justify-center flex landscape:flex">
          <span
            class="text-7xl font-black italic tracking-tighter tabular-nums landscape:text-4xl lg:text-8xl lg:landscape:text-8xl"
            :class="
              match.status === 'finished' && match.p2_score < match.p1_score
                ? 'text-red-400'
                : 'text-blue-400'
            "
          >
            {{ match.p2_score }}
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
              match.status !== 'live' ? 'grayscale opacity-30' : 'hover:brightness-110',
            ]"
            :disabled="match.status !== 'live'"
            @click="score(p2.id, a.key)"
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
        v-if="match.status === 'finished'"
        class="fixed inset-0 z-100 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-slate-950/90 backdrop-blur-md"></div>
        <div class="relative w-full max-w-sm rounded-4xl border border-white/10 bg-slate-900 p-4 text-center shadow-2xl sm:p-8">
          <h3
            class="mb-4 text-3xl font-black uppercase italic leading-none tracking-tighter md:text-5xl"
            :class="match.p1_score > match.p2_score ? 'text-red-400' : 'text-blue-400'"
          >
            {{ t('match.finished') }}
          </h3>
          <p class="mb-4 font-bold text-slate-400 md:mb-8 text-xl md:text-lg">
            <i18n-t keypath="match.winnerIs" tag="span">
              <template #name>
                <span :class="match.p1_score > match.p2_score ? 'text-red-400' : 'text-blue-400'">
                  {{ match.p1_score > match.p2_score ? p1.name : p2.name }}
                </span>
              </template>
            </i18n-t>
          </p>
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
