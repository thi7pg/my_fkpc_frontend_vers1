import { t, locale } from '../languages'

const METRIC_LABELS = {
  'Total revenue': 'Total Revenue',
  'Total orders': 'Total Orders',
  'Total invoices': 'Total Invoices',
  'Paid orders': 'Orders Paid',
  'Completed orders': 'Completed',
  'Cancelled orders': 'Cancelled orders',
}

export function localizedMetric(label) {
  return locale.value === 'en' ? label : t(METRIC_LABELS[label] || label)
}

export function reportGroupingLabel(grouping) {
  return t({ month: 'By month', week: 'By week', day: 'By day' }[grouping] || 'By day')
}
