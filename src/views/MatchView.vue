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
  { key: 'Over Finish', labelKey: 'match.of' },
  { key: 'Burst Finish', labelKey: 'match.bf' },
  { key: 'Xtreme Finish', labelKey: 'match.xf' },
  { key: 'Spin Finish', labelKey: 'match.sf' },
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
  <div v-if="match && p1 && p2" class="min-h-screen space-y-6 pb-20">
    <div class="flex items-center justify-between px-2">
      <button
        type="button"
        class="flex items-center gap-1 text-slate-400 transition-colors hover:text-white"
        @click="back"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="text-sm font-bold uppercase tracking-widest">{{ t('match.back') }}</span>
      </button>

      <div class="flex items-center gap-4">
        <span
          class="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-black uppercase tracking-tighter text-slate-500 ring-1 ring-white/5"
        >
          {{ t('match.targetHint', { n: match.target_points }) }}
        </span>
        <button
          type="button"
          class="rounded-xl bg-slate-800 p-2 text-slate-300 transition-all hover:bg-slate-700 active:scale-90 disabled:opacity-20"
          :disabled="match.logs.length === 0"
          @click="undo"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
      </div>
    </div>

    <div class="grid h-full grid-cols-2 gap-2 sm:gap-6">
      <section
        class="relative flex flex-col gap-4 rounded-[2.5rem] bg-linear-to-b from-red-600/20 to-slate-900/90 p-4 ring-2 ring-red-500/20 transition-all"
        :class="
          match.p1_score >= match.target_points
            ? 'z-10 scale-[1.02] ring-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]'
            : ''
        "
      >
        <div class="space-y-1 text-center">
          <h2 class="truncate text-lg font-black uppercase italic tracking-tighter text-white">
            {{ p1.name }}
          </h2>
          <div class="text-[10px] font-bold uppercase tracking-widest text-red-400/80">
            {{ p1.bey_name || t('match.noBey') }}
          </div>
        </div>

        <div class="flex flex-col items-center justify-center py-4">
          <span
            class="text-7xl font-black italic tracking-tighter text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          >
            {{ match.p1_score }}
          </span>
        </div>

        <div class="grid gap-2">
          <button
            v-for="a in actions"
            :key="a.key + '-p1'"
            type="button"
            class="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl py-4 transition-all active:scale-95 disabled:grayscale disabled:opacity-20"
            :class="[
              a.key === 'Xtreme Finish' ? 'h-24 bg-red-600' : 'h-20 bg-slate-800',
              'hover:brightness-110',
            ]"
            :disabled="match.status !== 'live'"
            @click="score(p1.id, a.key)"
          >
            <span class="relative z-10 text-xs font-black uppercase italic tracking-tighter text-white">
              {{ t(a.labelKey) }}
            </span>
            <span class="relative z-10 text-xl font-black text-white/90">
              +{{ FINISH_POINTS[a.key] }}
            </span>
            <div
              v-if="a.key === 'Xtreme Finish'"
              class="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50"
            ></div>
          </button>
        </div>
      </section>

      <section
        class="relative flex flex-col gap-4 rounded-[2.5rem] bg-linear-to-b from-blue-600/20 to-slate-900/90 p-4 ring-2 ring-blue-500/20 transition-all"
        :class="
          match.p2_score >= match.target_points
            ? 'z-10 scale-[1.02] ring-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)]'
            : ''
        "
      >
        <div class="space-y-1 text-center">
          <h2 class="truncate text-lg font-black uppercase italic tracking-tighter text-white">
            {{ p2.name }}
          </h2>
          <div class="text-[10px] font-bold uppercase tracking-widest text-blue-400/80">
            {{ p2.bey_name || t('match.noBey') }}
          </div>
        </div>

        <div class="flex flex-col items-center justify-center py-4">
          <span
            class="text-7xl font-black italic tracking-tighter text-white tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          >
            {{ match.p2_score }}
          </span>
        </div>

        <div class="grid gap-2">
          <button
            v-for="a in actions"
            :key="a.key + '-p2'"
            type="button"
            class="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl py-4 transition-all active:scale-95 disabled:grayscale disabled:opacity-20"
            :class="[
              a.key === 'Xtreme Finish' ? 'h-24 bg-blue-600' : 'h-20 bg-slate-800',
              'hover:brightness-110',
            ]"
            :disabled="match.status !== 'live'"
            @click="score(p2.id, a.key)"
          >
            <span class="relative z-10 text-xs font-black uppercase italic tracking-tighter text-white">
              {{ t(a.labelKey) }}
            </span>
            <span class="relative z-10 text-xl font-black text-white/90">
              +{{ FINISH_POINTS[a.key] }}
            </span>
            <div
              v-if="a.key === 'Xtreme Finish'"
              class="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50"
            ></div>
          </button>
        </div>
      </section>
    </div>

    <transition name="scale">
      <div
        v-if="match.status === 'finished'"
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 px-6 text-center backdrop-blur-md"
      >
        <div class="mb-4 text-xs font-black uppercase tracking-[0.3em] text-indigo-400">
          {{ t('match.battleResult') }}
        </div>
        <h3 class="mb-2 text-6xl font-black uppercase italic tracking-tighter text-white">
          {{ t('match.finished') }}
        </h3>
        <p class="mb-8 text-xl font-bold text-slate-400">
          {{ t('match.winnerIs', { name: match.p1_score > match.p2_score ? p1.name : p2.name }) }}
        </p>
        <button
          type="button"
          class="rounded-2xl bg-white px-12 py-4 font-black uppercase tracking-widest text-slate-950 shadow-xl"
          @click="back"
        >
          {{ t('match.returnToLobby') }}
        </button>
      </div>
    </transition>
  </div>
  <p v-else class="text-slate-500">{{ t('nav.lobby') }}…</p>
</template>

<style scoped>
.scale-enter-active,
.scale-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scale-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
</style>
