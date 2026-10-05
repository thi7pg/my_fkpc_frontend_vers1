<script setup>
import { t } from '../../i18n'
import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { FireIcon } from '@heroicons/vue/24/outline'
import { kitchenService } from '../../services/kitchenService'
import { orderService } from '../../services/orderService'
import { minutesSince } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'

const toast = useToast()
const loading = ref(true)
const board = ref({ pending: [], confirmed: [], preparing: [], ready: [] })
let pollTimer = null

const columns = [
  { key: 'pending', label: 'Pending', action: 'confirmed', actionLabel: 'Accept', tone: 'warning' },
  { key: 'confirmed', label: 'Confirmed', action: 'preparing', actionLabel: 'Start Preparing', tone: 'primary' },
  { key: 'preparing', label: 'Preparing', action: 'ready', actionLabel: 'Mark Ready', tone: 'primary' },
  { key: 'ready', label: 'Ready', action: 'completed', actionLabel: 'Complete', tone: 'success' },
]

const toneClasses = {
  warning: 'border-t-warning-500',
  primary: 'border-t-primary-500',
  success: 'border-t-success-500',
}

async function load() {
  try {
    const res = await kitchenService.dashboard()
    board.value = res.data
  } catch (e) {
    toast.error(t(e.message))
  } finally {
    loading.value = false
  }
}

async function advance(order, status) {
  try {
    await orderService.updateStatus(order.id, status)
    toast.success(t('Order #{number} updated', { number: order.order_number }))
    await load()
  } catch (e) {
    toast.error(t(e.message))
  }
}

onMounted(() => {
  load()
  pollTimer = setInterval(load, 15000)
})
onUnmounted(() => clearInterval(pollTimer))
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ $t("Kitchen") }}</h1>

    <div v-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SkeletonLoader variant="card" :count="4" />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <section v-for="column in columns" :key="column.key" class="flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-slate-900 dark:text-slate-100">{{ $t(column.label) }}</h2>
          <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {{ board[column.key]?.length ?? 0 }}
          </span>
        </div>

        <EmptyState v-if="!board[column.key]?.length" :icon="FireIcon" :title="$t('No orders')" />

        <div
          v-for="order in board[column.key]"
          :key="order.id"
          class="card flex flex-col gap-3 border-t-4 p-4"
          :class="toneClasses[column.tone]"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-lg font-bold text-slate-900 dark:text-slate-100">#{{ order.order_number }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t("Table") }} {{ order.table?.table_number ?? '—' }}</p>
            </div>
            <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {{ minutesSince(order.created_at) }} {{ $t("min") }} </span>
          </div>

          <ul class="space-y-1 text-sm text-slate-600 dark:text-slate-300">
            <li v-for="item in order.items" :key="item.id">{{ item.quantity }}&times; {{ item.product_name }}</li>
          </ul>

          <p v-if="order.notes" class="rounded-lg bg-warning-50 px-2.5 py-1.5 text-xs italic text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"> {{ $t("Note:") }} {{ order.notes }}
          </p>

          <button
            class="mt-1 w-full rounded-lg bg-primary-600 py-2 text-xs font-semibold text-white hover:bg-primary-500"
            @click="advance(order, column.action)"
          >
            {{ $t(column.actionLabel) }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
