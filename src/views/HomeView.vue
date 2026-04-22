<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'

const { t } = useI18n()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)

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
  <div class="space-y-8">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold text-white">{{ t('app.title') }}</h1>
      <p class="max-w-2xl text-slate-400">{{ t('home.tagline') }}</p>
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <button
        type="button"
        class="min-h-12 rounded-xl bg-[#2e21de] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-[#3b2eeb]"
        @click="onNewTournament"
      >
        {{ t('home.newTournament') }}
      </button>
      <button
        type="button"
        class="min-h-12 rounded-xl border border-slate-600 bg-slate-900 px-6 py-3 text-base font-semibold text-slate-100 hover:bg-slate-800"
        @click="triggerImport"
      >
        {{ t('home.import') }}
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="hidden"
        @change="onFile"
      />
    </div>

    <p class="text-sm text-slate-500">{{ t('home.importHint') }}</p>

    <p v-if="importError" class="text-sm text-red-400" role="alert">
      {{ t('common.importFailed') }}: {{ importError }}
    </p>

    <div class="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p class="w-full text-sm text-slate-400">
        {{ store.tournamentName || '—' }} · {{ store.targetPoints }} pts
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          v-if="store.hasPlayers"
          type="button"
          class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          @click="goLobby"
        >
          {{ t('home.goLobby') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          @click="goSetup"
        >
          {{ t('home.goSetup') }}
        </button>
      </div>
    </div>

    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-white">{{ t('home.tournamentList') }}</h2>
      <p v-if="store.tournamentList.length === 0" class="text-sm text-slate-500">
        {{ t('home.noTournament') }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="item in store.tournamentList"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-white">
              {{ item.name }}
              <span
                v-if="item.isActive"
                class="ml-2 rounded bg-[#2e21de]/30 px-2 py-0.5 text-xs font-medium text-indigo-200"
              >
                {{ t('common.active') }}
              </span>
            </p>
            <p class="text-xs text-slate-500">
              {{ item.players }} players · {{ item.matches }} matches
            </p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
              @click="openTournament(item.id)"
            >
              {{ t('home.openTournament') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-35"
              :disabled="store.tournamentList.length <= 1"
              @click="removeTournament(item.id)"
            >
              {{ t('home.deleteTournament') }}
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
