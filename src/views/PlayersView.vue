<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { TournamentParticipant } from '@/types/bxtm'
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'

const { t } = useI18n()
const store = useTournamentStore()
store.hydrate()

const playerName = ref('')
const playerBey = ref('')
const editingId = ref<string | null>(null)
const libraryEditingId = ref<string | null>(null)
const libraryName = ref('')
const libraryBey = ref('')
const selectedLibraryKeys = ref<string[]>([])
const playerNameInput = ref<HTMLInputElement | null>(null)

const canAddPlayer = computed(() => playerName.value.trim().length > 0)
const libraryOptions = computed(() =>
  store.playerLibrary.filter((p) => !store.players.some((cp) => cp.player_id === p.id)),
)
const selectedLibraryPlayers = computed(() => {
  const set = new Set(selectedLibraryKeys.value)
  return libraryOptions.value.filter((p) => set.has(libKey(p)))
})

function libKey(p: { id: string }) {
  return p.id
}

async function focusPlayerNameInput() {
  await nextTick()
  playerNameInput.value?.focus()
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

function toggleLibrarySelection(key: string) {
  const index = selectedLibraryKeys.value.indexOf(key)
  if (index === -1) {
    selectedLibraryKeys.value.push(key)
  } else {
    selectedLibraryKeys.value.splice(index, 1)
  }
}

function startEditLibraryPlayer(id: string) {
  const profile = store.profileById(id)
  if (!profile) return
  libraryEditingId.value = id
  libraryName.value = profile.name
  libraryBey.value = profile.default_bey_name ?? ''
}

function cancelEditLibraryPlayer() {
  libraryEditingId.value = null
  libraryName.value = ''
  libraryBey.value = ''
}

function saveLibraryPlayer() {
  if (!libraryEditingId.value || !libraryName.value.trim()) return
  store.updatePlayerProfile({
    id: libraryEditingId.value,
    name: libraryName.value,
    default_bey_name: libraryBey.value,
  })
  cancelEditLibraryPlayer()
}

function removeLibraryPlayer(id: string) {
  if (!confirm('Delete this library player from all tournaments?')) return
  store.deletePlayerProfile(id)
  selectedLibraryKeys.value = selectedLibraryKeys.value.filter((k) => k !== id)
  if (libraryEditingId.value === id) cancelEditLibraryPlayer()
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-10 pb-20">
    <header class="flex items-center justify-between">
      <div class="space-y-1">
        <h1 class="text-3xl font-black italic uppercase tracking-tighter text-white">
          {{ t('nav.players') }}
        </h1>
        <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Player Registry</p>
      </div>
      <div class="text-right">
        <span class="text-3xl font-black italic text-bx-primary">{{ store.players.length }}</span>
        <span class="ml-1 text-xs font-bold uppercase text-slate-600">Registered</span>
      </div>
    </header>

    <section class="group relative">
      <div class="absolute -inset-0.5 rounded-4xl bg-linear-to-r from-bx-primary/30 to-bx-accent/30 blur-sm opacity-50"></div>

      <div
        class="relative space-y-4 rounded-4xl bg-slate-950 p-6 ring-1 ring-white/10 transition-colors"
        :class="editingId ? 'bg-bx-primary/10 ring-bx-primary/30' : ''"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label class="px-2 text-[10px] font-black italic uppercase tracking-widest text-slate-500">Player Name</label>
            <input
              ref="playerNameInput"
              v-model="playerName"
              type="text"
              class="w-full rounded-xl border-2 border-slate-800 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-700 transition-all focus:border-bx-primary focus:outline-none"
              :placeholder="t('setup.playerName')"
              @keyup.enter="submitPlayer"
            />
          </div>
          <div class="space-y-1.5">
            <label class="px-2 text-[10px] font-black italic uppercase tracking-widest text-slate-500">Bey Name</label>
            <input
              v-model="playerBey"
              type="text"
              class="w-full rounded-xl border-2 border-slate-800 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-700 transition-all focus:border-bx-primary focus:outline-none"
              :placeholder="t('setup.playerBey')"
              @keyup.enter="submitPlayer"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl bg-bx-primary py-4 text-sm font-black uppercase italic tracking-widest text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:grayscale disabled:opacity-20"
            :disabled="!canAddPlayer"
            @click="submitPlayer"
          >
            {{ editingId ? 'Update Player' : 'Register Player' }}
          </button>
          <button
            v-if="editingId"
            type="button"
            class="rounded-xl border-2 border-slate-800 px-6 font-bold text-slate-400 hover:bg-slate-900"
            @click="resetPlayerForm"
          >
            ✕
          </button>
        </div>
      </div>
    </section>

    <section class="space-y-4">
      <h3 class="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
        {{ t('setup.currentRoster') }}
      </h3>

      <div
        v-if="store.players.length === 0"
        class="rounded-4xl border-2 border-dashed border-slate-800 py-12 text-center"
      >
        <p class="font-bold italic uppercase tracking-widest text-slate-600">No Players Ready</p>
      </div>

      <transition-group name="list" tag="ul" class="grid gap-2">
        <li
          v-for="p in store.players"
          :key="p.id"
          class="group flex items-center justify-between rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/5 transition-all hover:bg-slate-900/80 hover:ring-bx-primary/30"
        >
          <div class="flex items-center gap-4">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-bx-dark font-black italic text-bx-primary"
            >
              {{ p.name.charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="font-black italic uppercase tracking-tighter text-white">{{ p.name }}</p>
              <p class="text-[10px] font-bold uppercase tracking-widest text-bx-accent">
                {{ p.bey_name || 'Stock Bey' }}
              </p>
            </div>
          </div>

          <div class="flex gap-1">
            <button type="button" class="p-2 text-slate-500 transition-colors hover:text-white" @click="editPlayer(p)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.828 2.828 0 114 4L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button type="button" class="p-2 text-slate-700 transition-colors hover:text-bx-primary" @click="removePlayer(p.id)">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </li>
      </transition-group>
    </section>

    <section v-if="libraryOptions.length > 0" class="border-t border-slate-900 pt-6">
      <div class="mb-4 flex items-center justify-between px-2">
        <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Player Library</h3>
        <span class="text-[10px] font-bold text-slate-600">{{ libraryOptions.length }} Available</span>
      </div>

      <div v-if="libraryEditingId" class="mb-4 space-y-3 rounded-2xl border border-bx-primary/30 bg-bx-primary/5 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-bx-primary">Edit Library Player</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <input
            v-model="libraryName"
            type="text"
            class="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-bx-primary focus:outline-none"
            :placeholder="t('setup.playerName')"
          />
          <input
            v-model="libraryBey"
            type="text"
            class="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-bx-primary focus:outline-none"
            :placeholder="t('setup.playerBey')"
          />
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 rounded-xl bg-bx-primary py-2 text-xs font-black uppercase tracking-widest text-black disabled:opacity-30"
            :disabled="!libraryName.trim()"
            @click="saveLibraryPlayer"
          >
            Save Library Player
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-900"
            @click="cancelEditLibraryPlayer"
          >
            Cancel
          </button>
        </div>
      </div>

      <ul class="grid gap-2 sm:grid-cols-2">
        <li
          v-for="p in libraryOptions"
          :key="libKey(p)"
          class="flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-all"
          :class="
            selectedLibraryKeys.includes(libKey(p))
              ? 'border-bx-primary bg-bx-primary/10'
              : 'border-slate-800 bg-slate-900/50'
          "
        >
          <button
            type="button"
            class="flex-1 rounded-lg px-2 py-1 text-left text-xs font-bold transition-colors"
            :class="selectedLibraryKeys.includes(libKey(p)) ? 'text-bx-primary' : 'text-slate-300 hover:text-white'"
            @click="toggleLibrarySelection(libKey(p))"
          >
            <span class="block">{{ p.name }}</span>
            <span class="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {{ p.default_bey_name || t('setup.notAvailable') }}
            </span>
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-500 transition-colors hover:text-white"
            @click="startEditLibraryPlayer(p.id)"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.828 2.828 0 114 4L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-slate-600 transition-colors hover:text-bx-primary"
            @click="removeLibraryPlayer(p.id)"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </li>
      </ul>

      <button
        v-if="selectedLibraryKeys.length > 0"
        type="button"
        class="mt-6 w-full rounded-xl bg-bx-primary py-3 text-xs font-black uppercase italic tracking-widest text-black hover:brightness-110"
        @click="addSelectedFromLibrary"
      >
        Deploy {{ selectedLibraryKeys.length }} Selected Players
      </button>
    </section>
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