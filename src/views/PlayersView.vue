<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTournamentStore } from '@/stores/tournament'
import PlayerManagerPanel from '@/components/PlayerManagerPanel.vue'

const { t } = useI18n()
const store = useTournamentStore()
store.hydrate()

const tournamentDisplayName = computed(
  () => store.tournamentName.trim() || t('home.unnamedBattle'),
)
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

    <PlayerManagerPanel
      :max-beys-per-player="store.maxBeysPerPlayer"
      :roster-title="`${t('setup.currentRoster')} · ${tournamentDisplayName}`"
      :empty-hint-text="t('players.noPlayersReady')"
    />
  </div>
</template>