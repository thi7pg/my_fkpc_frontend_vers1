import { ref } from 'vue'
import { translations } from './translations'

export const languages = [
  { code: 'en', label: 'English', intl: 'en-US' },
  { code: 'km', label: 'ខ្មែរ', intl: 'km-KH' },
  { code: 'ko', label: '한국어', intl: 'ko-KR' },
]
let saved = 'en'
try { saved = localStorage.getItem('language') || 'en' } catch { /* Use English. */ }
export const locale = ref(languages.some(language => language.code === saved) ? saved : 'en')
export function setLocale(code) {
  if (!languages.some(language => language.code === code)) return 
  locale.value = code
  localStorage.setItem('language', code)
  document.documentElement.lang = code
}
export function intlLocale() { return languages.find(language => language.code === locale.value).intl }
export function t(message, values = {}) {
  if (typeof message !== 'string') return message
  const key = message.charAt(0).toUpperCase() + message.slice(1)
  const translated = translations[locale.value]?.[message] ?? translations[locale.value]?.[key] ?? message
  return translated.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match)
}

export default {
  install(app) {
    app.config.globalProperties.$t = t
    document.documentElement.lang = locale.value
  },
}
