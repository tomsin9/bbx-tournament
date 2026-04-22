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

function winnerName(match: {
  p1_participant_id: string
  p2_participant_id: string
  p1_score: number
  p2_score: number
}) {
  if (match.p1_score === match.p2_score) return null
  return match.p1_score > match.p2_score
    ? label(match.p1_participant_id)
    : label(match.p2_participant_id)
}

function formatTimestamp(ts: string) {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts

  const now = Date.now()
  const diffMs = date.getTime() - now
  const absMs = Math.abs(diffMs)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  if (absMs < hourMs) {
    return rtf.format(Math.round(diffMs / minuteMs), 'minute')
  }
  if (absMs < dayMs) {
    return rtf.format(Math.round(diffMs / hourMs), 'hour')
  }
  if (absMs < 7 * dayMs) {
    return rtf.format(Math.round(diffMs / dayMs), 'day')
  }

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function actionBadgeClass(action: string) {
  const normalized = action.toLowerCase()
  if (normalized.includes('xtreme')) return 'bg-bx-primary/15 text-bx-primary ring-bx-primary/30'
  if (normalized.includes('burst')) return 'bg-fuchsia-400/15 text-fuchsia-300 ring-fuchsia-400/30'
  if (normalized.includes('over')) return 'bg-bx-accent/15 text-bx-accent ring-bx-accent/30'
  return 'bg-slate-700/30 text-slate-300 ring-slate-600/40'
}

function actionBadgeLabel(action: string) {
  const normalized = action.toLowerCase()
  if (normalized.includes('xtreme')) return 'XTREME'
  if (normalized.includes('burst')) return 'BURST'
  if (normalized.includes('over')) return 'OVER'
  return action.toUpperCase()
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
  <div class="mx-auto max-w-3xl space-y-8 pb-12">
    <header class="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
      <div class="space-y-1">
        <h1 class="text-3xl font-black italic tracking-tight text-white uppercase">{{ t('history.title') }}</h1>
        <p class="text-sm text-slate-500">記錄過去每一場榮耀時刻</p>
      </div>

      <button
        type="button"
        class="group inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-bx-surface px-6 py-3 text-sm font-bold text-slate-200 transition-all hover:border-bx-accent/40 hover:text-white"
        @click="downloadExport"
      >
        <svg class="h-5 w-5 text-bx-accent transition-colors group-hover:text-bx-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {{ t('history.export') }}
      </button>
    </header>

    <div
      v-if="!store.finishedMatches.length"
      class="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-800 bg-bx-surface/30 py-20 text-slate-600"
    >
      <svg class="mb-4 h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="font-bold">{{ t('history.empty') }}</p>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="m in store.finishedMatches"
        :key="m.match_id"
        class="group relative overflow-hidden rounded-4xl border border-slate-800 bg-slate-950/90 p-6 transition-all hover:border-bx-accent/30"
      >
        <div class="pointer-events-none absolute -right-4 -top-4 select-none text-8xl font-black italic tracking-tighter text-white/3">VS</div>

        <div class="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div class="flex items-center gap-6">
            <div class="min-w-[96px] text-center">
              <p class="truncate text-sm font-bold" :class="m.p1_score > m.p2_score ? 'text-white' : 'text-slate-500'">
                {{ m.p1_score > m.p2_score ? '🏆 ' : '' }}{{ label(m.p1_participant_id) }}
              </p>
              <p class="text-3xl font-black italic tracking-tight" :class="m.p1_score > m.p2_score ? 'text-bx-primary' : 'text-slate-700'">{{ m.p1_score }}</p>
            </div>

            <div class="text-xs font-black italic tracking-tight text-slate-700">{{ t('history.vs') }}</div>

            <div class="min-w-[96px] text-center">
              <p class="truncate text-sm font-bold" :class="m.p2_score > m.p1_score ? 'text-white' : 'text-slate-500'">
                {{ m.p2_score > m.p1_score ? '🏆 ' : '' }}{{ label(m.p2_participant_id) }}
              </p>
              <p class="text-3xl font-black italic tracking-tight" :class="m.p2_score > m.p1_score ? 'text-bx-primary' : 'text-slate-700'">{{ m.p2_score }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-1 md:items-end">
            <div
              v-if="winnerName(m)"
              class="inline-flex items-center gap-1.5 rounded-full bg-bx-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-bx-primary ring-1 ring-bx-primary/20"
            >
              <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Winner: {{ winnerName(m) }}
            </div>
            <p class="text-[10px] font-medium text-slate-500">{{ formatTimestamp(m.timestamp) }}</p>
          </div>
        </div>

        <details class="mt-6 group/logs">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-300">
            <svg class="h-3 w-3 transition-transform group-open/logs:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
            </svg>
            Match Details
          </summary>

          <div class="ml-1.5 mt-4 space-y-2 border-l-2 border-slate-800 py-1 pl-4">
            <div v-for="(log, i) in m.logs" :key="i" class="flex items-center gap-3 text-sm">
              <span class="min-w-[72px] truncate font-bold text-slate-300">{{ label(log.winner_participant_id) }}</span>
              <span class="rounded-full px-2 py-1 text-[10px] font-black tracking-wide ring-1" :class="actionBadgeClass(log.action)">
                {{ actionBadgeLabel(log.action) }}
              </span>
              <span class="ml-auto font-mono font-bold text-bx-accent">+{{ log.points }}</span>
            </div>
          </div>
        </details>
      </article>
    </div>
  </div>
</template>
