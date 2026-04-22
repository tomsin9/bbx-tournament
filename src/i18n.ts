import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import zh from '@/locales/zh.json'

export const LOCALE_STORAGE_KEY = 'bxtm_locale'

export type LocaleId = 'en' | 'zh'

const saved =
  typeof localStorage !== 'undefined'
    ? (localStorage.getItem(LOCALE_STORAGE_KEY) as LocaleId | null)
    : null
const fallbackLocale: LocaleId = saved === 'zh' || saved === 'en' ? saved : 'en'

export const i18n = createI18n({
  legacy: false,
  locale: fallbackLocale,
  fallbackLocale: 'en',
  messages: { en, zh },
})

export function setLocale(locale: LocaleId) {
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}
