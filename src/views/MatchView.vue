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

const p1 = computed(() => (match.value ? store.playerById(match.value.p1_id) : undefined))
const p2 = computed(() => (match.value ? store.playerById(match.value.p2_id) : undefined))

const prevStatus = ref<string | null>(null)

const actions: { key: FinishAction; labelKey: string }[] = [
  { key: 'Over Finish', labelKey: 'match.of' },
  { key: 'Burst Finish', labelKey: 'match.bf' },
  { key: 'Xtreme Finish', labelKey: 'match.xf' },
  { key: 'Spin Finish', labelKey: 'match.sf' },
]

function score(winnerId: string, action: FinishAction) {
  if (!match.value || match.value.status !== 'live') return
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
    if (wasLive && st === 'finished') {
      const id = matchId.value
      window.setTimeout(() => {
        if (store.getMatch(id)?.status === 'finished') void router.push('/lobby')
      }, 1200)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="match && p1 && p2" class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        class="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        @click="back"
      >
        {{ t('match.back') }}
      </button>
      <button
        type="button"
        class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-30"
        :disabled="match.logs.length === 0"
        @click="undo"
      >
        {{ t('match.undo') }}
      </button>
    </div>

    <p class="text-center text-sm text-slate-500">
      {{ t('match.targetHint', { n: match.target_points }) }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <section
        class="flex flex-col rounded-2xl border-2 border-slate-700 bg-slate-900/70 p-4 sm:p-5"
        :class="match.p1_score >= match.target_points ? 'border-emerald-500/80' : ''"
      >
        <h2 class="text-center text-lg font-bold text-white sm:text-xl">{{ p1.name }}</h2>
        <p v-if="p1.bey_name" class="text-center text-sm text-slate-500">{{ p1.bey_name }}</p>
        <p class="py-6 text-center text-6xl font-black tabular-nums text-white sm:text-7xl">
          {{ match.p1_score }}
        </p>
        <div class="mt-auto flex flex-col gap-3">
          <button
            v-for="a in actions"
            :key="a.key + '-p1'"
            type="button"
            class="min-h-14 rounded-xl bg-[#2e21de] px-2 py-3 text-left text-base font-bold leading-tight text-white hover:bg-[#3b2eeb] disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-16 sm:text-lg"
            :disabled="match.status !== 'live'"
            @click="score(p1.id, a.key)"
          >
            {{ t(a.labelKey) }}
            <span class="block text-xs font-normal opacity-90">
              +{{ FINISH_POINTS[a.key] }} {{ t('match.pts') }}
            </span>
          </button>
        </div>
      </section>

      <section
        class="flex flex-col rounded-2xl border-2 border-slate-700 bg-slate-900/70 p-4 sm:p-5"
        :class="match.p2_score >= match.target_points ? 'border-emerald-500/80' : ''"
      >
        <h2 class="text-center text-lg font-bold text-white sm:text-xl">{{ p2.name }}</h2>
        <p v-if="p2.bey_name" class="text-center text-sm text-slate-500">{{ p2.bey_name }}</p>
        <p class="py-6 text-center text-6xl font-black tabular-nums text-white sm:text-7xl">
          {{ match.p2_score }}
        </p>
        <div class="mt-auto flex flex-col gap-3">
          <button
            v-for="a in actions"
            :key="a.key + '-p2'"
            type="button"
            class="min-h-14 rounded-xl bg-[#2e21de] px-2 py-3 text-left text-base font-bold leading-tight text-white hover:bg-[#3b2eeb] disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-16 sm:text-lg"
            :disabled="match.status !== 'live'"
            @click="score(p2.id, a.key)"
          >
            {{ t(a.labelKey) }}
            <span class="block text-xs font-normal opacity-90">
              +{{ FINISH_POINTS[a.key] }} {{ t('match.pts') }}
            </span>
          </button>
        </div>
      </section>
    </div>

    <p
      v-if="match.status === 'finished'"
      class="text-center text-lg font-semibold text-emerald-400"
    >
      {{ t('match.finished') }}
    </p>
  </div>
  <p v-else class="text-slate-500">{{ t('nav.lobby') }}…</p>
</template>
