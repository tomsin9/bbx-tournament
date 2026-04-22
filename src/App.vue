<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView } from 'vue-router'
import type { LocaleId } from '@/i18n'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()

function onLocale(e: Event) {
  const v = (e.target as HTMLSelectElement).value as LocaleId
  setLocale(v)
  locale.value = v
}
</script>

<template>
  <div class="min-h-dvh flex flex-col">
    <header
      class="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur"
    >
      <div
        class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <RouterLink
          to="/"
          class="text-lg font-semibold tracking-tight text-white hover:text-indigo-200"
        >
          {{ t('app.title') }}
        </RouterLink>
        <nav class="flex flex-wrap items-center gap-2 text-sm">
          <RouterLink
            to="/"
            class="rounded-lg px-3 py-2 font-medium text-slate-300 hover:bg-slate-800"
            active-class="bg-[#2e21de] text-white"
          >
            {{ t('nav.home') }}
          </RouterLink>
          <RouterLink
            to="/setup"
            class="rounded-lg px-3 py-2 font-medium text-slate-300 hover:bg-slate-800"
            active-class="bg-[#2e21de] text-white"
          >
            {{ t('nav.setup') }}
          </RouterLink>
          <RouterLink
            to="/setup"
            class="rounded-lg px-3 py-2 font-medium text-slate-300 hover:bg-slate-800"
            active-class="bg-[#2e21de] text-white"
          >
            {{ t('nav.players') }}
          </RouterLink>
          <RouterLink
            to="/lobby"
            class="rounded-lg px-3 py-2 font-medium text-slate-300 hover:bg-slate-800"
            active-class="bg-[#2e21de] text-white"
          >
            {{ t('nav.lobby') }}
          </RouterLink>
          <RouterLink
            to="/history"
            class="rounded-lg px-3 py-2 font-medium text-slate-300 hover:bg-slate-800"
            active-class="bg-[#2e21de] text-white"
          >
            {{ t('nav.history') }}
          </RouterLink>
          <label class="ml-2 flex items-center gap-2 text-slate-400">
            <span class="sr-only">{{ t('common.language') }}</span>
            <select
              class="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
              :value="locale"
              @change="onLocale"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
        </nav>
      </div>
    </header>
    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
