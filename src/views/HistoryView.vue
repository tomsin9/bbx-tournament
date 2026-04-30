<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'

const { t, locale } = useI18n()
const store = useTournamentStore()
store.hydrate()
const selectedTournamentId = ref('all')
const visibleMatchCount = ref(10)

const tournamentFilterOptions = computed(() => [
  { id: 'all', name: t('history.allTournaments') },
  { id: 'quick', name: t('history.quickMatch') },
  ...store.tournamentList.map((tt) => ({ id: tt.id, name: tt.name })),
])

const sortedFinishedMatches = computed(() =>
  store.allFinishedMatches
    .filter((m) => {
      const isQuick =
        m.is_quick_match === true || (m.tournament_name ?? '').trim() === 'Quick Match'
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

const displayedFinishedMatches = computed(() =>
  sortedFinishedMatches.value.slice(0, visibleMatchCount.value),
)

const hasMoreMatches = computed(
  () => sortedFinishedMatches.value.length > visibleMatchCount.value,
)

function loadMoreMatches() {
  visibleMatchCount.value += 10
}

watch(selectedTournamentId, () => {
  visibleMatchCount.value = 10
})

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
    return 'bg-slate-900/80 text-red-300 ring-slate-700/80'
  }
  if (match.p2_score > match.p1_score) {
    return 'bg-slate-900/80 text-blue-400 ring-slate-700/80'
  }
  return 'bg-slate-900/80 text-bx-primary ring-slate-700/80'
}

function historyLocale() {
  return locale.value?.toLowerCase().startsWith('zh') ? 'zh-Hant-HK' : locale.value || undefined
}

/** Prefer endedAt so history shows when the match finished, not when it was created/scheduled. */
function matchEndedAtParts(m: { endedAt?: string; timestamp: string }): {
  dateTime: string
  ago: string
} | { raw: string } {
  const raw = (m.endedAt?.trim() || m.timestamp).trim()
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return { raw }
  const activeLocale = historyLocale()
  const dateTime = new Intl.DateTimeFormat(activeLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)

  const now = Date.now()
  const diffMs = date.getTime() - now
  const absMs = Math.abs(diffMs)
  const sec = 1000
  const minuteMs = 60 * sec
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const rtf = new Intl.RelativeTimeFormat(activeLocale, { numeric: 'auto' })

  let ago: string
  if (absMs < 45 * sec) {
    ago = rtf.format(Math.round(diffMs / sec), 'second')
  } else if (absMs < hourMs) {
    ago = rtf.format(Math.round(diffMs / minuteMs), 'minute')
  } else if (absMs < dayMs) {
    ago = rtf.format(Math.round(diffMs / hourMs), 'hour')
  } else if (absMs < 7 * dayMs) {
    ago = rtf.format(Math.round(diffMs / dayMs), 'day')
  } else if (absMs < 30 * dayMs) {
    ago = rtf.format(Math.round(diffMs / (7 * dayMs)), 'week')
  } else if (absMs < 365 * dayMs) {
    ago = rtf.format(Math.round(diffMs / (30 * dayMs)), 'month')
  } else {
    ago = rtf.format(Math.round(diffMs / (365 * dayMs)), 'year')
  }

  return { dateTime, ago }
}

function matchComboParts(
  side: 'p1' | 'p2',
  m: {
    p1_beys?: string[]
    p2_beys?: string[]
    p1_bey_name?: string
    p2_bey_name?: string
  },
): string[] {
  const beys = side === 'p1' ? m.p1_beys : m.p2_beys
  const fromBeys = beys?.map((x) => x.trim()).filter(Boolean) ?? []
  if (fromBeys.length > 0) return fromBeys
  const legacy = side === 'p1' ? m.p1_bey_name : m.p2_bey_name
  const legacyParts = (legacy ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // If old history only stored slot1 (no comma), hide it to avoid misleading partial combo display.
  return legacyParts.length >= 2 ? legacyParts : []
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
          <label class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            {{ t('history.filterLabel') }}
          </label>
          <select
            v-model="selectedTournamentId"
            class="min-h-11 rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-200 focus:border-bx-primary focus:outline-none"
          >
            <option v-for="opt in tournamentFilterOptions" :key="opt.id" :value="opt.id">{{ opt.name }}</option>
          </select>
        </div>
        <button
          type="button"
          class="group inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-bx-primary/40 hover:text-white sm:self-end"
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
        v-for="m in displayedFinishedMatches"
        :key="m.match_id"
        class="group relative overflow-hidden rounded-4xl border-2 border-slate-700/90 bg-slate-900/45 p-5 ring-1 ring-white/8 transition-all duration-200 hover:-translate-y-0.5 hover:border-bx-primary/45 hover:shadow-[0_14px_35px_rgba(0,0,0,0.28)] sm:p-6"
      >
        <div class="pointer-events-none absolute -right-4 -top-4 select-none text-8xl font-black italic tracking-tighter text-white/3">VS</div>

        <div class="relative mb-4 flex flex-wrap items-center justify-between gap-2">
          <p class="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {{ t('history.tournament') }}: {{ m.tournament_name || '-' }}
          </p>
          <div class="flex items-center gap-2">
            <p
              v-for="ended in [matchEndedAtParts(m)]"
              :key="m.match_id + '-ended-at'"
              class="flex max-w-[min(100%,18rem)] flex-col gap-0.5 rounded-full border border-slate-700/80 bg-slate-900/80 px-2.5 py-1 text-[11px] sm:max-w-none sm:flex-row sm:items-center sm:gap-2"
            >
              <template v-if="'raw' in ended">
                <span class="font-medium text-slate-400">{{ ended.raw }}</span>
              </template>
              <template v-else>
                <span class="shrink-0 font-medium text-slate-300">{{ ended.dateTime }}</span>
                <span class="font-medium text-slate-500">{{ ended.ago }}</span>
              </template>
            </p>
            <div
              v-if="winnerName(m)"
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ring-1"
              :class="winnerBadgeClass(m)"
            >
              <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {{ t('history.winner', { name: winnerName(m) }) }}
            </div>
          </div>
        </div>

        <div class="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div class="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
            <div class="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-3 py-3 text-center sm:px-4">
              <p class="truncate text-sm font-bold" :class="m.p1_score > m.p2_score ? 'text-white' : 'text-slate-500'">
                {{ m.p1_score > m.p2_score ? '🏆 ' : '' }}{{ m.p1_name }}
              </p>
              <!-- <div
                v-if="matchComboParts('p1', m).length > 0"
                class="mx-auto mt-1 flex max-w-full flex-wrap justify-center gap-1"
              >
                <span
                  v-for="(part, partIdx) in matchComboParts('p1', m)"
                  :key="'h-p1-' + m.match_id + '-' + partIdx"
                  class="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                >
                  {{ part }}
                </span>
              </div> -->
              <p
                class="mt-2 text-4xl font-black italic tracking-tight"
                :class="m.p1_score > m.p2_score ? 'text-red-500' : 'text-red-400/50'"
              >
                {{ m.p1_score }}
              </p>
            </div>

            <div class="text-center text-xs font-black italic tracking-tight text-slate-600">{{ t('history.vs') }}</div>

            <div class="rounded-2xl border border-slate-700/80 bg-slate-900/70 px-3 py-3 text-center sm:px-4">
              <p class="truncate text-sm font-bold" :class="m.p2_score > m.p1_score ? 'text-white' : 'text-slate-500'">
                {{ m.p2_score > m.p1_score ? '🏆 ' : '' }}{{ m.p2_name }}
              </p>
              <!-- <div
                v-if="matchComboParts('p2', m).length > 0"
                class="mx-auto mt-1 flex max-w-full flex-wrap justify-center gap-1"
              >
                <span
                  v-for="(part, partIdx) in matchComboParts('p2', m)"
                  :key="'h-p2-' + m.match_id + '-' + partIdx"
                  class="rounded-full border border-slate-700/70 bg-slate-900/70 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                >
                  {{ part }}
                </span>
              </div> -->
              <p
                class="mt-2 text-4xl font-black italic tracking-tight"
                :class="m.p2_score > m.p1_score ? 'text-blue-500' : 'text-blue-400/50'"
              >
                {{ m.p2_score }}
              </p>
            </div>
          </div>
        </div>

        <details class="mt-5 border-t border-slate-800/80 pt-4 group/logs">
          <summary class="flex cursor-pointer list-none items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-300">
            <svg class="h-3 w-3 transition-transform group-open/logs:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
            </svg>
            {{ t('history.matchDetails') }}
            <span class="rounded-full border border-slate-700/80 px-2 py-0.5 text-[9px] tracking-normal text-slate-400">
              {{ m.logs.length }}
            </span>
          </summary>

          <div class="ml-1 mt-4 space-y-2.5 border-l-2 border-slate-800/90 py-1 pl-4">
            <div v-for="(log, i) in m.logs" :key="i" class="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 px-2.5 py-2 text-sm">
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
                class="rounded-full px-2 py-1 text-[11px] font-black tracking-wide ring-1"
                :class="actionBadgeClass(log.action)"
              >
                {{ actionBadgeLabel(log.action) }}
              </span>
              <span class="text-[11px] font-medium text-slate-500">#{{ i + 1 }}</span>
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
      <button
        v-if="hasMoreMatches"
        type="button"
        class="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:border-bx-accent/40 hover:text-white"
        @click="loadMoreMatches"
      >
        {{ t('history.viewMore') }}
      </button>
    </div>
  </div>
</template>
