<script setup>
import { t } from '../../languages'
import { ref, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import { useOrdersStore } from '../../stores/orders'
import { useAuthStore } from '../../stores/auth'
import { ORDER_STATUSES, STATUS_LABELS, nextStatus } from '../../utils/orderStatus'
import OrderCard from '../../components/staff/OrderCard.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()
const store = useOrdersStore()
const auth = useAuthStore()
const statusFilter = ref('')
const selectedDay = ref('')
const page = ref(1)
const processing = ref([])
function selectToday() {
  selectedDay.value = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function load() {
  store.fetchOrders({
    status: statusFilter.value || undefined,
    date: selectedDay.value || undefined,
    page: page.value,
  })
}
onMounted(load)
watch([statusFilter, selectedDay], () => {
  page.value = 1
  load()
})
function changePage(next) {
  page.value = next
  load()
}

async function advance(order) {
  if (!['admin', 'cashier'].includes(auth.role)) return
  if (processing.value.includes(order.id)) return
  const next = nextStatus(order.status)
  if (!next) return
  processing.value.push(order.id)
  try {
    await store.updateStatus(order.id, next)
    toast.success(
      t('Order #{number} marked {status}', {
        number: order.order_number,
        status: t(STATUS_LABELS[next]),
      }),
    )
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    processing.value = processing.value.filter((id) => id !== order.id)
  }
}

async function cancel(order) {
  if (!['admin', 'cashier'].includes(auth.role)) return
  if (processing.value.includes(order.id)) return
  processing.value.push(order.id)
  try {
    await store.updateStatus(order.id, 'cancelled', 'Cancelled by staff')
    toast.success(t('Order #{number} cancelled', { number: order.order_number }))
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    processing.value = processing.value.filter((id) => id !== order.id)
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t('Orders') }}</h1>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">{{ $t('All Statuses') }}</option>
        <option v-for="s in ORDER_STATUSES" :key="s" :value="s">{{ $t(STATUS_LABELS[s]) }}</option>
      </select>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <label for="order-day" class="text-sm font-semibold">{{ $t('Filter by day') }}</label>
      <input
        id="order-day"
        v-model="selectedDay"
        type="date"
        class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <button
        class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
        @click="selectToday"
      >
        {{ $t('Today') }}
      </button>
      <button
        class="rounded-xl border px-4 py-2.5 text-sm font-semibold"
        :class="
          !selectedDay ? 'border-primary-600 bg-primary-50 text-primary-600' : 'border-slate-200'
        "
        :aria-pressed="!selectedDay"
        @click="selectedDay = ''"
      >
        {{ $t('All days') }}
      </button>
    </div>

    <div v-if="store.loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SkeletonLoader variant="card" :count="6" />
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
      v-else-if="store.orders.length === 0"
      :icon="ClipboardDocumentListIcon"
      :title="$t('No orders found')"
    />
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <OrderCard v-for="order in store.orders" :key="order.id" :order="order">
        <template
          v-if="
            ['admin', 'cashier'].includes(auth.role) &&
            !['completed', 'cancelled'].includes(order.status)
          "
          #actions
        >
          <div class="flex gap-2 pt-1">
            <button
              class="flex-1 rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-500"
              @click="advance(order)"
              :disabled="processing.includes(order.id)"
            >
              {{ $t('Mark') }} {{ $t(STATUS_LABELS[nextStatus(order.status)]) }}
            </button>
            <button
              class="rounded-lg border border-danger-200 px-3 text-xs font-semibold text-danger-600 hover:bg-danger-50 dark:border-danger-500/30 dark:hover:bg-danger-500/10"
              @click="cancel(order)"
              :disabled="processing.includes(order.id)"
            >
              {{ $t('Cancel') }}
            </button>
          </div>
        </template>
      </OrderCard>
    </div>
    <div
      v-if="store.meta && store.meta.last_page > 1"
      class="flex items-center justify-center gap-4"
    >
      <button
        class="rounded-lg border px-4 py-2"
        :disabled="store.loading || page <= 1"
        @click="changePage(page - 1)"
      >
        {{ $t('Previous') }}
      </button>
      <span class="text-sm">{{ page }} / {{ store.meta.last_page }}</span>
      <button
        class="rounded-lg border px-4 py-2"
        :disabled="store.loading || page >= store.meta.last_page"
        @click="changePage(page + 1)"
      >
        {{ $t('Next') }}
      </button>
    </div>
  </div>
</template>
