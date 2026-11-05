<script setup>
import { computed } from 'vue'
import { formatCurrency } from '../../utils/format'

const props = defineProps({
  bill: { type: Object, required: true },
  currency: { type: String, default: 'USD' },
})

// Totals come directly from Laravel; this component only formats them.
const totalRows = [
  ['subtotal', 'Subtotal'],
  ['tax_amount', 'Tax'],
]
const orderGroups = computed(() =>
  props.bill.orders.map((order) => ({
    order,
    items: props.bill.items.filter((item) => item.order_number === order.order_number),
  })),
)
const itemsWithoutOrder = computed(() => props.bill.items.filter((item) => !item.order_number))

function paymentLabel(order) {
  if (order.payment_status === 'paid') return 'Paid'
  return 'Payment pending'
}
</script>

<template>
  <section class="card p-5" :aria-label="$t('Order Summary')">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-bold">{{ $t('Table') }} {{ bill.table }}</h2>
      <span v-if="bill.order_number" class="text-sm text-slate-500">#{{ bill.order_number }}</span>
    </div>
    <div
      v-for="{ order, items } in orderGroups"
      :key="order.order_number"
      class="border-t border-slate-100 py-4 dark:border-slate-800"
    >
      <div class="flex items-center justify-between gap-3 font-semibold">
        <span
          >#{{ order.order_number }}
          <small v-if="order.table">· {{ $t('Table') }} {{ order.table }}</small></span
        >
        <span>{{ formatCurrency(order.total_amount, currency) }}</span>
      </div>
      <p class="mt-1 text-xs text-slate-500">
        {{ $t(order.status === 'completed' ? 'Served' : order.status) }} ·
        {{ $t(paymentLabel(order)) }}
      </p>
      <ul v-if="order.status !== 'cancelled'" class="mt-3 space-y-2 text-sm">
        <li v-for="item in items" :key="item.id">
          <div class="flex justify-between gap-3">
            <span>{{ item.quantity }}× {{ item.product_name }}</span
            ><span>{{ formatCurrency(item.subtotal, currency) }}</span>
          </div>
          <p v-if="item.notes" class="mt-1 whitespace-pre-wrap text-xs text-slate-500">
            {{ item.notes }}
          </p>
        </li>
      </ul>
    </div>
    <ul v-if="itemsWithoutOrder.length" class="mb-4 space-y-2 text-sm">
      <li v-for="item in itemsWithoutOrder" :key="item.id" class="flex justify-between gap-3">
        <span>{{ item.quantity }}× {{ item.product_name }}</span
        ><span>{{ formatCurrency(item.subtotal, currency) }}</span>
      </li>
    </ul>
    <div class="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <template v-for="[field, label] in totalRows" :key="field">
        <div
          v-if="field === 'subtotal' || Number(bill[field]) > 0"
          class="flex justify-between text-sm text-slate-500"
        >
          <span>{{ $t(label) }}</span
          ><span>{{ formatCurrency(bill[field], currency) }}</span>
        </div>
      </template>
      <div class="flex justify-between text-lg font-bold">
        <span>{{ $t('Total') }}</span
        ><span>{{ formatCurrency(bill.total_amount, currency) }}</span>
      </div>
      <div v-if="Number(bill.paid_amount) > 0" class="flex justify-between text-sm">
        <span>{{ $t('Paid') }}</span
        ><span>{{ formatCurrency(bill.paid_amount, currency) }}</span>
      </div>
      <div v-if="!bill.closed_at" class="flex justify-between text-lg font-bold text-primary-600">
        <span>{{ $t('Total to pay') }}</span
        ><span>{{ formatCurrency(bill.amount_due, currency) }}</span>
      </div>
    </div>
  </section>
</template>
