<script setup>
import { computed, ref } from 'vue'
import { STATUS_LABELS, STATUS_STYLES } from '../../utils/orderStatus'
import { formatCurrency, formatDateTime } from '../../utils/format'

const props = defineProps({
  order: { type: Object, required: true },
  currency: { type: String, default: 'USD' },
})

const failedImages = ref(new Set())
const tableNumber = computed(() =>
  typeof props.order.table === 'object' ? props.order.table?.table_number : props.order.table,
)

function photo(item) {
  return item.product_image || item.product?.image || item.image || ''
}

function money(amount) {
  return formatCurrency(amount, props.currency)
}
</script>

<template>
  <div class="min-w-0 space-y-5">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="break-all text-xl font-bold text-slate-900 dark:text-slate-100">
          #{{ order.order_number }}
        </h2>
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {{ $t('Table') }} {{ tableNumber ?? '—' }}
        </p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ formatDateTime(order.created_at) }}
        </p>
      </div>
      <span
        class="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="STATUS_STYLES[order.status]"
      >
        {{ $t(STATUS_LABELS[order.status] || order.status) }}
      </span>
    </header>

    <section>
      <h3 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {{ $t('Order Items') }}
      </h3>
      <ul class="divide-y divide-slate-100 dark:divide-slate-800">
        <li v-for="(item, index) in order.items" :key="item.id ?? index" class="py-3 first:pt-0">
          <div class="flex items-start gap-3">
            <img
              v-if="photo(item) && !failedImages.has(photo(item))"
              :src="photo(item)"
              :alt="item.product_name"
              loading="lazy"
              class="h-14 w-14 shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-slate-800"
              @error="failedImages.add(photo(item))"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3 text-sm">
                <p class="min-w-0 break-words text-slate-700 dark:text-slate-200">
                  <span class="mr-1 font-semibold">{{ item.quantity }}&times;</span>
                  {{ item.product_name }}
                </p>
                <span class="shrink-0 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {{ money(item.subtotal) }}
                </span>
              </div>
              <p
                v-if="item.notes"
                class="mt-2 whitespace-pre-wrap break-words rounded-lg bg-warning-50 px-3 py-2 text-xs text-amber-800 dark:bg-warning-500/10 dark:text-warning-500"
              >
                <strong>{{ $t('Note:') }}</strong> {{ item.notes }}
              </p>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section
      v-if="order.notes"
      class="rounded-xl bg-warning-50 p-3 text-sm text-amber-800 dark:bg-warning-500/10 dark:text-warning-500"
    >
      <h3 class="font-semibold">{{ $t('Note:') }}</h3>
      <p class="mt-1 whitespace-pre-wrap break-words">{{ order.notes }}</p>
    </section>

    <dl class="space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
      <div class="flex justify-between gap-4 text-slate-500 dark:text-slate-400">
        <dt>{{ $t('Subtotal') }}</dt>
        <dd class="shrink-0 tabular-nums">{{ money(order.subtotal) }}</dd>
      </div>
      <div
        v-if="Number(order.tax_amount) > 0"
        class="flex justify-between gap-4 text-slate-500 dark:text-slate-400"
      >
        <dt>{{ $t('Tax') }}</dt>
        <dd class="shrink-0 tabular-nums">{{ money(order.tax_amount) }}</dd>
      </div>
      <div
        class="flex justify-between gap-4 pt-2 text-base font-bold text-slate-900 dark:text-slate-100"
      >
        <dt>{{ $t('Total') }}</dt>
        <dd class="shrink-0 tabular-nums">{{ money(order.total_amount) }}</dd>
      </div>
    </dl>

    <section
      v-if="order.cancelled_reason"
      class="rounded-xl bg-danger-50 p-3 text-sm text-danger-600 dark:bg-danger-500/10 dark:text-danger-500"
    >
      <h3 class="font-semibold">{{ $t('Order cancelled') }}</h3>
      <p class="mt-1 whitespace-pre-wrap break-words">{{ order.cancelled_reason }}</p>
    </section>
  </div>
</template>
