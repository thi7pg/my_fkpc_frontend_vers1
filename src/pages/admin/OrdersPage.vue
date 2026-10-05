<script setup>
import { t } from '../../i18n'
import { ref, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import { useOrdersStore } from '../../stores/orders'
import { ORDER_STATUSES, STATUS_LABELS, nextStatus } from '../../utils/orderStatus'
import OrderCard from '../../components/staff/OrderCard.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const toast = useToast()
const store = useOrdersStore()
const statusFilter = ref('')

function load() {
  store.fetchOrders({ status: statusFilter.value || undefined })
}
onMounted(load)
watch(statusFilter, load)

async function advance(order) {
  const next = nextStatus(order.status)
  if (!next) return
  try {
    await store.updateStatus(order.id, next)
    toast.success(t('Order #{number} marked {status}', { number: order.order_number, status: t(STATUS_LABELS[next]) }))
  } catch (e) {
    toast.error(t(e.message))
  }
}

async function cancel(order) {
  try {
    await store.updateStatus(order.id, 'cancelled', 'Cancelled by staff')
    toast.success(t('Order #{number} cancelled', { number: order.order_number }))
  } catch (e) {
    toast.error(t(e.message))
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Orders") }}</h1>
      <select
        v-model="statusFilter"
        class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <option value="">{{ $t("All Statuses") }}</option>
        <option v-for="s in ORDER_STATUSES" :key="s" :value="s">{{ $t(STATUS_LABELS[s]) }}</option>
      </select>
    </div>

    <div v-if="store.loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SkeletonLoader variant="card" :count="6" />
    </div>
    <EmptyState v-else-if="store.orders.length === 0" :icon="ClipboardDocumentListIcon" :title="$t('No orders found')" />
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <OrderCard v-for="order in store.orders" :key="order.id" :order="order">
        <template v-if="!['completed', 'cancelled'].includes(order.status)" #actions>
          <div class="flex gap-2 pt-1">
            <button
              class="flex-1 rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-500"
              @click="advance(order)"
            > {{ $t("Mark") }} {{ $t(STATUS_LABELS[nextStatus(order.status)]) }}
            </button>
            <button
              class="rounded-lg border border-danger-200 px-3 text-xs font-semibold text-danger-600 hover:bg-danger-50 dark:border-danger-500/30 dark:hover:bg-danger-500/10"
              @click="cancel(order)"
            > {{ $t("Cancel") }} </button>
          </div>
        </template>
      </OrderCard>
    </div>
  </div>
</template>
