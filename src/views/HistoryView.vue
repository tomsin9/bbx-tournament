<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'

const { t, locale } = useI18n()
const store = useTournamentStore()
store.hydrate()
const selectedTournamentId = ref('all')

const tournamentFilterOptions = computed(() => [
  { id: 'all', name: t('history.allTournaments') },
  { id: 'quick', name: t('history.quickMatch') },
  ...store.tournamentList.map((tt) => ({ id: tt.id, name: tt.name })),
])

const sortedFinishedMatches = computed(() =>
  store.allFinishedMatches
    .filter((m) => {
      const isQuick = (m.tournament_name ?? '').trim() === 'Quick Match'
      if (selectedTournamentId.value === 'all') return true
      if (selectedTournamentId.value === 'quick') return isQuick
      return m.tournament_id === selectedTournamentId.value && !isQuick
    })
    .sort((a, b) => {
    const ta = Date.parse(a.endedAt ?? a.timestamp)
    const tb = Date.parse(b.endedAt ?? b.timestamp)
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0
    if (Number.isNaN(ta)) return 1
    if (Number.isNaN(tb)) return -1
    return tb - ta
    }),
)

function winnerName(match: {
  p1_name: string
  p2_name: string
  p1_score: number
  p2_score: number
}) {
  if (match.p1_score === match.p2_score) return null
  return match.p1_score > match.p2_score
    ? match.p1_name
    : match.p2_name
}

function winnerBadgeClass(match: { p1_score: number; p2_score: number }) {
  if (match.p1_score > match.p2_score) {
    return 'bg-red-400/10 text-red-300 ring-red-300/25'
  }
  if (match.p2_score > match.p1_score) {
    return 'bg-blue-400/10 text-blue-500 ring-blue-300/25'
  }
  return 'bg-bx-primary/10 text-bx-primary ring-bx-primary/20'
}

function formatTimestamp(ts: string) {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts
  const activeLocale = locale.value?.toLowerCase().startsWith('zh')
    ? 'zh-Hant-HK'
    : (locale.value || undefined)

  const now = Date.now()
  const diffMs = date.getTime() - now
  const absMs = Math.abs(diffMs)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const rtf = new Intl.RelativeTimeFormat(activeLocale, { numeric: 'auto' })

  if (absMs < hourMs) {
    return rtf.format(Math.round(diffMs / minuteMs), 'minute')
  }
  if (absMs < dayMs) {
    return rtf.format(Math.round(diffMs / hourMs), 'hour')
  }
  if (absMs < 7 * dayMs) {
    return rtf.format(Math.round(diffMs / dayMs), 'day')
  }

  return new Intl.DateTimeFormat(activeLocale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function normalizeAction(action: string) {
  return action.trim().toLowerCase()
}

function actionType(action: string): 'xf' | 'bf' | 'of' | 'sf' | 'other' {
  const normalized = normalizeAction(action)
  if (normalized.includes('xtreme') || normalized === 'xf') return 'xf'
  if (normalized.includes('burst') || normalized === 'bf') return 'bf'
  if (normalized.includes('over') || normalized === 'of') return 'of'
  if (normalized.includes('spin') || normalized === 'sf') return 'sf'
  return 'other'
}

function actionBadgeClass(action: string) {
  const type = actionType(action)
  if (type === 'xf') return 'bg-bx-primary/15 text-bx-primary ring-bx-primary/30'
  if (type === 'of' || type === 'bf') return 'bg-orange-400/15 text-orange-300 ring-orange-300/30'
  if (type === 'sf') return 'bg-slate-700/30 text-slate-300 ring-slate-600/40'
  return 'bg-slate-700/30 text-slate-300 ring-slate-600/40'
}

function actionBadgeLabel(action: string) {
  const type = actionType(action)
  if (type === 'xf') return t('history.actions.xf')
  if (type === 'bf') return t('history.actions.bf')
  if (type === 'of') return t('history.actions.of')
  if (type === 'sf') return t('history.actions.sf')
  return action
}

function actionPointsClass(action: string) {
  const type = actionType(action)
  if (type === 'xf') return 'text-bx-primary'
  if (type === 'of' || type === 'bf') return 'text-orange-400'
  return 'text-slate-400'
}

function logWinnerSide(
  logWinnerId: string,
  match: { p1_participant_id: string; p2_participant_id: string },
): 'p1' | 'p2' | 'other' {
  if (logWinnerId === match.p1_participant_id) return 'p1'
  if (logWinnerId === match.p2_participant_id) return 'p2'
  return 'other'
}

function logAccentClass(
  logWinnerId: string,
  match: { p1_participant_id: string; p2_participant_id: string },
) {
  const side = logWinnerSide(logWinnerId, match)
  if (side === 'p1') return 'text-red-500'
  if (side === 'p2') return 'text-blue-500'
  return 'text-slate-300'
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
        <p class="text-sm text-slate-500">{{ t('history.subtitle') }}</p>
      </div>

      <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
        <div class="flex min-w-56 flex-col gap-1">
          <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            {{ t('history.filterLabel') }}
          </label>
          <select
            v-model="selectedTournamentId"
            class="min-h-11 rounded-2xl border border-slate-700 bg-bx-surface px-3 py-2 text-sm font-bold text-slate-200 focus:border-bx-primary focus:outline-none"
          >
            <option v-for="opt in tournamentFilterOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
          </select>
        </div>
        <button
          type="button"
          class="group inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-bx-surface px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-bx-accent/40 hover:text-white sm:self-end"
          @click="downloadExport"
        >
          <svg class="h-5 w-5 text-bx-accent transition-colors group-hover:text-bx-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {{ t('history.export') }}
        </button>
      </div>
    </header>

    <div
      v-if="!sortedFinishedMatches.length"
      class="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-slate-800 bg-bx-surface/30 py-20 text-slate-600"
    >
      <svg class="mb-4 h-16 w-16 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="font-bold">{{ t('history.empty') }}</p>
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="m in sortedFinishedMatches"
        :key="m.match_id"
        class="group relative overflow-hidden rounded-4xl border border-slate-800 bg-slate-950/90 p-6 transition-all hover:border-bx-accent/30"
      >
        <div class="pointer-events-none absolute -right-4 -top-4 select-none text-8xl font-black italic tracking-tighter text-white/3">VS</div>

        <div class="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div class="flex items-center gap-6">
            <div class="min-w-[96px] text-center">
              <p class="truncate text-sm font-bold" :class="m.p1_score > m.p2_score ? 'text-white' : 'text-slate-500'">
                {{ m.p1_score > m.p2_score ? '🏆 ' : '' }}{{ m.p1_name }}
              </p>
              <p
                class="text-3xl font-black italic tracking-tight"
                :class="m.p1_score > m.p2_score ? 'text-red-500' : 'text-red-400/50'"
              >
                {{ m.p1_score }}
              </p>
            </div>

            <div class="text-xs font-black italic tracking-tight text-slate-700">{{ t('history.vs') }}</div>

            <div class="min-w-[96px] text-center">
              <p class="truncate text-sm font-bold" :class="m.p2_score > m.p1_score ? 'text-white' : 'text-slate-500'">
                {{ m.p2_score > m.p1_score ? '🏆 ' : '' }}{{ m.p2_name }}
              </p>
              <p
                class="text-3xl font-black italic tracking-tight"
                :class="m.p2_score > m.p1_score ? 'text-blue-500' : 'text-blue-400/50'"
              >
                {{ m.p2_score }}
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-1 md:items-end">
            <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {{ t('history.tournament') }}: {{ m.tournament_name || '-' }}
            </p>
            <div
              v-if="winnerName(m)"
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1"
              :class="winnerBadgeClass(m)"
            >
              <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {{ t('history.winner', { name: winnerName(m) }) }}
            </div>
            <p class="text-[10px] font-medium text-slate-500">{{ formatTimestamp(m.timestamp) }}</p>
          </div>
        </div>

        <details class="mt-6 group/logs">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-300">
            <svg class="h-3 w-3 transition-transform group-open/logs:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
            </svg>
            {{ t('history.matchDetails') }}
          </summary>

          <div class="ml-1.5 mt-4 space-y-2 border-l-2 border-slate-800 py-1 pl-4">
            <div v-for="(log, i) in m.logs" :key="i" class="flex items-center gap-3 text-sm">
              <span
                class="min-w-[72px] truncate font-bold"
                :class="logAccentClass(log.winner_participant_id, m)"
              >
                {{
                  log.winner_participant_id === m.p1_participant_id
                    ? m.p1_name
                    : log.winner_participant_id === m.p2_participant_id
                      ? m.p2_name
                      : log.winner_participant_id
                }}
              </span>
              <span
                class="rounded-full px-2 py-1 text-[10px] font-black tracking-wide ring-1"
                :class="actionBadgeClass(log.action)"
              >
                {{ actionBadgeLabel(log.action) }}
              </span>
              <span
                class="ml-auto font-mono font-bold"
                :class="actionPointsClass(log.action)"
              >
                +{{ log.points }}
              </span>
            </div>
          </div>
        </details>
      </article>
    </div>
  </div>
</template>
