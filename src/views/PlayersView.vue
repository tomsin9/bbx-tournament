<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { PlayerProfile, TournamentParticipant } from '@/types/bxtm'
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'
import { shortPlayerIdSuffix } from '@/utils/playerIdDisplay'

const { t } = useI18n()
const store = useTournamentStore()
store.hydrate()

const playerName = ref('')
const playerBey = ref('')
const editingId = ref<string | null>(null)
const libraryEditingId = ref<string | null>(null)
const libraryName = ref('')
const libraryBey = ref('')
const librarySelectedProfileIds = ref<string[]>([])
const libraryComboPick = ref<Record<string, string>>({})
const libraryCustomCombo = ref<Record<string, string>>({})
const playerNameInput = ref<HTMLInputElement | null>(null)

const canAddPlayer = computed(() => playerName.value.trim().length > 0)
const libraryOptions = computed(() => store.playerLibrary)
const libraryDeployRows = computed(() => {
  const set = new Set(librarySelectedProfileIds.value)
  return libraryOptions.value
    .filter((p) => set.has(libKey(p)) && !isInRoster(p.id))
    .map((p) => {
      const custom = libraryCustomCombo.value[p.id]?.trim() ?? ''
      const pick = libraryComboPick.value[p.id]?.trim() ?? ''
      const fallback = profileComboOptions(p)[0] ?? ''
      const bey_name = custom || pick || fallback || undefined
      return { profile: p, bey_name }
    })
})
const canDeployLibrary = computed(() => libraryDeployRows.value.length > 0)

function libKey(p: { id: string }) {
  return p.id
}

function isInRoster(profileId: string) {
  return store.players.some((p) => p.player_id === profileId)
}

function libraryComboText(p: Pick<PlayerProfile, 'default_bey_name' | 'bey_combos'>) {
  const combos = profileComboOptions(p)
  if (combos.length > 0) return combos.join(' / ')
  return p.default_bey_name || t('setup.notAvailable')
}

function profileComboOptions(p: Pick<PlayerProfile, 'default_bey_name' | 'bey_combos'>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...(p.bey_combos ?? []), p.default_bey_name]) {
    const c = raw?.trim()
    if (!c || seen.has(c)) continue
    seen.add(c)
    out.push(c)
  }
  return out
}

function ensureDefaultComboPick(profileId: string, p: PlayerProfile) {
  if (libraryComboPick.value[profileId]) return
  const first = profileComboOptions(p)[0]
  if (first) {
    libraryComboPick.value = { ...libraryComboPick.value, [profileId]: first }
  }
}

function toggleLibraryProfile(profileId: string, p: PlayerProfile, checked: boolean) {
  if (isInRoster(profileId)) return
  if (checked) {
    if (!librarySelectedProfileIds.value.includes(profileId)) {
      librarySelectedProfileIds.value = [...librarySelectedProfileIds.value, profileId]
    }
    ensureDefaultComboPick(profileId, p)
    return
  }
  const next = librarySelectedProfileIds.value.filter((id) => id !== profileId)
  librarySelectedProfileIds.value = next
  const { [profileId]: _dropPick, ...restPick } = libraryComboPick.value
  const { [profileId]: _dropCustom, ...restCustom } = libraryCustomCombo.value
  libraryComboPick.value = restPick
  libraryCustomCombo.value = restCustom
}

function setLibraryComboPick(profileId: string, combo: string) {
  libraryComboPick.value = { ...libraryComboPick.value, [profileId]: combo }
}

function isComboSelected(profileId: string, combo: string) {
  const custom = libraryCustomCombo.value[profileId]?.trim()
  if (custom) return false
  const pick = libraryComboPick.value[profileId]?.trim()
  return pick === combo
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
  if (!canDeployLibrary.value) return
  store.addPlayersFromLibrary(libraryDeployRows.value)
  librarySelectedProfileIds.value = []
  libraryComboPick.value = {}
  libraryCustomCombo.value = {}
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
  if (!confirm(t('players.deleteLibraryConfirm'))) return
  store.deletePlayerProfile(id)
  librarySelectedProfileIds.value = librarySelectedProfileIds.value.filter((k) => k !== id)
  const { [id]: _p, ...restPick } = libraryComboPick.value
  const { [id]: _c, ...restCustom } = libraryCustomCombo.value
  libraryComboPick.value = restPick
  libraryCustomCombo.value = restCustom
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
        <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {{ t('players.registry') }}
        </p>
      </div>
      <div class="text-right">
        <span class="text-3xl font-black italic text-bx-primary">{{ store.players.length }}</span>
        <span class="ml-1 text-xs font-bold uppercase text-slate-600">{{ t('players.registered') }}</span>
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
            <label class="px-2 text-[10px] font-black italic uppercase tracking-widest text-slate-500">{{ t('setup.playerName') }}</label>
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
            <label class="px-2 text-[10px] font-black italic uppercase tracking-widest text-slate-500">{{ t('setup.playerBey') }}</label>
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
            {{ editingId ? t('setup.updatePlayer') : t('players.registerPlayer') }}
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
        <p class="font-bold italic uppercase tracking-widest text-slate-600">{{ t('players.noPlayersReady') }}</p>
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
                {{ p.bey_name || t('players.stockBey') }}
              </p>
              <p class="font-mono text-[10px] font-semibold tracking-wide text-slate-500">
                {{ t('players.shortId', { id: shortPlayerIdSuffix(p.player_id) }) }}
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
      <div class="mb-4 flex flex-col gap-2 px-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{{ t('setup.playerLibraryTitle') }}</h3>
          <p class="text-[10px] font-bold text-slate-600">{{ t('players.libraryPickHint') }}</p>
        </div>
        <span class="text-[10px] font-bold text-slate-600">
          {{ t('players.availableCount', { n: libraryOptions.length }) }}
        </span>
      </div>

      <div v-if="libraryEditingId" class="mb-4 space-y-3 rounded-2xl border border-bx-primary/30 bg-bx-primary/5 p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-bx-primary">
          {{ t('players.editLibraryPlayer') }}
        </p>
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
            {{ t('players.saveLibraryPlayer') }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-900"
            @click="cancelEditLibraryPlayer"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>

      <ul class="grid gap-3 sm:grid-cols-1">
        <li
          v-for="p in libraryOptions"
          :key="libKey(p)"
          class="rounded-2xl border bg-slate-950/40 p-3 ring-1 transition-all"
          :class="
            librarySelectedProfileIds.includes(libKey(p))
              ? 'border-bx-primary/40 bg-bx-primary/5 ring-bx-primary/25'
              : 'border-slate-800 ring-white/5'
          "
        >
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              class="mt-1 h-4 w-4 accent-bx-primary"
              :checked="librarySelectedProfileIds.includes(libKey(p))"
              :disabled="isInRoster(p.id)"
              @change="
                toggleLibraryProfile(libKey(p), p, ($event.target as HTMLInputElement).checked)
              "
            />

            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-black text-white">{{ p.name }}</p>
                  <p class="font-mono text-[10px] font-semibold text-slate-500">
                    {{ t('lobby.playerOptionShortId', { id: shortPlayerIdSuffix(p.id) }) }}
                  </p>
                  <p v-if="isInRoster(p.id)" class="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {{ t('common.inRoster') }}
                  </p>
                </div>

                <div class="flex shrink-0 gap-1">
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
                </div>
              </div>

              <div v-if="librarySelectedProfileIds.includes(libKey(p)) && !isInRoster(p.id)" class="space-y-2">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">{{ t('players.libraryComboLabel') }}</p>

                <div v-if="profileComboOptions(p).length" class="flex flex-wrap gap-1.5">
                  <button
                    v-for="c in profileComboOptions(p)"
                    :key="libKey(p) + '-' + c"
                    type="button"
                    class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95"
                    :class="
                      isComboSelected(p.id, c)
                        ? 'border-bx-primary bg-bx-primary/15 text-bx-primary'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-bx-primary/40'
                    "
                    @click="setLibraryComboPick(p.id, c)"
                  >
                    {{ c }}
                  </button>
                </div>
                <p v-else class="text-[10px] font-bold text-slate-600">{{ t('players.libraryNoCombos') }}</p>

                <div class="space-y-1">
                  <label class="block text-[10px] font-black uppercase tracking-widest text-slate-600">
                    {{ t('players.libraryCustomCombo') }}
                  </label>
                  <input
                    v-model="libraryCustomCombo[p.id]"
                    type="text"
                    class="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-700 focus:border-bx-primary focus:outline-none"
                    :placeholder="t('setup.playerBey')"
                  />
                  <p class="text-[10px] text-slate-600">{{ t('players.libraryCustomComboHint') }}</p>
                </div>
              </div>

              <p v-else class="text-[10px] font-semibold text-slate-600">
                {{ t('players.libraryKnownCombos') }}: {{ libraryComboText(p) }}
              </p>
            </div>
          </div>
        </li>
      </ul>

      <button
        v-if="librarySelectedProfileIds.length > 0"
        type="button"
        class="mt-6 w-full rounded-xl bg-bx-primary py-3 text-xs font-black uppercase italic tracking-widest text-black hover:brightness-110 disabled:opacity-30"
        :disabled="!canDeployLibrary"
        @click="addSelectedFromLibrary"
      >
        {{ t('players.deploySelectedPlayers', { n: libraryDeployRows.length }) }}
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