<script setup>
import { t, locale } from '../../i18n'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircleIcon, XCircleIcon, FaceFrownIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/solid'
import { orderService } from '../../services/orderService'
import { useCartStore } from '../../stores/cart'
import { formatCurrency, formatDateTime, formatTime } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const route = useRoute()
const cart = useCartStore()

const order = ref(null)
const loading = ref(true)
const error = ref('')
let pollTimer = null

const steps = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
]

const currency = computed(() => cart.restaurant?.currency ?? 'USD')
const currentStepIndex = computed(() => steps.findIndex((s) => s.key === order.value?.status))
const isCancelled = computed(() => order.value?.status === 'cancelled')

async function load() {
  try {
    const res = await orderService.track(route.params.orderNumber)
    order.value = res.data
    error.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  pollTimer = setInterval(load, 10000)
})
onUnmounted(() => clearInterval(pollTimer))
watch(() => route.params.orderNumber, () => { order.value = null; loading.value = true; load() })

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]))
}

function buildReceiptHtml() {
  const o = order.value
  const restaurant = cart.restaurant
  const itemRows = o.items
    .map(
      (item) => `
        <tr>
          <td class="qty">${item.quantity}&times;</td>
          <td class="name">${escapeHtml(item.product_name)}</td>
          <td class="amount">${formatCurrency(item.subtotal, currency.value)}</td>
        </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
    <html lang="${locale.value}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(t('Receipt'))} #${escapeHtml(o.order_number)}</title>
      <style>
        @page { margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; color: #111; margin: 0; padding: 16px; width: 320px; }
        .center { text-align: center; }
        h1 { font-size: 16px; margin: 0 0 2px; }
        .meta { font-size: 11px; margin: 1px 0; }
        hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        td { padding: 3px 0; vertical-align: top; }
        td.qty { width: 28px; }
        td.amount { text-align: right; white-space: nowrap; }
        .totals td { padding-top: 6px; font-weight: bold; font-size: 13px; }
        .footer { margin-top: 14px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="center">
        <h1>${escapeHtml(restaurant?.name ?? 'Receipt')}</h1>
        ${restaurant?.address ? `<p class="meta">${escapeHtml(restaurant.address)}</p>` : ''}
        ${restaurant?.phone ? `<p class="meta">${escapeHtml(restaurant.phone)}</p>` : ''}
      </div>
      <hr />
      <p class="meta">${escapeHtml(t('Order number'))} #${escapeHtml(o.order_number)}</p>
      <p class="meta">${escapeHtml(t('Table'))} ${escapeHtml(o.table)}</p>
      <p class="meta">${escapeHtml(formatDateTime(o.created_at))}</p>
      <hr />
      <table>
        ${itemRows}
        <tr class="totals">
          <td colspan="2">${escapeHtml(t('Total'))}</td>
          <td class="amount">${formatCurrency(o.total_amount, currency.value)}</td>
        </tr>
      </table>
      <hr />
      <p class="center footer">${escapeHtml(t('Thank you for your order!'))}</p>
    </body>
    </html>`
}

function downloadReceipt() {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)

  const cleanup = () => iframe.remove()
  iframe.onload = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }
  iframe.contentWindow.addEventListener('afterprint', cleanup)
  setTimeout(cleanup, 60000)

  const doc = iframe.contentDocument
  doc.open()
  doc.write(buildReceiptHtml())
  doc.close()
}
</script>

<template>
  <div v-if="loading" class="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  <EmptyState v-else-if="error" :icon="FaceFrownIcon" :title="$t('Order not found')" :message="error"><button class="customer-primary mt-4" @click="load">{{ $t("Try again") }}</button></EmptyState>
  <div v-else-if="order" class="tracking-page flex flex-col gap-5">
    <section class="tracking-banner" role="status"><XCircleIcon v-if="isCancelled" /><CheckCircleIcon v-else /><div><h1>{{ isCancelled ? $t("Order cancelled") : $t(steps[currentStepIndex]?.label ?? order.status) }}</h1><p>{{ isCancelled ? $t("Please speak with our team if you need help.") : order.status === 'completed' ? $t('Enjoy your meal!') : order.status === 'preparing' ? $t('A little magic in the kitchen.') : order.status === 'ready' ? $t('Fresh, hot, and ready for you.') : order.status === 'confirmed' ? $t('Your meal is next in line.') : $t('Your order is with our team.') }}</p></div></section>
    <div class="card tracking-order-meta"><div><p class="customer-eyebrow">{{ $t("ORDER NUMBER") }}</p><p class="tracking-order-number">#{{ order.order_number }}</p></div><span class="tracking-table">{{ $t("Table") }} {{ order.table }}</span></div>
    <section v-if="!isCancelled" class="tracking-timeline" :aria-label="$t('Order progress')">
      <div v-for="(step, index) in steps" :key="step.key" class="tracking-step" :class="{ done: index < currentStepIndex, current: index === currentStepIndex }" :aria-current="index === currentStepIndex ? 'step' : undefined"><span class="tracking-dot"><CheckCircleIcon v-if="index < currentStepIndex" /><span v-else>{{ index + 1 }}</span></span><div><h3>{{ $t(step.label) }}</h3><p v-if="index === currentStepIndex">{{ step.key === 'pending' ? $t("Your order is with our team.") : step.key === 'confirmed' ? $t("Your meal is next in line.") : step.key === 'preparing' ? $t("A little magic in the kitchen.") : step.key === 'ready' ? $t("Fresh, hot, and ready for you.") : $t("Thank you for dining with Fantasia.") }}</p></div></div>
    </section>
    <section class="card p-5"><h2 class="mb-4 text-base font-extrabold">{{ $t("Order Items") }}</h2><ul class="space-y-3 text-sm"><li v-for="item in order.items" :key="item.id" class="flex justify-between gap-3"><span class="text-slate-600">{{ item.quantity }}&times; {{ item.product_name }}</span><strong class="shrink-0">{{ formatCurrency(item.subtotal, currency) }}</strong></li></ul><div class="mt-5 flex justify-between border-t border-[#eee9e8] pt-4 text-lg font-extrabold"><span>{{ $t("Total") }}</span><span class="text-primary-600">{{ formatCurrency(order.total_amount, currency) }}</span></div></section>
    <button v-if="!isCancelled" class="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#eee9e8] bg-white text-xs font-bold" @click="downloadReceipt"><ArrowDownTrayIcon class="h-4 w-4" />{{ $t("Download Receipt") }}</button>
    <p class="text-center text-[10px] text-slate-400">{{ $t("Placed at") }} {{ formatTime(order.created_at) }} {{ $t("· updates automatically") }}</p>
  </div>
</template>
