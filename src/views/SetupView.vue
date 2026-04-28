<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type {
  BattleFormat,
  PlayerProfile,
  StadiumType,
  TournamentFormat,
  TournamentParticipant,
} from '@/types/bxtm'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import { shortPlayerIdSuffix } from '@/utils/playerIdDisplay'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useTournamentStore()
store.hydrate()

const isNewSetup = computed(() => route.query.mode === 'new')
const name = ref(store.tournamentName || '')
const target = ref(store.targetPoints)
const battleFormat = ref<BattleFormat>(store.battleFormat)
const tournamentFormat = ref<TournamentFormat>(store.tournamentFormat)
const playoffEnabled = ref(store.playoffEnabled)
const playoffThirdPlace = ref(store.playoffThirdPlace)
const stadiumType = ref<StadiumType>(store.stadiumType)
const draftPlayers = ref<TournamentParticipant[]>([])
const playerName = ref('')
const playerBey = ref('')
const editingId = ref<string | null>(null)
const libraryEditingId = ref<string | null>(null)
const libraryName = ref('')
const libraryBey = ref('')
const librarySelectedProfileIds = ref<string[]>([])
const libraryComboPick = ref<Record<string, string>>({})
const libraryCustomCombo = ref<Record<string, string>>({})
const activeTab = ref<'rules' | 'players'>('rules')
const playerNameInput = ref<HTMLInputElement | null>(null)
const rosterPlayers = computed(() => (isNewSetup.value ? draftPlayers.value : store.players))

const canSave = computed(
  () => name.value.trim().length > 0 && rosterPlayers.value.length >= 2,
)
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

onMounted(() => {
  if (isNewSetup.value) {
    name.value = ''
    target.value = 4
    battleFormat.value = 'singles'
    tournamentFormat.value = 'free'
    playoffEnabled.value = false
    playoffThirdPlace.value = true
    stadiumType.value = 'xtreme_standard'
    draftPlayers.value = []
    return
  }
  name.value = store.tournamentName
  target.value = store.targetPoints
  battleFormat.value = store.battleFormat
  tournamentFormat.value = store.tournamentFormat
  playoffEnabled.value = store.playoffEnabled
  playoffThirdPlace.value = store.playoffThirdPlace
  stadiumType.value = store.stadiumType
})

watch(tournamentFormat, (next) => {
  if (next !== 'round_robin') {
    playoffEnabled.value = false
    playoffThirdPlace.value = true
  }
})

function libKey(p: { id: string }) {
  return p.id
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

function isInRoster(profileId: string) {
  return rosterPlayers.value.some((p) => p.player_id === profileId)
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

function resetPlayerForm() {
  playerName.value = ''
  playerBey.value = ''
  editingId.value = null
  void focusPlayerNameInput()
}

function submitPlayer() {
  if (!canAddPlayer.value) return
  if (isNewSetup.value) {
    const nameValue = playerName.value.trim()
    if (!nameValue) return
    const bey = playerBey.value.trim() || undefined
    const today = new Date().toISOString().slice(0, 10)
    const id = editingId.value ?? `tp-${crypto.randomUUID().slice(0, 8)}`
    const existing = draftPlayers.value.find((p) => p.id === id)
    const player_id = existing?.player_id ?? `pl-${crypto.randomUUID().slice(0, 8)}`
    const next = [...draftPlayers.value]
    const idx = next.findIndex((p) => p.id === id)
    const row: TournamentParticipant = { id, player_id, name: nameValue, bey_name: bey, created_at: today }
    if (idx >= 0) next[idx] = row
    else next.push(row)
    draftPlayers.value = next
    resetPlayerForm()
    return
  }
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
  if (isNewSetup.value) {
    draftPlayers.value = draftPlayers.value.filter((p) => p.id !== id)
    if (editingId.value === id) resetPlayerForm()
    return
  }
  store.removePlayer(id)
  if (editingId.value === id) resetPlayerForm()
}

function addSelectedFromLibrary() {
  if (!canDeployLibrary.value) return
  if (isNewSetup.value) {
    const today = new Date().toISOString().slice(0, 10)
    const next = [...draftPlayers.value]
    for (const row of libraryDeployRows.value) {
      next.push({
        id: `tp-${crypto.randomUUID().slice(0, 8)}`,
        player_id: row.profile.id,
        name: row.profile.name,
        bey_name: row.bey_name,
        created_at: row.profile.created_at ?? today,
      })
    }
    draftPlayers.value = next
    librarySelectedProfileIds.value = []
    libraryComboPick.value = {}
    libraryCustomCombo.value = {}
    return
  }
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
  if (isNewSetup.value) {
    store.newTournament()
  }
  store.applySetup({
    tournamentName: name.value,
    targetPoints: target.value,
    battleFormat: battleFormat.value,
    tournamentFormat: tournamentFormat.value,
    playoffEnabled: playoffEnabled.value,
    playoffThirdPlace: playoffThirdPlace.value,
    stadiumType: stadiumType.value,
    players: rosterPlayers.value,
  })
  store.buildInitialScheduledMatches()
  void router.push('/lobby')
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-8 pb-32">
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
            ? 'scale-[1.02] bg-bx-primary text-black shadow-lg shadow-bx-primary/20'
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
            ? 'scale-[1.02] bg-bx-primary text-black shadow-lg shadow-bx-primary/20'
            : 'text-slate-500 hover:text-slate-300'
        "
        @click="activeTab = 'players'"
      >
        {{ t('setup.tabPlayers') }}
        <span class="ml-1 opacity-50">({{ rosterPlayers.length }})</span>
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

      <div class="group space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-slate-500 transition-colors group-focus-within:text-bx-primary">
          {{ t('setup.tournamentFormat') }}
        </label>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            class="rounded-xl border px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all"
            :class="
              tournamentFormat === 'free'
                ? 'border-bx-primary bg-bx-primary text-black'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-bx-primary/60'
            "
            @click="tournamentFormat = 'free'"
          >
            {{ t('setup.tournamentFormatFree') }}
          </button>
          <button
            type="button"
            class="rounded-xl border px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all"
            :class="
              tournamentFormat === 'round_robin'
                ? 'border-bx-primary bg-bx-primary text-black'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-bx-primary/60'
            "
            @click="tournamentFormat = 'round_robin'"
          >
            {{ t('setup.tournamentFormatRoundRobin') }}
          </button>
          <button
            type="button"
            class="rounded-xl border px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all"
            :class="
              tournamentFormat === 'single_elimination'
                ? 'border-bx-primary bg-bx-primary text-black'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-bx-primary/60'
            "
            @click="tournamentFormat = 'single_elimination'"
          >
            {{ t('setup.tournamentFormatSingleElimination') }}
          </button>
        </div>
      </div>

      <div v-if="tournamentFormat === 'round_robin'" class="group space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <label class="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-300">
          <input v-model="playoffEnabled" type="checkbox" class="h-4 w-4 accent-bx-primary" />
          {{ t('setup.top4Playoff') }}
        </label>
        <label class="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-500" :class="playoffEnabled ? 'text-slate-300' : 'opacity-50'">
          <input v-model="playoffThirdPlace" type="checkbox" class="h-4 w-4 accent-bx-primary" :disabled="!playoffEnabled" />
          {{ t('setup.thirdPlaceMatch') }}
        </label>
      </div>

      <div class="group space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-slate-500 transition-colors group-focus-within:text-bx-primary">
          {{ t('setup.format') }}
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all"
            :class="
              battleFormat === 'singles'
                ? 'border-bx-primary bg-bx-primary text-black'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-bx-primary/60'
            "
            @click="battleFormat = 'singles'"
          >
            {{ t('setup.formatSingles') }}
          </button>
          <button
            type="button"
            class="rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-widest transition-all"
            :class="
              battleFormat === 'doubles'
                ? 'border-bx-primary bg-bx-primary text-black'
                : 'border-slate-700 bg-slate-900 text-slate-500 opacity-50'
            "
            disabled
            @click="battleFormat = 'doubles'"
          >
            {{ t('setup.formatDoubles') }}
          </button>
        </div>
      </div>

      <div class="group space-y-2">
        <label class="text-xs font-black uppercase tracking-widest text-slate-500 transition-colors group-focus-within:text-bx-primary">
          {{ t('setup.stadium') }}
        </label>
        <select
          v-model="stadiumType"
          class="w-full rounded-2xl border-2 border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 transition-all focus:border-bx-primary focus:outline-none"
        >
          <option value="xtreme_standard">{{ t('setup.stadiumXtremeStandard') }}</option>
          <option value="infinity">{{ t('setup.stadiumInfinity') }}</option>
          <option value="electric">{{ t('setup.stadiumElectric') }}</option>
          <option value="three_player">{{ t('setup.stadiumThreePlayer') }}</option>
          <option value="custom">{{ t('setup.stadiumCustom') }}</option>
        </select>
      </div>
    </section>

    <section v-else class="space-y-10">
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
              {{ editingId ? t('setup.updatePlayer') : t('setup.addToRoster') }}
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
          v-if="rosterPlayers.length === 0"
          class="rounded-4xl border-2 border-dashed border-slate-800 py-12 text-center"
        >
          <p class="font-bold italic uppercase tracking-widest text-slate-600">{{ t('players.noPlayersReady') }}</p>
          <p class="mt-2 px-6 text-xs text-slate-600">{{ t('setup.emptyPlayersHint') }}</p>
        </div>

        <transition-group name="list" tag="ul" class="grid gap-2">
          <li
            v-for="p in rosterPlayers"
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
          {{ t('setup.importSelectedWarriors', { n: libraryDeployRows.length }) }}
        </button>
      </section>
    </section>

    <div
      class="fixed bottom-0 left-0 right-0 z-20 bg-linear-to-t from-slate-950 via-slate-950 to-transparent p-6 text-center sm:p-8"
    >
      <p v-if="name.trim().length > 0 && rosterPlayers.length < 2" class="mb-3 text-xs font-bold text-bx-primary">
        {{ t('setup.needTwoPlayers') }}
      </p>
      <button
        type="button"
        class="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-bx-primary px-12 py-4 text-lg font-black uppercase italic tracking-tighter text-black shadow-2xl shadow-bx-primary/40 transition-all hover:scale-105 active:scale-95 disabled:grayscale disabled:opacity-50"
        :disabled="!canSave"
        @click="save"
      >
        <span class="relative z-10">
          {{ isNewSetup ? t('setup.nextGoLobby') : t('setup.saveGoLobby') }}
        </span>
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
