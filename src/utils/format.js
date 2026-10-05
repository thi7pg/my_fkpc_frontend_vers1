export function formatCurrency(amount, currency = 'USD') {
  const value = Number(amount) || 0
  try {
    return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function formatDateTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(intlLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(intlLocale(), { timeStyle: 'short' }).format(new Date(value))
}

export function minutesSince(value) {
  if (!value) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000))
}
import { intlLocale } from '../i18n'
