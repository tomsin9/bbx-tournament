<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Player } from '@/types/bxtm'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'

const { t } = useI18n()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const name = ref(store.tournamentName || '')
const target = ref(store.targetPoints)
const playerName = ref('')
const playerBey = ref('')
const editingId = ref<string | null>(null)
const selectedLibraryKeys = ref<string[]>([])

const canSave = computed(() => name.value.trim().length > 0 && store.players.length > 0)
const canAddPlayer = computed(() => playerName.value.trim().length > 0)
const libraryOptions = computed(() =>
  store.playerLibrary.filter(
    (p) => !store.players.some((cp) => cp.name === p.name && (cp.bey_name ?? '') === (p.bey_name ?? '')),
  ),
)
const selectedLibraryPlayers = computed(() => {
  const set = new Set(selectedLibraryKeys.value)
  return libraryOptions.value.filter((p) => set.has(libKey(p)))
})

onMounted(() => {
  name.value = store.tournamentName
  target.value = store.targetPoints
})

function libKey(p: { name: string; bey_name?: string }) {
  return `${p.name}|${p.bey_name ?? ''}`
}

function resetPlayerForm() {
  playerName.value = ''
  playerBey.value = ''
  editingId.value = null
}

function submitPlayer() {
  if (!canAddPlayer.value) return
  store.addOrUpdatePlayer({
    id: editingId.value ?? undefined,
    name: playerName.value,
    bey_name: playerBey.value,
  })
  resetPlayerForm()
}

function editPlayer(player: Player) {
  editingId.value = player.id
  playerName.value = player.name
  playerBey.value = player.bey_name ?? ''
}

function removePlayer(id: string) {
  if (!confirm(t('setup.removeConfirm'))) return
  store.removePlayer(id)
  if (editingId.value === id) resetPlayerForm()
}

function addSelectedFromLibrary() {
  if (selectedLibraryPlayers.value.length === 0) return
  store.addPlayersFromLibrary(selectedLibraryPlayers.value)
  selectedLibraryKeys.value = []
}

function save() {
  store.applySetup({
    tournamentName: name.value,
    targetPoints: target.value,
    players: store.players,
  })
  void router.push('/lobby')
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <h1 class="text-2xl font-bold text-white">{{ t('setup.title') }}</h1>

    <label class="block space-y-1">
      <span class="text-sm font-medium text-slate-300">{{ t('setup.name') }}</span>
      <input
        v-model="name"
        type="text"
        class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none ring-bx-primary focus:ring-2"
        autocomplete="off"
      />
    </label>

    <label class="block space-y-1">
      <span class="text-sm font-medium text-slate-300">{{ t('setup.target') }}</span>
      <input
        v-model.number="target"
        type="number"
        min="1"
        class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none ring-bx-primary focus:ring-2"
      />
    </label>

    <div class="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-semibold text-white">{{ t('setup.playersTitle') }}</h2>
        <span class="text-xs text-slate-500">{{ store.players.length }}</span>
      </div>

      <p class="text-sm text-slate-400">{{ t('setup.playerFormHelp') }}</p>
      <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          v-model="playerName"
          type="text"
          class="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none ring-bx-primary focus:ring-2"
          :placeholder="t('setup.playerName')"
        />
        <input
          v-model="playerBey"
          type="text"
          class="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none ring-bx-primary focus:ring-2"
          :placeholder="t('setup.playerBey')"
        />
        <button
          type="button"
          class="rounded-xl bg-bx-primary px-4 py-3 text-sm font-semibold text-white hover:bg-bx-primary-hover disabled:opacity-40"
          :disabled="!canAddPlayer"
          @click="submitPlayer"
        >
          {{ editingId ? t('setup.updatePlayer') : t('setup.addPlayer') }}
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="editingId"
          type="button"
          class="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          @click="resetPlayerForm"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>

    <ul
      v-if="store.players.length"
      class="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300"
    >
      <li v-for="p in store.players" :key="p.id" class="flex items-center justify-between gap-3">
        <div>
          <span class="font-medium text-white">{{ p.name }}</span>
          <span v-if="p.bey_name" class="text-slate-500"> — {{ p.bey_name }}</span>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
            @click="editPlayer(p)"
          >
            {{ t('setup.editPlayer') }}
          </button>
          <button
            type="button"
            class="rounded border border-red-900/60 px-2 py-1 text-xs text-red-300 hover:bg-red-950/40"
            @click="removePlayer(p.id)"
          >
            {{ t('setup.removePlayer') }}
          </button>
        </div>
      </li>
    </ul>

    <div class="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-semibold text-white">{{ t('setup.playerLibraryTitle') }}</h3>
        <span class="text-xs text-slate-500">{{ libraryOptions.length }}</span>
      </div>
      <p class="text-sm text-slate-400">{{ t('setup.playerLibraryHelp') }}</p>
      <select
        v-model="selectedLibraryKeys"
        multiple
        class="min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      >
        <option v-for="p in libraryOptions" :key="libKey(p)" :value="libKey(p)">
          {{ p.name }}{{ p.bey_name ? ` — ${p.bey_name}` : '' }}
        </option>
      </select>
      <button
        type="button"
        class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
        :disabled="selectedLibraryPlayers.length === 0"
        @click="addSelectedFromLibrary"
      >
        {{ t('setup.addFromLibrary') }}
      </button>
    </div>

    <button
      type="button"
      class="w-full min-h-12 rounded-xl bg-bx-primary py-3 text-base font-semibold text-white hover:bg-bx-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="!canSave"
      @click="save"
    >
      {{ t('setup.saveGoLobby') }}
    </button>
  </div>
</template>
