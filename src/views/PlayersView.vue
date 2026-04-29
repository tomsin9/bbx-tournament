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
const isLibraryCollapsedMobile = ref(false)
const libraryName = ref('')
const libraryCombosText = ref('')
const playerNameInput = ref<HTMLInputElement | null>(null)

const canAddPlayer = computed(() => playerName.value.trim().length > 0)
const libraryOptions = computed(() => store.playerLibrary)
const tournamentDisplayName = computed(
  () => store.tournamentName.trim() || t('home.unnamedBattle'),
)
const editingComboOptions = computed(() => {
  if (!editingId.value) return [] as string[]
  const participant = store.players.find((p) => p.id === editingId.value)
  if (!participant) return [] as string[]
  const profile = store.profileById(participant.player_id)
  if (!profile) return [] as string[]
  return profileComboOptions(profile)
})

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

function parseComboEditorText(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split('\n')) {
    const combo = raw.trim()
    if (!combo || seen.has(combo)) continue
    seen.add(combo)
    out.push(combo)
  }
  return out
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

function pickExistingCombo(combo: string) {
  playerBey.value = combo
}

function removePlayer(id: string) {
  if (!confirm(t('setup.removeConfirm'))) return
  store.removePlayer(id)
  if (editingId.value === id) resetPlayerForm()
}

function quickAddFromLibrary(profile: PlayerProfile) {
  if (isInRoster(profile.id)) return
  const defaultBey =
    (profile.default_bey_name ?? profile.bey_combos?.[0])?.trim() || undefined
  store.addPlayersFromLibrary([{ profile, bey_name: defaultBey }])
}

function startEditLibraryPlayer(id: string) {
  const profile = store.profileById(id)
  if (!profile) return
  libraryEditingId.value = id
  libraryName.value = profile.name
  libraryCombosText.value = profileComboOptions(profile).join('\n')
}

function cancelEditLibraryPlayer() {
  libraryEditingId.value = null
  libraryName.value = ''
  libraryCombosText.value = ''
}

function saveLibraryPlayer() {
  if (!libraryEditingId.value || !libraryName.value.trim()) return
  const combos = parseComboEditorText(libraryCombosText.value)
  store.updatePlayerProfile({
    id: libraryEditingId.value,
    name: libraryName.value,
    default_bey_name: combos[0] ?? undefined,
    bey_combos: combos,
  })
  cancelEditLibraryPlayer()
}

function removeLibraryPlayer(id: string) {
  if (!confirm(t('players.deleteLibraryConfirm'))) return
  store.deletePlayerProfile(id)
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
      <div class="text-right space-y-1.5">
        <p class="inline-flex max-w-[220px] items-center justify-end rounded-full border border-bx-primary/20 bg-slate-900/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {{ tournamentDisplayName }}
        </p>
        <p>
          <span class="text-3xl font-black italic text-bx-primary">{{ store.players.length }}</span>
          <span class="ml-1 text-xs font-bold uppercase text-slate-600">{{ t('players.registered') }}</span>
        </p>
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
            <div v-if="editingId && editingComboOptions.length" class="space-y-1">
              <p class="px-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                {{ t('players.libraryKnownCombos') }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="combo in editingComboOptions"
                  :key="'edit-combo-' + combo"
                  type="button"
                  class="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95"
                  :class="
                    playerBey.trim() === combo
                      ? 'border-bx-primary bg-bx-primary/15 text-bx-primary'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-bx-primary/40'
                  "
                  @click="pickExistingCombo(combo)"
                >
                  {{ combo }}
                </button>
              </div>
            </div>
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

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <section class="order-2 lg:order-2 lg:col-span-7 space-y-4">
        <div class="flex min-h-6 items-center justify-between px-2">
          <h3 class="leading-none text-[10px] font-black uppercase tracking-[0.3em] text-bx-primary">
            {{ t('setup.currentRoster') }} · {{ tournamentDisplayName }} ({{ store.players.length }})
          </h3>
          <span class="invisible px-2 py-0.5 rounded text-[10px] font-bold">{{ t('players.availableCount', { n: 0 }) }}</span>
        </div>

        <div class="h-[500px]">
          <div
            v-if="store.players.length === 0"
            class="flex h-full items-center justify-center rounded-3xl border-2 border-dashed border-slate-800 text-center"
          >
            <p class="font-bold italic uppercase tracking-widest text-slate-600">{{ t('players.noPlayersReady') }}</p>
          </div>

          <transition-group v-else name="list" tag="ul" class="grid h-full gap-2 overflow-y-scroll custom-scrollbar pr-1">
            <li
              v-for="p in store.players"
              :key="p.id"
              class="flex items-center justify-between rounded-2xl bg-slate-900 border border-white/5 p-4 transition-all"
            >
              <div class="flex items-center gap-4">
                <div
                  class="w-10 h-10 flex items-center justify-center rounded-xl bg-bx-primary/10 border border-bx-primary/20 text-bx-primary font-black italic"
                >
                  {{ p.name.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="font-black italic uppercase text-white leading-none">{{ p.name }}</p>
                  <p class="text-[10px] font-bold text-bx-accent mt-1 tracking-wider uppercase">
                    {{ p.bey_name || t('players.stockBey') }}
                  </p>
                  <p class="font-mono text-[10px] font-semibold tracking-wide text-slate-500">
                    {{ t('players.shortId', { id: shortPlayerIdSuffix(p.player_id) }) }}
                  </p>
                </div>
              </div>

              <div class="flex gap-2">
                <button type="button" class="p-2 text-slate-500 transition-colors hover:text-white" @click="editPlayer(p)">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2.828 2.828 0 114 4L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button type="button" class="p-2 text-slate-700 hover:text-red-500 transition-colors" @click="removePlayer(p.id)">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          </transition-group>
        </div>
      </section>

      <section v-if="libraryOptions.length > 0" class="order-1 lg:order-1 lg:col-span-5 space-y-4">
        <div class="flex min-h-6 items-center justify-between px-2">
          <h3 class="leading-none text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{{ t('setup.playerLibraryTitle') }}</h3>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-bold text-slate-600">{{ t('players.availableCount', { n: libraryOptions.length }) }}</span>
            <button
              type="button"
              class="lg:hidden p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-bx-primary hover:border-bx-primary/40 transition-colors"
              :aria-label="isLibraryCollapsedMobile ? t('common.expand') : t('common.collapse')"
              @click="isLibraryCollapsedMobile = !isLibraryCollapsedMobile"
            >
              <svg class="w-4 h-4 transition-transform" :class="isLibraryCollapsedMobile ? '' : 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="h-[500px] rounded-2xl border border-slate-800 bg-slate-950/30 p-2" :class="isLibraryCollapsedMobile ? 'hidden lg:block' : 'block'">
          <div class="h-full space-y-2 overflow-y-scroll custom-scrollbar pr-1">
            <div v-if="libraryEditingId" class="space-y-3 rounded-2xl border border-bx-primary/30 bg-bx-primary/5 p-3">
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-bx-primary">
                {{ t('players.editLibraryPlayer') }}
              </p>
              <div class="grid gap-2 sm:grid-cols-1">
                <input
                  v-model="libraryName"
                  type="text"
                  class="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-bx-primary focus:outline-none"
                  :placeholder="t('setup.playerName')"
                />
              </div>
              <div class="space-y-1">
                <label class="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {{ t('players.libraryComboEditor') }}
                </label>
                <textarea
                  v-model="libraryCombosText"
                  rows="4"
                  class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-700 focus:border-bx-primary focus:outline-none"
                  :placeholder="t('players.libraryComboEditorHint')"
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
          :class="isInRoster(p.id) ? 'border-slate-800 ring-white/5 opacity-40 grayscale' : 'border-slate-800 ring-white/5'"
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-black text-white">{{ p.name }}</p>
                  <p class="font-mono text-[10px] font-semibold text-slate-500">
                    {{ t('lobby.playerOptionShortId', { id: shortPlayerIdSuffix(p.id) }) }}
                  </p>
                  <p v-if="isInRoster(p.id)" class="mt-1 text-[10px] font-bold uppercase tracking-widest text-bx-primary/80">
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
                    class="rounded-md p-1.5 text-slate-600 transition-colors hover:text-red-500"
                    @click="removeLibraryPlayer(p.id)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button
                    v-if="!isInRoster(p.id)"
                    type="button"
                    class="p-2 rounded-lg bg-slate-800 text-bx-primary hover:bg-bx-primary hover:text-black transition-colors"
                    @click="quickAddFromLibrary(p)"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <p class="text-[10px] font-semibold text-slate-600">
                {{ t('players.libraryKnownCombos') }}: {{ libraryComboText(p) }}
              </p>
            </div>
          </div>
        </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(166, 255, 0, 0.58) rgba(15, 23, 42, 0.55);
  scrollbar-gutter: stable;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.55);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  border-radius: 9999px;
  background: rgba(166, 255, 0, 0.58);
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(166, 255, 0, 0.88);
}

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