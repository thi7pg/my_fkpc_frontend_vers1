<script setup>
import KitchenOrderItems from '../../components/staff/KitchenOrderItems.vue'
import { t } from '../../languages'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { kitchenService } from '../../services/kitchenService'
import { orderService } from '../../services/orderService'
import { minutesSince, formatTime, formatDateTime } from '../../utils/format'

const detailDialog = ref(null)
const selectedOrder = ref(null)
function viewDetails(order) {
  selectedOrder.value = order
  detailDialog.value.showModal()
}
const toast = useToast()
const boardElement = ref(null)
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const now = ref(Date.now())
const fullscreen = ref(false)
const dayFilter = ref('all')
const processing = ref(new Set())
const board = ref({ pending: [], confirmed: [], preparing: [], ready: [] })
let pollTimer
let clockTimer
let requestVersion = 0
let disposed = false

const columns = [
  {
    key: 'pending',
    label: 'Pending',
    action: 'preparing',
    actionLabel: 'Confirm',
    color: '#f59e0b',
  },
  {
    key: 'preparing',
    label: 'Preparing',
    action: 'ready',
    actionLabel: 'Mark ready',
    color: '#e11d48',
  },
  {
    key: 'ready',
    label: 'Ready',
    action: 'completed',
    actionLabel: 'Mark served',
    color: '#16a34a',
  },
]

function day(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
const today = computed(() => day(now.value))
const olderCount = computed(
  () =>
    Object.values(board.value)
      .flat()
      .filter((order) => day(order.created_at) && day(order.created_at) < today.value).length,
)
const visibleBoard = computed(() =>
  Object.fromEntries(
    columns.map(({ key }) => [
      key,
      [...(board.value[key] || []), ...(key === 'pending' ? board.value.confirmed : [])]
        .filter((order) => dayFilter.value === 'all' || day(order.created_at) === today.value)
        .sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at) || Number(a.id) - Number(b.id),
        ),
    ]),
  ),
)

function elapsed(value) {
  const minutes = minutesSince(value, now.value)
  if (minutes < 60) return `${minutes} ${t('min')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('{hours}h {minutes}m', { hours, minutes: minutes % 60 })
  return t('{days}d {hours}h', { days: Math.floor(hours / 24), hours: hours % 24 })
}

async function load() {
  const version = ++requestVersion
  refreshing.value = true
  try {
    const res = await kitchenService.dashboard()
    if (disposed || version !== requestVersion) return
    board.value = Object.fromEntries(
      ['pending', 'confirmed', 'preparing', 'ready'].map((key) => [
        key,
        Array.isArray(res.data[key]) ? res.data[key] : [],
      ]),
    )
    error.value = ''
  } catch (e) {
    if (!disposed && version === requestVersion) error.value = e.message
  } finally {
    if (!disposed && version === requestVersion) {
      loading.value = false
      refreshing.value = false
    }
  }
}

async function poll() {
  await load()
  if (!disposed) pollTimer = setTimeout(poll, 15000)
}

async function advance(order, status) {
  if (processing.value.has(order.id)) return
  processing.value.add(order.id)
  try {
    if (status === 'preparing' && board.value.pending.some((item) => item.id === order.id)) {
      await orderService.updateStatus(order.id, 'confirmed')
      // Keep the successful transition locally so a retry can resume preparing.
      board.value.pending = board.value.pending.filter((item) => item.id !== order.id)
      board.value.confirmed.push(order)
    }
    await orderService.updateStatus(order.id, status)
    if (disposed) return
    toast.success(t('Order #{number} updated', { number: order.order_number }))
    await load()
  } catch (e) {
    if (!disposed) toast.error(t(e.message))
  } finally {
    processing.value.delete(order.id)
  }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === boardElement.value) await document.exitFullscreen()
    else if (fullscreen.value) fullscreen.value = false
    else if (boardElement.value.requestFullscreen) await boardElement.value.requestFullscreen()
    else fullscreen.value = true
  } catch {
    fullscreen.value = !fullscreen.value
  }
}
function syncFullscreen() {
  fullscreen.value = document.fullscreenElement === boardElement.value
}
function handleKey(event) {
  if (event.key === 'Escape' && !document.fullscreenElement) fullscreen.value = false
}
onMounted(() => {
  poll()
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 30000)
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('keydown', handleKey)
})
onUnmounted(() => {
  disposed = true
  requestVersion++
  clearTimeout(pollTimer)
  clearInterval(clockTimer)
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('keydown', handleKey)
})
</script>

<template>
  <div ref="boardElement" class="kitchen-board" :class="{ 'kitchen-expanded': fullscreen }">
    <header class="kitchen-toolbar">
      <div>
        <h1 class="text-2xl font-bold">{{ $t('Kitchen') }}</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <label class="sr-only" for="kitchen-day">{{ $t('Filter by day') }}</label>
        <select id="kitchen-day" v-model="dayFilter" class="kitchen-control">
          <option value="all">{{ $t('All days') }}</option>
          <option value="today">{{ $t('Today') }}</option>
        </select>
        <button class="kitchen-control" :disabled="refreshing" @click="load">
          {{ refreshing ? $t('Refreshing...') : $t('Refresh') }}
        </button>
        <button class="kitchen-control" :aria-pressed="fullscreen" @click="toggleFullscreen">
          {{ fullscreen ? $t('Exit fullscreen') : $t('Fullscreen') }}
        </button>
      </div>
    </header>

    <div v-if="error" class="kitchen-notice" role="alert">
      {{ $t('Unable to refresh orders. Displayed orders may be out of date.') }} {{ $t(error) }}
      <button class="underline font-semibold" :disabled="refreshing" @click="load">
        {{ $t('Try again') }}
      </button>
    </div>
    <div v-if="olderCount" class="kitchen-notice">
      {{ olderCount }} {{ $t('unfinished orders from earlier days') }}.
      <button
        v-if="dayFilter === 'today'"
        class="underline font-semibold"
        @click="dayFilter = 'all'"
      >
        {{ $t('Show all') }}
      </button>
    </div>
    <p v-if="loading" class="py-10 text-center" role="status">{{ $t('Loading...') }}</p>
    <div v-else class="kitchen-columns">
      <section
        v-for="column in columns"
        :key="column.key"
        class="kitchen-column"
        :style="{ '--column-color': column.color }"
      >
        <header class="kitchen-column-heading">
          <h2>{{ $t(column.label) }}</h2>
          <span>{{ visibleBoard[column.key].length }}</span>
        </header>
        <p v-if="!visibleBoard[column.key].length" class="kitchen-empty">{{ $t('No orders') }}</p>
        <article
          v-for="order in visibleBoard[column.key]"
          :key="order.id"
          class="surface-card kitchen-ticket"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h3 class="text-2xl font-bold">
                {{ $t('Table') }} {{ order.table?.table_number ?? '—' }}
              </h3>
              <p class="mt-1 text-sm text-slate-500">#{{ order.order_number }}</p>
            </div>
            <span class="kitchen-time" :title="formatDateTime(order.created_at)">{{
              elapsed(order.created_at)
            }}</span>
          </div>
          <p class="text-xs text-slate-500">
            {{ $t('Ordered at') }} {{ formatTime(order.created_at) }}
          </p>
          <KitchenOrderItems :items="order.items || []" />
          <p v-if="order.notes" class="kitchen-note">{{ $t('Note:') }} {{ order.notes }}</p>
          <button class="kitchen-control font-semibold" @click="viewDetails(order)">
            {{ $t('View details') }}
          </button>
          <button
            class="kitchen-action"
            :disabled="processing.has(order.id)"
            @click="advance(order, column.action)"
          >
            {{ processing.has(order.id) ? $t('Updating...') : $t(column.actionLabel) }}
          </button>
        </article>
      </section>
    </div>
    <dialog
      ref="detailDialog"
      class="kitchen-detail"
      aria-labelledby="kitchen-detail-title"
      @click="$event.target === detailDialog && detailDialog.close()"
    >
      <template v-if="selectedOrder">
        <header class="flex items-start justify-between gap-3">
          <div>
            <h2 id="kitchen-detail-title" class="text-2xl font-bold">
              {{ $t('Table') }} {{ selectedOrder.table?.table_number ?? '?' }}
            </h2>
            <p>#{{ selectedOrder.order_number }}</p>
            <p class="text-sm">
              {{ $t('Ordered at') }} {{ formatDateTime(selectedOrder.created_at) }}
            </p>
          </div>
          <button class="kitchen-control" autofocus @click="detailDialog.close()">
            {{ $t('Close') }}
          </button>
        </header>
        <h3 class="mt-4 font-bold">{{ $t('Order details') }}</h3>
        <p v-if="selectedOrder.notes" class="kitchen-note">
          {{ $t('Note:') }} {{ selectedOrder.notes }}
        </p>
        <KitchenOrderItems :items="selectedOrder.items || []" large />
      </template>
    </dialog>
  </div>
</template>

<style scoped>
.kitchen-detail {
  width: min(640px, calc(100% - 24px));
  max-height: 90dvh;
  overflow-y: auto;
  margin: auto;
  padding: 24px;
  border: 0;
  border-radius: 18px;
  color: #0f172a;
  background: white;
}
.kitchen-detail::backdrop {
  background: #0f172a99;
}
:global(.dark) .kitchen-detail {
  background: #0f172a;
  color: #f1f5f9;
}
.kitchen-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: #0f172a;
}
.kitchen-expanded,
.kitchen-board:fullscreen {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: auto;
  padding: 24px;
  background: #f8fafc;
}
.kitchen-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}
.kitchen-control {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 14px;
  background: white;
  font-size: 14px;
}
button:disabled {
  opacity: 0.55;
  cursor: wait;
}
.kitchen-notice {
  border: 1px solid #fde68a;
  background: #fffbeb;
  color: #92400e;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
}
.kitchen-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.kitchen-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.kitchen-column-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-top: 4px solid var(--column-color);
  border-radius: 10px;
  background: white;
  font-weight: 700;
}
.kitchen-column-heading span {
  background: #f1f5f9;
  padding: 2px 10px;
  border-radius: 20px;
}
.kitchen-empty {
  padding: 28px 12px;
  text-align: center;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #64748b;
}
.kitchen-ticket {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-left: 4px solid var(--column-color);
  border-radius: 14px;
}
.kitchen-time {
  flex-shrink: 0;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 600;
}
.kitchen-note {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin-top: 6px;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  padding: 8px 10px;
  color: #92400e;
  font-size: 14px;
  font-weight: 600;
}
.kitchen-action {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  background: var(--column-color);
  color: white;
  font-weight: 700;
  font-size: 14px;
}
:global(.dark) .kitchen-board {
  color: #f1f5f9;
}
:global(.dark) .kitchen-expanded,
:global(.dark) .kitchen-board:fullscreen {
  background: #020617;
}
:global(.dark) .kitchen-ticket,
:global(.dark) .kitchen-column-heading,
:global(.dark) .kitchen-control {
  background: #0f172a;
  border-color: #334155;
}
:global(.dark) .kitchen-time,
:global(.dark) .kitchen-column-heading span {
  background: #1e293b;
}
@media (max-width: 1279px) {
  .kitchen-columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 639px) {
  .kitchen-columns {
    grid-template-columns: minmax(0, 1fr);
  }
  .kitchen-expanded {
    padding: 16px;
  }
}
</style>
