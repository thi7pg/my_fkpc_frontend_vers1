export const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']

export const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_STYLES = {
  pending: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10',
  confirmed: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10',
  preparing: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10',
  ready: 'bg-success-50 text-success-600 dark:bg-success-500/10',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  cancelled: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10',
}

export function nextStatus(status) {
  const flow = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' }
  return flow[status] ?? null
}
