<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import { computePlayerStats, winRate } from '@/utils/playerStats'

const { t } = useI18n()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const p1 = ref('')
const p2 = ref('')
const startError = ref<string | null>(null)

const stats = computed(() => computePlayerStats(store.players, store.matches))

function label(pid: string) {
  const p = store.playerById(pid)
  return p ? (p.bey_name ? `${p.name} (${p.bey_name})` : p.name) : pid
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
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-white">{{ t('lobby.title') }}</h1>
      <p v-if="!store.hasPlayers" class="mt-2 text-amber-300/90">{{ t('lobby.noPlayers') }}</p>
      <p v-else class="mt-2 text-slate-400">{{ t('lobby.pick') }}</p>
    </div>

    <section
      v-if="store.hasPlayers"
      class="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-300">{{ t('lobby.p1') }}</span>
          <select
            v-model="p1"
            class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="" disabled>{{ t('lobby.p1') }}</option>
            <option v-for="pl in store.players" :key="pl.id" :value="pl.id">
              {{ pl.name }}{{ pl.bey_name ? ` — ${pl.bey_name}` : '' }}
            </option>
          </select>
        </label>
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-300">{{ t('lobby.p2') }}</span>
          <select
            v-model="p2"
            class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="" disabled>{{ t('lobby.p2') }}</option>
            <option v-for="pl in store.players" :key="pl.id" :value="pl.id">
              {{ pl.name }}{{ pl.bey_name ? ` — ${pl.bey_name}` : '' }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="startError" class="mt-3 text-sm text-red-400">{{ startError }}</p>
      <button
        type="button"
        class="mt-4 w-full min-h-14 rounded-xl bg-[#2e21de] py-3 text-lg font-bold text-white hover:bg-[#3b2eeb] disabled:opacity-40"
        :disabled="!p1 || !p2"
        @click="start"
      >
        {{ t('lobby.start') }}
      </button>
    </section>

    <section v-if="store.liveMatches.length" class="space-y-3">
      <h2 class="text-lg font-semibold text-white">{{ t('lobby.live') }}</h2>
      <ul class="space-y-2">
        <li
          v-for="m in store.liveMatches"
          :key="m.match_id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
        >
          <span class="text-slate-200">
            {{ label(m.p1_id) }}
            <span class="text-slate-500">{{ t('history.vs') }}</span>
            {{ label(m.p2_id) }}
            <span class="ml-2 font-mono text-white">{{ m.p1_score }} – {{ m.p2_score }}</span>
          </span>
          <button
            type="button"
            class="rounded-lg bg-[#2e21de] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3b2eeb]"
            @click="resume(m.match_id)"
          >
            {{ t('lobby.resume') }}
          </button>
        </li>
      </ul>
    </section>

    <section v-if="store.hasPlayers" class="space-y-3">
      <h2 class="text-lg font-semibold text-white">{{ t('lobby.stats') }}</h2>
      <div class="overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full min-w-[28rem] text-left text-sm">
          <thead class="bg-slate-900 text-slate-400">
            <tr>
              <th class="px-4 py-3 font-medium">{{ t('setup.playersTitle') }}</th>
              <th class="px-2 py-3 font-medium">{{ t('lobby.wins') }}</th>
              <th class="px-2 py-3 font-medium">{{ t('lobby.losses') }}</th>
              <th class="px-2 py-3 font-medium">{{ t('lobby.winRate') }}</th>
              <th class="px-2 py-3 font-medium">{{ t('lobby.pts') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800 bg-slate-950/40">
            <tr v-for="pl in store.players" :key="pl.id">
              <td class="px-4 py-3 text-white">
                {{ pl.name }}
                <span v-if="pl.bey_name" class="block text-xs text-slate-500">{{ pl.bey_name }}</span>
              </td>
              <td class="px-2 py-3 text-slate-200">{{ stats.get(pl.id)?.wins ?? 0 }}</td>
              <td class="px-2 py-3 text-slate-200">{{ stats.get(pl.id)?.losses ?? 0 }}</td>
              <td class="px-2 py-3 text-slate-200">{{ pct(pl.id) }}</td>
              <td class="px-2 py-3 text-slate-200">{{ stats.get(pl.id)?.totalPointsScored ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
