<script setup>
import { ClockIcon } from '@heroicons/vue/24/outline'
import { STATUS_LABELS, STATUS_STYLES } from '../../utils/orderStatus'
import { formatCurrency, minutesSince } from '../../utils/format'

const props = defineProps({
  order: { type: Object, required: true },
  currency: { type: String, default: 'USD' },
})
</script>

<template>
  <div class="card flex flex-col gap-3 p-4">
    <div class="flex items-start justify-between">
      <div>
        <p class="font-bold text-slate-900 dark:text-slate-100">#{{ order.order_number }}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t("Table") }} {{ order.table?.table_number ?? '—' }}</p>
      </div>
      <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="STATUS_STYLES[order.status]">
        {{ $t(STATUS_LABELS[order.status]) }}
      </span>
    </div>

    <ul class="space-y-1 text-sm">
      <li v-for="item in order.items" :key="item.id" class="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
        <span>{{ item.quantity }}&times; {{ item.product_name }}</span>
        <span class="shrink-0 text-slate-400">{{ formatCurrency(item.subtotal, currency) }}</span>
      </li>
    </ul>

    <p v-if="order.notes" class="rounded-lg bg-warning-50 px-2.5 py-1.5 text-xs italic text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"> {{ $t("Note:") }} {{ order.notes }}
    </p>

    <div class="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
      <span class="flex items-center gap-1"><ClockIcon class="h-3.5 w-3.5" /> {{ minutesSince(order.created_at) }} {{ $t("min ago") }}</span>
      <span class="font-semibold text-slate-700 dark:text-slate-200">{{ formatCurrency(order.total_amount, currency) }}</span>
    </div>

    <slot name="actions" />
  </div>
</template>
