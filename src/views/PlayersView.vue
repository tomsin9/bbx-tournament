<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Combo, PlayerProfile, TournamentParticipant } from '@/types/bxtm'
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'
import { shortPlayerIdSuffix } from '@/utils/playerIdDisplay'
import BeySlotInput from '@/components/BeySlotInput.vue'

const { t } = useI18n()
const store = useTournamentStore()
store.hydrate()

const playerName = ref('')
const playerBeys = ref<string[]>([])
const editingId = ref<string | null>(null)
const saveAsNewCombo = ref(true)
const editingComboId = ref<string | null>(null)
const comboName = ref('')
const libraryEditingId = ref<string | null>(null)
const isLibraryCollapsedMobile = ref(false)
const playerNameInput = ref<HTMLInputElement | null>(null)

const canAddPlayer = computed(() => playerName.value.trim().length > 0)
const activeEditProfile = computed(() => {
  if (libraryEditingId.value) {
    return store.profileById(libraryEditingId.value) ?? null
  }
  if (!editingId.value) return null
  const participant = store.players.find((p) => p.id === editingId.value)
  if (!participant) return null
  return store.profileById(participant.player_id) ?? null
})
const isLibraryEditMode = computed(() => Boolean(libraryEditingId.value))
const slotCount = computed(() => {
  const configured = Number(store.maxBeysPerPlayer)
  const safeConfigured = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3
  const profileMax =
    activeEditProfile.value?.combos?.reduce((max, combo) => {
      return Math.max(max, combo.beys.length)
    }, 0) ?? 0
  return Math.max(1, safeConfigured, profileMax)
})
const libraryOptions = computed(() => store.playerLibrary)
const tournamentDisplayName = computed(
  () => store.tournamentName.trim() || t('home.unnamedBattle'),
)
const editingProfileCombos = computed(() => activeEditProfile.value?.combos ?? [])

function makeEmptySlots(count = slotCount.value): string[] {
  return Array.from({ length: count }, () => '')
}

function normalizeBeys(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const bey = raw.trim()
    if (!bey || seen.has(bey)) continue
    seen.add(bey)
    out.push(bey)
  }
  return out
}

function libKey(p: { id: string }) {
  return p.id
}

function isInRoster(profileId: string) {
  return store.players.some((p) => p.player_id === profileId)
}

function comboPartsFromText(text: string | undefined): string[] {
  return (text ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function playerComboParts(p: Pick<TournamentParticipant, 'beys' | 'bey_name'>): string[] {
  const fromBeys = p.beys?.map((item) => item.trim()).filter(Boolean) ?? []
  if (fromBeys.length > 0) return fromBeys
  return comboPartsFromText(p.bey_name)
}

function profilePreviewComboParts(
  p: Pick<PlayerProfile, 'combos' | 'default_bey_name'>,
): string[] {
  const fromCombo = p.combos?.[0]?.beys?.map((item) => item.trim()).filter(Boolean) ?? []
  if (fromCombo.length > 0) return fromCombo
  return comboPartsFromText(p.default_bey_name)
}

async function focusPlayerNameInput() {
  await nextTick()
  playerNameInput.value?.focus()
}

function resetPlayerForm() {
  playerName.value = ''
  playerBeys.value = makeEmptySlots()
  editingId.value = null
  libraryEditingId.value = null
  saveAsNewCombo.value = true
  editingComboId.value = null
  comboName.value = ''
  void focusPlayerNameInput()
}

function submitPlayer() {
  if (!canAddPlayer.value) return
  if (libraryEditingId.value) {
    const profile = store.profileById(libraryEditingId.value)
    if (!profile) return
    const beys = normalizeBeys(playerBeys.value)
    const now = new Date().toISOString()
    const base = [...(profile.combos ?? [])]
    const nextCombo: Combo = {
      id:
        saveAsNewCombo.value || !editingComboId.value
          ? `cb-${crypto.randomUUID().slice(0, 8)}`
          : editingComboId.value,
      beys,
      lastUsed: now,
      name: comboName.value.trim() || undefined,
    }
    const idx = saveAsNewCombo.value
      ? -1
      : base.findIndex((combo) => combo.id === editingComboId.value)
    const nextCombos = [...base]
    if (idx >= 0) nextCombos[idx] = nextCombo
    else nextCombos.unshift(nextCombo)
    store.updatePlayerProfile({
      id: libraryEditingId.value,
      name: playerName.value,
      combos: nextCombos,
    })
    resetPlayerForm()
    return
  }
  store.addOrUpdatePlayer({
    id: editingId.value ?? undefined,
    name: playerName.value,
    beys: normalizeBeys(playerBeys.value),
    comboName: saveAsNewCombo.value ? comboName.value : undefined,
    saveAsNewCombo: saveAsNewCombo.value,
    editingComboId: saveAsNewCombo.value ? undefined : editingComboId.value ?? undefined,
  })
  resetPlayerForm()
}

function editPlayer(player: TournamentParticipant) {
  libraryEditingId.value = null
  editingId.value = player.id
  playerName.value = player.name
  playerBeys.value = makeEmptySlots()
  const profile = store.profileById(player.player_id)
  const source = player.beys?.length
    ? player.beys
    : profile?.combos?.[0]?.beys?.length
    ? profile.combos[0]!.beys
    : (player.bey_name ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
  const parsed = Array.isArray(source) ? source : []
  parsed.forEach((bey, idx) => {
    if (idx < playerBeys.value.length) playerBeys.value[idx] = bey
  })
  const matched = profile?.combos?.find((combo) => combo.beys.join('|') === parsed.join('|'))
  editingComboId.value = matched?.id ?? null
  comboName.value = matched?.name ?? ''
  saveAsNewCombo.value = false
  void focusPlayerNameInput()
}

function comboLabel(combo: Combo): string {
  return combo.name?.trim() || combo.beys.join(', ')
}

function pickExistingComboObject(combo: Combo): void {
  playerBeys.value = makeEmptySlots()
  combo.beys.forEach((bey, idx) => {
    if (idx < playerBeys.value.length) playerBeys.value[idx] = bey
  })
  editingComboId.value = combo.id
  comboName.value = combo.name ?? ''
  saveAsNewCombo.value = false
}

function deleteEditingProfileCombo(combo: Combo): void {
  const profile = activeEditProfile.value
  if (!profile) return
  store.deletePlayerCombo(profile.id, combo.id)
  if (editingComboId.value === combo.id) {
    editingComboId.value = null
    saveAsNewCombo.value = true
    comboName.value = ''
    playerBeys.value = makeEmptySlots()
  }
}

function updatePlayerSlot(index: number, value: string): void {
  if (index < 0 || index >= playerBeys.value.length) return
  const next = [...playerBeys.value]
  next[index] = value
  playerBeys.value = next
}

function handleQuickPaste(raw: string, slotIndex: number): void {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return
  const next = [...playerBeys.value]
  for (let i = 0; i < parts.length; i += 1) {
    const target = slotIndex + i
    if (target >= next.length) break
    next[target] = parts[i]!
  }
  playerBeys.value = next
}

playerBeys.value = makeEmptySlots()

watch(slotCount, (next) => {
  const prev = playerBeys.value
  playerBeys.value = Array.from({ length: next }, (_, idx) => prev[idx] ?? '')
})

function removePlayer(id: string) {
  if (!confirm(t('setup.removeConfirm'))) return
  store.removePlayer(id)
  if (editingId.value === id) resetPlayerForm()
}

function quickAddFromLibrary(profile: PlayerProfile) {
  if (isInRoster(profile.id)) return
  const defaultBey =
    (profile.combos?.[0]?.beys?.[0] ?? profile.default_bey_name ?? profile.bey_combos?.[0])?.trim() ||
    undefined
  store.addPlayersFromLibrary([{ profile, bey_name: defaultBey }])
}

function startEditLibraryPlayer(id: string) {
  const profile = store.profileById(id)
  if (!profile) return
  libraryEditingId.value = id
  editingId.value = null
  playerName.value = profile.name
  playerBeys.value = makeEmptySlots()
  const picked = profile.combos?.[0]
  const parsed = picked?.beys ?? []
  parsed.forEach((bey, idx) => {
    if (idx < playerBeys.value.length) playerBeys.value[idx] = bey
  })
  editingComboId.value = picked?.id ?? null
  comboName.value = picked?.name ?? ''
  saveAsNewCombo.value = false
  void focusPlayerNameInput()
}

function removeLibraryPlayer(id: string) {
  if (!confirm(t('players.deleteLibraryConfirm'))) return
  store.deletePlayerProfile(id)
  if (libraryEditingId.value === id) resetPlayerForm()
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

    <section class="relative group">
      <div class="absolute -inset-0.5 rounded-3xl bg-linear-to-r from-bx-primary/40 to-bx-accent/40 blur opacity-30"></div>
      <div
        class="relative rounded-3xl bg-slate-950 p-5 ring-1 ring-white/10"
        :class="{ 'ring-bx-primary/50 bg-bx-primary/5': editingId || libraryEditingId }"
      >
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4">
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
            <div class="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <div
                v-for="(_, idx) in playerBeys"
                :key="'players-view-slot-' + idx"
                class="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5"
              >
                <p class="mb-1 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {{ t('setup.gearSlot', { n: idx + 1 }) }}
                </p>
                <BeySlotInput
                  :model-value="playerBeys[idx] ?? ''"
                  :slot-index="idx"
                  @update:model-value="(value) => updatePlayerSlot(idx, value)"
                  @quick-paste="handleQuickPaste"
                />
              </div>
            </div>
            <div v-if="(editingId || libraryEditingId) && editingProfileCombos.length" class="space-y-1">
              <p class="px-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                {{ t('players.libraryKnownCombos') }}
              </p>
              <div class="flex flex-wrap gap-1.5">
                <div
                  v-for="combo in editingProfileCombos"
                  :key="'edit-combo-' + combo.id"
                  class="flex items-center gap-1 rounded-full border px-1.5 py-1"
                  :class="
                    editingComboId === combo.id && !saveAsNewCombo
                      ? 'border-bx-primary bg-bx-primary/15'
                      : 'border-slate-700 bg-slate-900'
                  "
                >
                  <button
                    type="button"
                    class="px-1 text-[10px] font-black uppercase tracking-wide transition-all active:scale-95"
                    :class="
                      editingComboId === combo.id && !saveAsNewCombo
                        ? 'text-bx-primary'
                        : 'text-slate-300 hover:text-bx-primary'
                    "
                    @click="pickExistingComboObject(combo)"
                  >
                    {{ comboLabel(combo) }}
                  </button>
                  <button
                    type="button"
                    class="rounded-full border border-slate-700 px-1.5 py-0.5 text-[10px] font-black text-slate-400 transition-colors hover:border-red-400/50 hover:text-red-300"
                    @click="deleteEditingProfileCombo(combo)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div class="w-full max-w-md space-y-2">
            <label class="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <input v-model="saveAsNewCombo" type="checkbox" class="h-4 w-4 accent-bx-primary" />
              {{ t('setup.saveAsNewCombo') }}
            </label>
            <input
              v-if="saveAsNewCombo || !editingComboId"
              v-model="comboName"
              type="text"
              class="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-bx-primary focus:outline-none"
              :placeholder="t('setup.comboNameOptional')"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-xl bg-bx-primary px-6 py-4 text-sm font-black uppercase italic tracking-widest text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:grayscale disabled:opacity-20"
              :disabled="!canAddPlayer"
              @click="submitPlayer"
            >
              {{
                isLibraryEditMode
                  ? t('players.saveLibraryPlayer')
                  : editingId
                    ? t('setup.updatePlayer')
                    : t('players.registerPlayer')
              }}
            </button>
            <button
              v-if="editingId || libraryEditingId"
              type="button"
              class="rounded-xl border-2 border-slate-800 px-6 font-bold text-slate-400 hover:bg-slate-900"
              @click="resetPlayerForm"
            >
              ✕
            </button>
          </div>
        </div>
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
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="(part, idx) in playerComboParts(p)"
                      :key="'roster-combo-' + p.id + '-' + idx"
                      class="rounded-full border border-bx-accent/40 bg-bx-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-bx-accent"
                    >
                      {{ part }}
                    </span>
                    <span
                      v-if="playerComboParts(p).length === 0"
                      class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                    >
                      {{ t('players.stockBey') }}
                    </span>
                  </div>
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
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12a8 8 0 11-16 0 8 8 0 0116 0zM8 12h8" />
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

              <div class="space-y-1">
                <p class="text-[10px] font-semibold text-slate-600">
                  {{ t('players.libraryKnownCombos') }}
                </p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="(part, idx) in profilePreviewComboParts(p)"
                    :key="'lib-combo-preview-' + p.id + '-' + idx"
                    class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-300"
                  >
                    {{ part }}
                  </span>
                  <span
                    v-if="profilePreviewComboParts(p).length === 0"
                    class="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    {{ t('setup.notAvailable') }}
                  </span>
                </div>
              </div>
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