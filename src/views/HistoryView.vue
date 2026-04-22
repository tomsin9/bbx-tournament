<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'

const { t } = useI18n()
const store = useTournamentStore()
store.hydrate()

function label(pid: string) {
  const p = store.playerById(pid)
  return p?.name ?? pid
}

function downloadExport() {
  const blob = new Blob([store.exportJsonText()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bxtm-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-white">{{ t('history.title') }}</h1>
      <button
        type="button"
        class="min-h-11 rounded-xl bg-[#2e21de] px-5 py-2 text-sm font-bold text-white hover:bg-[#3b2eeb]"
        @click="downloadExport"
      >
        {{ t('history.export') }}
      </button>
    </div>

    <p v-if="!store.finishedMatches.length" class="text-slate-500">{{ t('history.empty') }}</p>

    <ul v-else class="space-y-3">
      <li
        v-for="m in store.finishedMatches"
        :key="m.match_id"
        class="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-lg font-semibold text-white">
            {{ label(m.p1_id) }}
            <span class="text-slate-500">{{ t('history.vs') }}</span>
            {{ label(m.p2_id) }}
          </p>
          <p class="font-mono text-xl text-indigo-200">
            {{ m.p1_score }} – {{ m.p2_score }}
          </p>
        </div>
        <p class="mt-1 text-xs text-slate-500">{{ m.timestamp }}</p>
        <ol class="mt-3 space-y-1 border-t border-slate-800 pt-3 text-sm text-slate-400">
          <li v-for="(log, i) in m.logs" :key="i">
            <span class="text-slate-200">{{ label(log.winner_id) }}</span>
            — {{ log.action }} (+{{ log.points }})
          </li>
        </ol>
      </li>
    </ul>
  </div>
</template>
