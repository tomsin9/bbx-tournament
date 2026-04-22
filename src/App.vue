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
  <div
    class="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30"
  >
    <header
      class="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <RouterLink to="/" class="group flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded bg-linear-to-br from-indigo-600 to-blue-700 font-bold text-white shadow-lg shadow-indigo-500/20"
          >
            X
          </div>
          <span
            class="text-lg font-bold tracking-tighter text-white transition-colors group-hover:text-indigo-400"
          >
            {{ t('app.title') }}
          </span>
        </RouterLink>

        <nav class="flex items-center gap-1 sm:gap-4">
          <RouterLink
            to="/players"
            class="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white sm:block"
            active-class="bg-slate-800 text-white"
          >
            {{ t('nav.players') }}
          </RouterLink>

          <RouterLink
            to="/history"
            class="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white sm:block"
            active-class="bg-slate-800 text-white"
          >
            {{ t('nav.history') }}
          </RouterLink>

          <div class="relative">
            <select
              class="appearance-none rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :value="locale"
              @change="onLocale"
            >
              <option value="en">EN</option>
              <option value="zh">繁中</option>
            </select>
            <div
              class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"
            >
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                />
              </svg>
            </div>
          </div>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
