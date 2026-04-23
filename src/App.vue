<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView } from 'vue-router'
import type { LocaleId } from '@/i18n'
import { setLocale } from '@/i18n'
import { useTournamentStore } from '@/stores/tournament'
import { APP_VERSION } from '@/types/bxtm'

const { t, locale } = useI18n()
const store = useTournamentStore()
store.hydrate()
const mobileMenuOpen = ref(false)
const infoModalOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)

function onLocale(e: Event) {
  const v = (e.target as HTMLSelectElement).value as LocaleId
  setLocale(v)
  locale.value = v
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function openInfoModal() {
  importError.value = null
  infoModalOpen.value = true
}

function closeInfoModal() {
  infoModalOpen.value = false
}

function triggerImport() {
  importError.value = null
  fileInput.value?.click()
}

function triggerExport() {
  const json = store.exportJsonText()
  const safeName = (store.tournamentName || 'bbx-tournament')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${safeName || 'bbx-tournament'}-${date}.json`
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!confirm(t('common.replaceDataBody'))) return
  try {
    const text = await file.text()
    store.importJsonText(text)
    importError.value = null
  } catch (err) {
    importError.value = err instanceof Error ? err.message : t('common.importFailed')
  }
}
</script>

<template>
  <div
    class="min-h-dvh flex flex-col bg-bx-dark text-slate-100 selection:bg-bx-primary/30 selection:text-black"
  >
    <header
      class="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md"
    >
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <RouterLink to="/" class="navbar-logo-link group flex items-center gap-2">
          <div
            class="flex h-7 w-7 text-lg items-center justify-center rounded-lg bg-bx-primary font-bold font-sans text-black shadow-lg shadow-bx-primary/20"
          >
            B
          </div>
          <img
            src="/beybladex-logo.png"
            :alt="t('app.title')"
            class="h-8 w-auto max-w-24 md:max-w-32 object-contain transition-opacity group-hover:opacity-90 sm:h-10"
          />
        </RouterLink>

        <nav class="relative flex items-center gap-1 sm:gap-4">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-800 hover:text-white sm:hidden"
            :aria-label="mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'"
            :aria-expanded="mobileMenuOpen"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <svg
              v-if="!mobileMenuOpen"
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg
              v-else
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>

          <div
            v-if="mobileMenuOpen"
            class="absolute right-0 top-11 z-50 flex min-w-36 flex-col gap-1 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-lg sm:hidden"
          >
            <RouterLink
              to="/players"
              class="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              active-class="bg-slate-800 text-white"
              @click="closeMobileMenu"
            >
              {{ t('nav.players') }}
            </RouterLink>

            <RouterLink
              to="/history"
              class="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              active-class="bg-slate-800 text-white"
              @click="closeMobileMenu"
            >
              {{ t('nav.history') }}
            </RouterLink>
          </div>

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

          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            :aria-label="t('app.infoLabel')"
            @click="openInfoModal"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          <div class="relative">
            <select
              class="appearance-none rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 text-xs font-medium text-slate-300 focus:outline-none focus:ring-2 focus:ring-bx-primary"
              :value="locale"
              @change="onLocale"
            >
              <option value="en">EN</option>
              <option value="zh">ZH</option>
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

    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFile"
    />

    <div
      v-if="infoModalOpen"
      class="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4"
      @click.self="closeInfoModal"
    >
      <div class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-white">{{ t('app.infoTitle') }}</h2>
            <p class="mt-1 text-sm text-slate-400">{{ t('app.infoSubtitle') }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
            :aria-label="t('common.cancel')"
            @click="closeInfoModal"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <section class="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p class="text-sm font-semibold text-white">{{ t('app.aboutTitle') }}</p>
          <p class="mt-2 text-sm text-slate-300">{{ t('app.versionLabel') }}: v{{ APP_VERSION }}</p>
          <p class="mt-1 text-sm text-slate-300">{{ t('app.publishDateLabel') }}: {{ t('app.publishDateValue') }}</p>
          <p class="mt-1 text-sm text-slate-400">
            {{ t('app.license') }}
          </p>
        </section>

        <section class="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p class="text-sm font-semibold text-white">{{ t('app.dataToolsTitle') }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ t('home.importHint') }}</p>
          <div class="mt-3 flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              @click="triggerImport"
            >
              {{ t('home.import') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
              @click="triggerExport"
            >
              {{ t('history.export') }}
            </button>
          </div>
          <p v-if="importError" class="mt-2 text-xs text-bx-primary" role="alert">
            {{ t('common.importFailed') }}: {{ importError }}
          </p>
        </section>
      </div>
    </div>
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
