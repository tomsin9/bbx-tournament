<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'

const { t } = useI18n()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)
const hasCurrentTournament = computed(
  () => store.tournamentName.trim().length > 0 || store.hasPlayers || store.matches.length > 0,
)
const currentLiveMatchId = computed(() => store.liveMatches[0]?.match_id ?? null)

function onNewTournament() {
  store.newTournament()
  void router.push('/setup')
}

function triggerImport() {
  importError.value = null
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!confirm(t('common.replaceDataBody'))) return
  try {
    const text = await file.text()
    store.importJsonText(text)
    importError.value = null
    void router.push(store.hasPlayers ? '/lobby' : '/setup')
  } catch (err) {
    importError.value = err instanceof Error ? err.message : t('common.importFailed')
  }
}

function goLobby() {
  void router.push('/lobby')
}

function continueCurrentTournament() {
  if (currentLiveMatchId.value) {
    void router.push(`/match/${currentLiveMatchId.value}`)
    return
  }
  goLobby()
}

function goSetup() {
  void router.push('/setup')
}

function openTournament(id: string) {
  store.switchTournament(id)
  void router.push(store.hasPlayers ? '/lobby' : '/setup')
}

function removeTournament(id: string) {
  if (!confirm(t('home.deleteTournamentConfirm'))) return
  store.deleteTournament(id)
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-10 pb-12">
    <header class="space-y-3 py-6 text-center">
      <div
        class="inline-block rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-400"
      >
        Beyblade X Manager
      </div>
      <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
        {{ t('app.title') }}
      </h1>
      <p class="mx-auto max-w-prose text-slate-400">
        {{ t('home.tagline') }}
      </p>
    </header>

    <section v-if="!hasCurrentTournament" class="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        class="group relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/50 p-10 transition-all hover:border-bx-primary hover:bg-slate-900"
        @click="onNewTournament"
      >
        <div
          class="flex h-16 w-16 items-center justify-center rounded-2xl bg-bx-primary text-white shadow-lg shadow-bx-primary/20 transition-transform group-hover:scale-110"
        >
          <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div class="text-center">
          <h3 class="text-lg font-bold text-white">{{ t('home.createNewTournament') }}</h3>
          <p class="text-sm text-slate-500">{{ t('home.newTournamentHint') }}</p>
        </div>
      </button>

      <button
        type="button"
        class="group flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-transparent bg-slate-900/50 p-10 transition-all hover:bg-slate-800/80"
        @click="triggerImport"
      >
        <div
          class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 transition-colors group-hover:text-white"
        >
          <svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </div>
        <div class="text-center">
          <h3 class="text-lg font-bold text-slate-300">{{ t('home.import') }}</h3>
          <p class="text-sm text-slate-500">{{ t('home.importCardHint') }}</p>
        </div>
      </button>
    </section>

    <section
      v-else
      class="relative overflow-hidden rounded-3xl bg-indigo-600 p-1 shadow-2xl shadow-indigo-900/20"
    >
      <div
        class="relative flex flex-col justify-between gap-6 rounded-[22px] bg-slate-950 p-6 sm:flex-row sm:items-center"
      >
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="flex h-2 w-2 animate-ping rounded-full bg-red-500"></span>
            <p class="text-xs font-bold uppercase tracking-widest text-indigo-400">
              {{ t('home.currentTournament') }}
            </p>
          </div>
          <div>
            <h3 class="text-2xl font-bold text-white">{{ store.tournamentName || t('home.unnamedBattle') }}</h3>
            <p class="text-slate-400">
              {{ store.players.length }} {{ t('common.players') }} · {{ store.targetPoints }}
              {{ t('common.ptsToWin') }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 font-bold text-indigo-950 transition hover:bg-indigo-50 active:scale-95"
          @click="continueCurrentTournament"
        >
          {{ t('home.continueCurrentMatch') }}
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </section>

    <section v-if="hasCurrentTournament" class="grid gap-3 sm:grid-cols-3">
      <button
        type="button"
        class="rounded-2xl border border-bx-primary/40 bg-bx-primary/10 px-5 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-bx-primary/20"
        @click="onNewTournament"
      >
        {{ t('home.createNewTournament') }}
      </button>
      <button
        type="button"
        class="rounded-2xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
        @click="goSetup"
      >
        {{ t('home.goSetup') }}
      </button>
      <button
        type="button"
        class="rounded-2xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
        @click="triggerImport"
      >
        {{ t('home.import') }}
      </button>
    </section>

    <p v-if="!hasCurrentTournament" class="text-center text-sm text-slate-500">
      {{ t('home.importHint') }}
    </p>

    <p v-if="importError" class="text-sm text-red-400" role="alert">
      {{ t('common.importFailed') }}: {{ importError }}
    </p>

    <section v-if="store.tournamentList.length > 0" class="space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500">
          {{ t('home.tournamentList') }}
        </h2>
        <span class="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          {{ store.tournamentList.length }}
        </span>
      </div>
      <ul class="grid gap-3">
        <li
          v-for="item in store.tournamentList"
          :key="item.id"
          class="group flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/30 p-4 transition hover:bg-slate-900/80"
        >
          <div class="min-w-0 space-y-1">
            <p class="truncate font-bold text-slate-200 transition-colors group-hover:text-white">
              {{ item.name }}
              <span v-if="item.isActive" class="ml-2 text-[10px] uppercase text-indigo-400">
                ● {{ t('common.active') }}
              </span>
            </p>
            <p class="text-xs text-slate-500">{{ item.players }} P · {{ item.matches }} M</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="p-2 text-slate-400 hover:text-white"
              @click="openTournament(item.id)"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
            <button
              type="button"
              class="p-2 text-slate-600 hover:text-red-400 disabled:opacity-0"
              @click="removeTournament(item.id)"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </li>
      </ul>
    </section>

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFile"
    />
  </div>
</template>
