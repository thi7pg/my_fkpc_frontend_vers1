<script setup>
import { t } from '../../languages'
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import {
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  EyeIcon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/vue/24/outline'
import { useOrdersStore } from '../../stores/orders'
import { useAuthStore } from '../../stores/auth'
import { useRestaurantStore } from '../../stores/restaurant'
import { orderService } from '../../services/orderService'
import { ORDER_STATUSES, STATUS_LABELS, STATUS_STYLES, nextStatus } from '../../utils/orderStatus'
import { formatCurrency, formatDateTime } from '../../utils/format'
import OrderActions from '../../components/staff/OrderActions.vue'
import OrderDetails from '../../components/staff/OrderDetails.vue'
import Modal from '../../components/ui/Modal.vue'
import DateRangeFilter from '../../components/ui/DateRangeFilter.vue'
import { exportList } from '../../utils/listDocuments'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()
const store = useOrdersStore()
const auth = useAuthStore()
const restaurant = useRestaurantStore()
const currency = computed(() => restaurant.settings.currency || 'USD')
const money = (value) => formatCurrency(value, currency.value)
const statusFilter = ref('')
const dateRange = ref({ from: '', to: '' })
const page = ref(1)
const processing = ref([])
const busy = computed(() => processing.value.length > 0)
const search = ref('')
const modalMode = ref(null)
const selectedOrder = ref(null)
const detailLoading = ref(false)
const detailError = ref('')
const cancellationReason = ref('')
const reasonInput = ref(null)
let detailVersion = 0
let loadVersion = 0

const visibleOrders = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return store.orders.filter((order) =>
    [
      order.order_number,
      tableNumber(order),
      ...(order.items || []).map((item) => item.product_name),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query),
  )
})

function tableNumber(order) {
  return order.table?.table_number ?? '—'
}
function itemSummary(order) {
  return (order.items || []).map((item) => `${item.quantity}× ${item.product_name}`).join(', ')
}
function hasNotes(order) {
  return order.notes || order.items?.some((item) => item.notes)
}
function canManage(order) {
  return ['admin', 'cashier'].includes(auth.role) && Boolean(nextStatus(order.status))
}
function getTodayDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function selectToday() {
  dateRange.value = { from: getTodayDate(), to: getTodayDate() }
}

async function load() {
  const version = ++loadVersion
  closeModal()
  await store.fetchOrders({
    status: statusFilter.value || undefined,
    date_from: dateRange.value.from || undefined,
    date_to: dateRange.value.to || undefined,
    page: page.value,
  })
  if (version !== loadVersion || store.error) return
  if (store.meta?.last_page >= 1 && page.value > store.meta.last_page) {
    page.value = store.meta.last_page
    await load()
  }
}
onMounted(load)
onUnmounted(() => {
  detailVersion++
  loadVersion++
})
watch([statusFilter, dateRange], () => {
  page.value = 1
  load()
})
function changePage(next) {
  page.value = next
  load()
}

async function advance(order) {
  if (!canManage(order) || store.loading || busy.value) return
  const next = nextStatus(order.status)
  if (!next) return
  processing.value.push(order.id)
  try {
    const updated = await store.updateStatus(order.id, next)
    if (selectedOrder.value?.id === order.id) selectedOrder.value = updated
    toast.success(
      t('Order #{number} marked {status}', {
        number: order.order_number,
        status: t(STATUS_LABELS[next]),
      }),
    )
    if (statusFilter.value && updated.status !== statusFilter.value) await load()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    processing.value = processing.value.filter((id) => id !== order.id)
  }
}

function closeModal() {
  detailVersion++
  modalMode.value = null
  selectedOrder.value = null
  detailLoading.value = false
  detailError.value = ''
}

async function openDetails(order) {
  if (busy.value || store.loading) return
  const version = ++detailVersion
  selectedOrder.value = order
  modalMode.value = 'details'
  detailLoading.value = true
  detailError.value = ''
  try {
    const response = await orderService.get(order.id)
    if (version === detailVersion) selectedOrder.value = response.data
  } catch (e) {
    if (version === detailVersion) detailError.value = e.message
  } finally {
    if (version === detailVersion) detailLoading.value = false
  }
}

async function requestCancellation(order) {
  if (!canManage(order) || busy.value || store.loading) return
  detailVersion++
  selectedOrder.value = order
  cancellationReason.value = ''
  modalMode.value = 'cancel'
  await nextTick()
  reasonInput.value?.focus()
}

async function cancelOrder() {
  const order = selectedOrder.value
  if (!order || !canManage(order) || busy.value || store.loading) return
  processing.value.push(order.id)
  try {
    await store.updateStatus(
      order.id,
      'cancelled',
      cancellationReason.value.trim() || 'Cancelled by staff',
    )
    closeModal()
    toast.success(t('Order #{number} cancelled', { number: order.order_number }))
    if (statusFilter.value) await load()
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    processing.value = processing.value.filter((id) => id !== order.id)
  }
}

const exporting = ref(false)
const exportError = ref('')
async function downloadList(kind) {
  if (exporting.value || store.loading || busy.value) return
  exporting.value = true
  exportError.value = ''
  try {
    await exportList({
      type: 'orders',
      kind,
      params: {
        status: statusFilter.value || undefined,
        date_from: dateRange.value.from || undefined,
        date_to: dateRange.value.to || undefined,
      },
      search: search.value,
      currency: currency.value,
    })
  } catch (error) {
    exportError.value = error.message || 'Unable to export report. Please try again.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t('Orders') }}</h1>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          :disabled="store.loading || busy"
          @click="load"
        >
          <ArrowPathIcon class="h-4 w-4" aria-hidden="true" /> {{ $t('Refresh') }}
        </button>

        <button
          v-for="kind in ['excel', 'pdf']"
          :key="kind"
          type="button"
          class="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
          :disabled="exporting || store.loading || busy"
          @click="downloadList(kind)"
        >
          {{ $t(kind === 'excel' ? 'Excel' : 'PDF') }}
        </button>
      </div>
    </header>
    <p v-if="exportError" role="alert" class="text-sm text-danger-600">{{ $t(exportError) }}</p>

    <div class="card space-y-4 p-4">
      <div class="flex flex-wrap items-center gap-3">
        <label class="relative min-w-0 flex-1 basis-60">
          <span class="sr-only">{{ $t('Search orders on this page') }}</span>
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            v-model="search"
            type="search"
            :placeholder="$t('Search orders on this page')"
            class="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <select
          v-model="statusFilter"
          :aria-label="$t('Order status')"
          :disabled="busy"
          class="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm focus:border-primary-500 focus:outline-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">{{ $t('All Statuses') }}</option>
          <option v-for="s in ORDER_STATUSES" :key="s" :value="s">
            {{ $t(STATUS_LABELS[s]) }}
          </option>
        </select>
      </div>

      <div
        class="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"
      >
        <DateRangeFilter v-model="dateRange" id-prefix="order" :disabled="busy" />
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-100 aria-pressed:border-primary-600 aria-pressed:bg-primary-50 aria-pressed:text-primary-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:aria-pressed:border-primary-400 dark:aria-pressed:bg-primary-500/10 dark:aria-pressed:text-primary-400"
          :aria-pressed="dateRange.from === getTodayDate() && dateRange.to === getTodayDate()"
          :disabled="busy"
          @click="selectToday"
        >
          {{ $t('Today') }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate-100 aria-pressed:border-primary-600 aria-pressed:bg-primary-50 aria-pressed:text-primary-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:aria-pressed:border-primary-400 dark:aria-pressed:bg-primary-500/10 dark:aria-pressed:text-primary-400"
          :aria-pressed="!dateRange.from && !dateRange.to"
          :disabled="busy"
          @click="dateRange = { from: '', to: '' }"
        >
          {{ $t('All days') }}
        </button>
        <p class="text-xs text-slate-500 sm:ml-auto dark:text-slate-400" aria-live="polite">
          {{ $t('Orders on this page') }}:
          <strong class="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{{
            visibleOrders.length
          }}</strong>
          <span v-if="search.trim()"> / {{ store.orders.length }}</span>
        </p>
      </div>
    </div>

    <div
      v-if="store.loading"
      class="card space-y-6 p-6"
      role="status"
      :aria-label="$t('Loading...')"
    >
      <SkeletonLoader variant="line" :count="6" />
    </div>
    <EmptyState
      v-else-if="store.error"
      :icon="ClipboardDocumentListIcon"
      :title="$t('Something went wrong')"
      :message="store.error"
      ><button class="customer-primary mt-4" @click="load">
        {{ $t('Try again') }}
      </button></EmptyState
    >
    <EmptyState
      v-else-if="visibleOrders.length === 0"
      :icon="ClipboardDocumentListIcon"
      :title="$t('No orders found')"
    >
      <button
        v-if="search.trim()"
        type="button"
        class="text-sm font-semibold text-primary-600 hover:underline dark:text-primary-400"
        @click="search = ''"
      >
        {{ $t('Clear search') }}
      </button>
    </EmptyState>

    <div v-else>
      <div class="card hidden max-h-[65vh] overflow-auto xl:block">
        <table class="w-full min-w-[920px] text-left text-sm">
          <caption class="sr-only">
            {{
              $t('Orders on this page')
            }}
          </caption>
          <thead
            class="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            <tr>
              <th scope="col" class="px-5 py-3.5 font-medium">{{ $t('Order number') }}</th>
              <th scope="col" class="px-4 py-3.5 font-medium">{{ $t('Table') }}</th>
              <th scope="col" class="px-4 py-3.5 font-medium">{{ $t('Items') }}</th>
              <th scope="col" class="px-4 py-3.5 font-medium">{{ $t('Status') }}</th>
              <th scope="col" class="px-4 py-3.5 text-right font-medium">{{ $t('Total') }}</th>
              <th scope="col" class="px-5 py-3.5 text-right font-medium">{{ $t('Actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr
              v-for="order in visibleOrders"
              :key="order.id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
            >
              <td class="px-5 py-4">
                <span class="whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100"
                  >#{{ order.order_number }}</span
                >
                <time
                  :datetime="order.created_at"
                  class="mt-1 block max-w-44 text-xs leading-5 text-slate-500 dark:text-slate-400"
                  >{{ formatDateTime(order.created_at) }}</time
                >
              </td>
              <td class="px-4 py-4 font-semibold tabular-nums">{{ tableNumber(order) }}</td>
              <td class="px-4 py-4">
                <p
                  class="line-clamp-2 max-w-xs leading-6 text-slate-600 dark:text-slate-300"
                  :title="itemSummary(order)"
                >
                  {{ itemSummary(order) }}
                </p>
                <span
                  v-if="hasNotes(order)"
                  class="mt-1 inline-flex items-center gap-1 text-xs text-warning-600 dark:text-warning-500"
                  ><ChatBubbleLeftEllipsisIcon class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ $t('Notes') }}</span
                >
              </td>
              <td class="px-4 py-4">
                <span
                  class="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="STATUS_STYLES[order.status]"
                  >{{ $t(STATUS_LABELS[order.status]) }}</span
                >
              </td>
              <td class="px-4 py-4 text-right font-semibold tabular-nums">
                {{ money(order.total_amount) }}
              </td>
              <td class="px-5 py-4">
                <div class="flex items-center justify-end gap-2">
                  <OrderActions
                    v-if="canManage(order)"
                    :order="order"
                    :busy="busy"
                    @advance="advance"
                    @cancel="requestCancellation"
                  />
                  <button
                    type="button"
                    :aria-label="$t('View order {number}', { number: order.order_number })"
                    :title="$t('View details')"
                    :disabled="busy"
                    class="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    @click="openDetails(order)"
                  >
                    <EyeIcon class="h-4 w-4" aria-hidden="true" /><span v-if="!canManage(order)">{{
                      $t('View details')
                    }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:hidden">
        <article v-for="order in visibleOrders" :key="order.id" class="card min-w-0 space-y-3 p-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">#{{ order.order_number }}</h2>
            <span
              class="rounded-full px-2.5 py-1 text-xs font-semibold"
              :class="STATUS_STYLES[order.status]"
              >{{ $t(STATUS_LABELS[order.status]) }}</span
            >
          </div>
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"
          >
            <span class="font-medium text-slate-700 dark:text-slate-200"
              >{{ $t('Table') }} {{ tableNumber(order) }}</span
            >
            <time :datetime="order.created_at">{{ formatDateTime(order.created_at) }}</time>
          </div>
          <p class="line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {{ itemSummary(order) }}
          </p>
          <span
            v-if="hasNotes(order)"
            class="inline-flex items-center gap-1 text-xs text-warning-600 dark:text-warning-500"
            ><ChatBubbleLeftEllipsisIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ $t('Notes') }}</span
          >
          <div
            class="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800"
          >
            <strong class="text-sm tabular-nums">{{ money(order.total_amount) }}</strong>
            <button
              type="button"
              :aria-label="$t('View order {number}', { number: order.order_number })"
              :disabled="busy"
              class="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 dark:text-primary-400 dark:hover:bg-primary-500/10"
              @click="openDetails(order)"
            >
              <EyeIcon class="h-4 w-4" aria-hidden="true" /> {{ $t('View details') }}
            </button>
          </div>
          <OrderActions
            v-if="canManage(order)"
            :order="order"
            :busy="busy"
            class="w-full [&>button:first-child]:flex-1"
            @advance="advance"
            @cancel="requestCancellation"
          />
        </article>
      </div>
    </div>
    <div
      v-if="store.meta && store.meta.last_page > 1"
      class="flex items-center justify-center gap-4"
    >
      <button
        class="rounded-lg border px-4 py-2"
        :disabled="store.loading || busy || page <= 1"
        @click="changePage(page - 1)"
      >
        {{ $t('Previous') }}
      </button>
      <span class="text-sm">{{ page }} / {{ store.meta.last_page }}</span>
      <button
        class="rounded-lg border px-4 py-2"
        :disabled="store.loading || busy || page >= store.meta.last_page"
        @click="changePage(page + 1)"
      >
        {{ $t('Next') }}
      </button>
    </div>

    <Modal
      :model-value="Boolean(modalMode)"
      :title="modalMode === 'cancel' ? 'Cancel order' : 'Order details'"
      :size="modalMode === 'cancel' ? 'md' : 'lg'"
      @update:model-value="
        (open) => {
          if (!open) closeModal()
        }
      "
    >
      <template v-if="selectedOrder && modalMode === 'details'">
        <div class="max-h-[65vh] overflow-y-auto pr-1">
          <div
            v-if="detailLoading"
            class="space-y-6 py-4"
            role="status"
            :aria-label="$t('Loading...')"
          >
            <SkeletonLoader variant="line" :count="6" />
          </div>
          <div v-else-if="detailError" class="space-y-3 py-6 text-center">
            <p role="alert" class="text-sm text-danger-600">{{ $t(detailError) }}</p>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              @click="openDetails(selectedOrder)"
            >
              {{ $t('Try again') }}
            </button>
          </div>
          <OrderDetails v-else :order="selectedOrder" :currency="currency" />
        </div>
        <OrderActions
          v-if="!detailLoading && !detailError && canManage(selectedOrder)"
          :order="selectedOrder"
          :busy="busy"
          class="mt-5 w-full border-t border-slate-100 pt-4 dark:border-slate-800 [&>button:first-child]:flex-1"
          @advance="advance"
          @cancel="requestCancellation"
        />
      </template>
      <form
        v-else-if="selectedOrder && modalMode === 'cancel'"
        class="space-y-5"
        @submit.prevent="cancelOrder"
      >
        <div class="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
          <p class="font-semibold">#{{ selectedOrder.order_number }}</p>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ $t('Table') }} {{ tableNumber(selectedOrder) }} &middot;
            {{ money(selectedOrder.total_amount) }}
          </p>
        </div>
        <div>
          <label for="cancel-reason" class="mb-2 block text-sm font-medium">{{
            $t('Cancellation reason (optional)')
          }}</label>
          <textarea
            id="cancel-reason"
            ref="reasonInput"
            v-model="cancellationReason"
            maxlength="255"
            rows="3"
            :disabled="busy"
            class="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            :disabled="busy"
            class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
            @click="closeModal"
          >
            {{ $t('Keep order') }}
          </button>
          <button
            type="submit"
            :disabled="busy"
            class="rounded-xl bg-danger-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-danger-500 disabled:opacity-50"
          >
            {{ $t('Confirm cancellation') }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
