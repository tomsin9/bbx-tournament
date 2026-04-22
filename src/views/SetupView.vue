<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { TournamentParticipant } from '@/types/bxtm'
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
const activeTab = ref<'rules' | 'players'>('rules')
const playerNameInput = ref<HTMLInputElement | null>(null)

const canSave = computed(() => name.value.trim().length > 0 && store.players.length > 0)
const canAddPlayer = computed(() => playerName.value.trim().length > 0)
const libraryOptions = computed(() =>
  store.playerLibrary.filter((p) => !store.players.some((cp) => cp.player_id === p.id)),
)
const selectedLibraryPlayers = computed(() => {
  const set = new Set(selectedLibraryKeys.value)
  return libraryOptions.value.filter((p) => set.has(libKey(p)))
})

onMounted(() => {
  name.value = store.tournamentName
  target.value = store.targetPoints
})

function libKey(p: { id: string }) {
  return p.id
}

function resetPlayerForm() {
  playerName.value = ''
  playerBey.value = ''
  editingId.value = null
  void focusPlayerNameInput()
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

function editPlayer(player: TournamentParticipant) {
  activeTab.value = 'players'
  editingId.value = player.id
  playerName.value = player.name
  playerBey.value = player.bey_name ?? ''
  void focusPlayerNameInput()
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

async function focusPlayerNameInput() {
  await nextTick()
  playerNameInput.value?.focus()
}

watch(activeTab, (tab) => {
  if (tab === 'players') {
    void focusPlayerNameInput()
  }
})

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
  <div class="mx-auto max-w-2xl space-y-8 pb-32">
    <header class="space-y-1">
      <h1 class="text-3xl font-black italic uppercase tracking-tighter text-white">
        {{ t('setup.title') }}
      </h1>
      <p class="text-sm text-slate-500">{{ t('setup.subtitle') }}</p>
    </header>

    <div class="flex rounded-2xl bg-slate-900/80 p-1.5 shadow-inner ring-1 ring-white/5">
      <button
        type="button"
        class="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-widest transition-all duration-200"
        :class="
          activeTab === 'rules'
            ? 'scale-[1.02] bg-bx-primary text-white shadow-lg shadow-indigo-500/20'
            : 'text-slate-500 hover:text-slate-300'
        "
        @click="activeTab = 'rules'"
      >
        {{ t('setup.tabRules') }}
      </button>
      <button
        type="button"
        class="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-widest transition-all duration-200"
        :class="
          activeTab === 'players'
            ? 'scale-[1.02] bg-bx-primary text-white shadow-lg shadow-indigo-500/20'
            : 'text-slate-500 hover:text-slate-300'
        "
        @click="activeTab = 'players'"
      >
        {{ t('setup.tabPlayers') }}
        <span class="ml-1 opacity-50">({{ store.players.length }})</span>
      </button>
    </div>

    <section v-if="activeTab === 'rules'" class="grid gap-6">
      <div class="group space-y-2">
        <label
          class="text-xs font-black uppercase tracking-widest text-slate-500 transition-colors group-focus-within:text-bx-primary"
        >
          {{ t('setup.name') }}
        </label>
        <input
          v-model="name"
          type="text"
          class="w-full rounded-2xl border-2 border-slate-800 bg-slate-900/50 px-5 py-4 text-lg font-bold text-white transition-all focus:border-bx-primary focus:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-bx-primary/10"
          :placeholder="t('setup.namePlaceholder')"
          autocomplete="off"
        />
      </div>

      <div class="group space-y-2">
        <label
          class="text-xs font-black uppercase tracking-widest text-slate-500 transition-colors group-focus-within:text-bx-primary"
        >
          {{ t('setup.target') }}
        </label>
        <div class="flex items-center gap-4">
          <input v-model.number="target" type="range" min="1" max="10" class="h-2 flex-1 accent-bx-primary" />
          <span class="min-w-12 text-center text-2xl font-black text-bx-primary">{{ target }}</span>
        </div>
      </div>
    </section>

    <section v-else class="space-y-8">
      <div class="relative space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <div class="grid gap-3 sm:grid-cols-2">
          <input
            ref="playerNameInput"
            v-model="playerName"
            type="text"
            class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-bx-primary focus:outline-none"
            :placeholder="t('setup.playerName')"
            @keyup.enter="submitPlayer"
          />
          <input
            v-model="playerBey"
            type="text"
            class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 focus:border-bx-primary focus:outline-none"
            :placeholder="t('setup.playerBey')"
            @keyup.enter="submitPlayer"
          />
        </div>
        <button
          type="button"
          class="w-full rounded-xl bg-white py-4 font-black uppercase tracking-tighter text-slate-950 transition-all hover:bg-indigo-50 active:scale-95 disabled:opacity-20"
          :disabled="!canAddPlayer"
          @click="submitPlayer"
        >
          {{ editingId ? t('setup.updateWarrior') : t('setup.addToRoster') }}
        </button>
        <button
          v-if="editingId"
          type="button"
          class="w-full rounded-xl border border-slate-700 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          @click="resetPlayerForm"
        >
          {{ t('common.cancel') }}
        </button>
      </div>

      <div class="space-y-3">
        <h3 class="px-2 text-xs font-black uppercase tracking-widest text-slate-500">
          {{ t('setup.currentRoster') }}
        </h3>
        <div
          v-if="store.players.length === 0"
          class="rounded-2xl border-2 border-dashed border-slate-800 p-8 text-center text-slate-600"
        >
          {{ t('setup.emptyPlayersHint') }}
        </div>
        <transition-group name="list" tag="ul" class="space-y-2">
          <li
            v-for="p in store.players"
            :key="p.id"
            class="group flex items-center justify-between rounded-2xl bg-slate-900/50 p-4 ring-1 ring-white/5 transition-all hover:bg-slate-800/80"
          >
            <div class="flex items-center gap-4">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-slate-700 to-slate-800 font-bold text-slate-400"
              >
                {{ p.name.charAt(0) }}
              </div>
              <div>
                <p class="font-bold text-white">{{ p.name }}</p>
                <p class="text-xs font-medium text-indigo-400/80">
                  {{ p.bey_name || t('setup.noBeyRecorded') }}
                </p>
              </div>
            </div>
            <div class="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button type="button" class="p-2 text-slate-400 hover:text-white" @click="editPlayer(p)">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
              <button type="button" class="p-2 text-slate-600 hover:text-red-400" @click="removePlayer(p.id)">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        </transition-group>
      </div>

      <details class="group rounded-2xl border border-slate-800 bg-slate-950 p-2 transition-all">
        <summary
          class="flex cursor-pointer items-center justify-between p-4 font-bold text-slate-400 group-open:text-white"
        >
          <span>{{ t('setup.playerLibraryTitle') }}</span>
          <span class="rounded-md bg-slate-800 px-2 py-1 text-xs">{{ libraryOptions.length }}</span>
        </summary>
        <div class="space-y-4 p-4 pt-0">
          <select
            v-model="selectedLibraryKeys"
            multiple
            class="min-h-32 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300"
          >
            <option v-for="p in libraryOptions" :key="libKey(p)" :value="libKey(p)">
              {{ p.name }} ({{ p.default_bey_name || t('setup.notAvailable') }})
            </option>
          </select>
          <button
            type="button"
            class="w-full rounded-xl border border-slate-700 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-20"
            :disabled="selectedLibraryPlayers.length === 0"
            @click="addSelectedFromLibrary"
          >
            {{ t('setup.importSelectedWarriors') }}
          </button>
        </div>
      </details>
    </section>

    <div
      class="fixed bottom-0 left-0 right-0 z-20 bg-linear-to-t from-slate-950 via-slate-950 to-transparent p-6 text-center sm:p-8"
    >
      <button
        type="button"
        class="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-bx-primary px-12 py-4 text-lg font-black uppercase italic tracking-tighter text-white shadow-2xl shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50"
        :disabled="!canSave"
        @click="save"
      >
        <span class="relative z-10">{{ t('setup.nextGoLobby') }}</span>
        <svg
          class="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
