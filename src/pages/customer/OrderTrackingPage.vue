<script setup>
import CustomerItemDetails from '../../components/customer/CustomerItemDetails.vue'
import { t } from '../../languages'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { FaceFrownIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/solid'
import { CheckIcon, ClockIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { STATUS_LABELS } from '../../utils/orderStatus'
import { orderService } from '../../services/orderService'
import { useCartStore } from '../../stores/cart'
import { formatCurrency, formatDateTime, formatTime } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import Modal from '../../components/ui/Modal.vue'
import { createReceiptImage } from '../../utils/receiptImage'

const route = useRoute()
const cart = useCartStore()

const order = ref(null)
const bill = ref(null)
const billError = ref('')
const loading = ref(true)
const error = ref('')
const receiptError = ref('')
const savingReceipt = ref(false)
const receiptOpen = ref(false)
const receiptImageUrl = ref('')
let receiptFile = null
let pollTimer = null
let requestVersion = 0
let receiptVersion = 0

const steps = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'confirmed', label: 'Kitchen Accepted' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Served' },
]

const currency = computed(() => cart.restaurant?.currency ?? 'USD')
const currentStepIndex = computed(() => steps.findIndex((s) => s.key === order.value?.status))
const isCancelled = computed(() => order.value?.status === 'cancelled')
const menuToken = computed(() => {
  const table = order.value?.table
  return (
    (typeof table === 'object' ? table?.qr_token || table?.table_number : table) || cart.qrToken
  )
})
const statusTitle = computed(
  () =>
    ({
      pending: 'Your order is with the kitchen',
      confirmed: 'The kitchen accepted your order',
      preparing: 'Your meal is being prepared',
      ready: 'Your food is ready',
      completed: 'Served. Enjoy your meal!',
      cancelled: 'Your order was cancelled',
    })[order.value?.status] || 'Order Tracking',
)
const estimatedMinutes = computed(() => {
  const minutes = Number(order.value?.estimated_minutes)
  return Number.isFinite(minutes) && minutes > 0 ? Math.ceil(minutes) : null
})
const paymentStatus = computed(() => {
  if (
    bill.value?.payment?.status === 'paid' ||
    (!order.value?.invoice_id && order.value?.payment?.status === 'paid')
  )
    return 'Paid'
  return 'Payment pending'
})
function itemImage(item) {
  return item.image || item.product?.image || cart.findProduct(item.product_id)?.image
}

const statusMessage = computed(
  () =>
    ({
      pending: 'Your order is with the kitchen. We will keep you updated.',
      confirmed: 'Your order has been confirmed by the kitchen.',
      preparing: 'Your food is being freshly prepared.',
      ready: 'Your food is ready and will be served shortly.',
      completed: 'Your order has been served. Enjoy your meal!',
      cancelled: 'This order has been cancelled.',
    })[order.value?.status] || '',
)

async function load() {
  const version = ++requestVersion
  const orderNumber = route.params.orderNumber
  try {
    const res = await orderService.track(orderNumber)
    if (version !== requestVersion) return
    order.value = res.data
    error.value = ''
    if (order.value.invoice_id) {
      try {
        const response = await orderService.bill(orderNumber)
        if (version !== requestVersion) return
        bill.value = response.data
        billError.value = ''
      } catch {
        if (version === requestVersion)
          billError.value = 'Could not refresh payment status. Please try again.'
      }
    }
  } catch (e) {
    if (version === requestVersion && !order.value) error.value = e.message
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

onMounted(() => {
  load()
  pollTimer = setInterval(load, 10000)
})
onUnmounted(() => {
  requestVersion++
  receiptVersion++
  clearInterval(pollTimer)
  if (receiptImageUrl.value) URL.revokeObjectURL(receiptImageUrl.value)
})
watch(
  () => route.params.orderNumber,
  () => {
    receiptVersion++
    order.value = null
    bill.value = null
    billError.value = ''
    receiptOpen.value = false
    receiptFile = null
    receiptError.value = ''
    error.value = ''
    savingReceipt.value = false
    if (receiptImageUrl.value) URL.revokeObjectURL(receiptImageUrl.value)
    receiptImageUrl.value = ''
    loading.value = true
    load()
  },
)

async function prepareReceipt() {
  if (!order.value || savingReceipt.value) return
  const version = ++receiptVersion
  const snapshot = order.value
  savingReceipt.value = true
  receiptError.value = ''
  try {
    const blob = await createReceiptImage({
      order: snapshot,
      restaurant: cart.restaurant,
      t,
      money: (amount) => formatCurrency(amount, currency.value),
      date: formatDateTime,
    })
    if (version !== receiptVersion) return
    const filename = `Receipt-${snapshot.order_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`
    receiptFile = new File([blob], filename, { type: 'image/png' })
    if (receiptImageUrl.value) URL.revokeObjectURL(receiptImageUrl.value)
    receiptImageUrl.value = URL.createObjectURL(receiptFile)
    receiptOpen.value = true
  } catch {
    if (version === receiptVersion) {
      receiptError.value =
        'Could not save the receipt. Open this page in Safari or Chrome and try again.'
    }
  } finally {
    if (version === receiptVersion) savingReceipt.value = false
  }
}

async function downloadReceipt() {
  if (!receiptFile || savingReceipt.value) return
  savingReceipt.value = true
  receiptError.value = ''
  try {
    const file = receiptFile
    const filename = file.name
    // On supported phones, the share sheet offers Save to Files.
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: t('Receipt') })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
        // Embedded browsers may reject sharing; try a normal file download.
      }
    }
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Keep the URL alive while Safari starts reading the file.
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    receiptError.value =
      'Could not save the receipt. Open this page in Safari or Chrome and try again.'
  } finally {
    savingReceipt.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="flex justify-center py-20">
    <LoadingSpinner size="lg" />
  </div>
  <EmptyState
    v-else-if="error"
    :icon="FaceFrownIcon"
    :title="$t('Order not found')"
    :message="error"
    ><button class="customer-primary mt-4" @click="load">{{ $t('Try again') }}</button></EmptyState
  >
  <div v-else-if="order" class="tracking-page flex min-w-0 flex-col gap-4 pb-6">
    <article class="surface-card overflow-hidden">
      <section class="bg-primary-600 px-5 pt-5 pb-6 text-white" role="status">
        <div class="flex items-center justify-between gap-3">
          <span class="text-[10px] font-bold tracking-wider text-amber-300 uppercase">{{
            $t('Live status')
          }}</span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            :class="
              isCancelled
                ? 'border-white/30 bg-white/15 text-white'
                : 'border-amber-300 bg-white text-amber-700'
            "
            ><span class="h-1.5 w-1.5 rounded-full bg-current" />{{
              $t(STATUS_LABELS[order.status] || order.status)
            }}</span
          >
        </div>
        <h1 class="mt-4 text-[27px] leading-tight font-bold tracking-tight sm:text-3xl">
          {{ $t(statusTitle) }}
        </h1>
        <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/85">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-black/10 px-2.5 py-1.5"
            ><ClockIcon class="h-4 w-4 text-amber-300" />{{
              estimatedMinutes && !isCancelled && currentStepIndex < 4
                ? $t('Estimated time: {minutes} minutes', { minutes: estimatedMinutes })
                : $t('Placed at {time}', { time: formatTime(order.created_at) })
            }}</span
          >
          <span class="break-all">#{{ order.order_number }}</span>
        </div>
      </section>
      <section
        v-if="!isCancelled"
        class="border-b border-slate-100 px-5 py-5"
        :aria-label="$t('Order progress')"
      >
        <h2 class="mb-4 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          {{ $t('Progress') }}
        </h2>
        <ol class="flex flex-col" :aria-label="$t('Order progress')">
          <li
            v-for="(step, index) in steps"
            :key="step.key"
            class="relative flex gap-4 pb-6 last:pb-0"
            :aria-current="index === currentStepIndex ? 'step' : undefined"
          >
            <span
              v-if="index < steps.length - 1"
              class="absolute top-8 bottom-0 left-4 w-px"
              :class="index < currentStepIndex ? 'bg-primary-200' : 'bg-slate-200'"
              aria-hidden="true"
            />
            <span
              class="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2"
              :class="
                index <= currentStepIndex
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-slate-100 bg-white text-slate-200'
              "
              aria-hidden="true"
              ><CheckIcon v-if="index < currentStepIndex" class="h-4 w-4" stroke-width="3" /><span
                v-else
                class="h-2 w-2 rounded-full bg-current"
            /></span>
            <div class="min-w-0 pt-1">
              <p
                class="text-sm font-semibold"
                :class="index <= currentStepIndex ? 'text-primary-600' : 'text-slate-500'"
              >
                {{ $t(step.label) }}
              </p>
              <p
                v-if="index === currentStepIndex"
                class="mt-1 text-xs leading-relaxed text-slate-500"
              >
                {{ $t(statusMessage) }}
              </p>
            </div>
          </li>
        </ol>
      </section>
      <p v-else class="border-b border-slate-100 px-5 py-4 text-sm text-slate-600">
        {{ order.cancelled_reason || $t(statusMessage) }}
      </p>
      <section class="px-5 pt-5 pb-4">
        <h2 class="mb-4 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          {{ $t('Your items') }}
        </h2>
        <ul class="space-y-4">
          <li v-for="item in order.items" :key="item.id" class="flex items-start gap-3">
            <img
              v-if="itemImage(item)"
              :src="itemImage(item)"
              :alt="item.product_name"
              class="h-12 w-12 shrink-0 rounded-xl border border-slate-100 object-cover"
            />
            <span
              v-else
              class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-400"
              ><ShoppingBagIcon class="h-6 w-6"
            /></span>
            <div class="min-w-0 flex-1">
              <CustomerItemDetails :item="item" show-quantity />
            </div>
            <strong class="shrink-0 text-sm text-slate-700">{{
              formatCurrency(item.subtotal, currency)
            }}</strong>
          </li>
        </ul>
        <div
          class="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm font-semibold"
        >
          <span>{{ $t('This order total') }}</span
          ><strong class="text-primary-600">{{
            formatCurrency(order.total_amount, currency)
          }}</strong>
        </div>
      </section>

      <section class="px-5 pb-5" aria-label="Table payment" aria-live="polite">
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs"
        >
          <span class="text-slate-500">{{ $t('Payment') }}</span>
          <div class="flex flex-wrap items-center gap-2">
            <strong v-if="paymentStatus !== 'Paid'" class="font-semibold text-slate-700">{{
              $t('Pay at counter')
            }}</strong
            ><span
              class="rounded-full border px-2 py-1 text-[10px] font-semibold"
              :class="
                paymentStatus === 'Paid'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              "
              >{{ $t(paymentStatus) }}</span
            >
          </div>
        </div>
        <template v-if="bill">
          <p v-if="bill.order_number" class="mt-3 break-all text-xs text-slate-500">
            #{{ bill.order_number }}
          </p>
          <div class="mt-3 flex justify-between gap-3 text-sm font-bold">
            <span>{{ $t('Total for this table') }}</span
            ><strong class="text-base text-primary-600">{{
              formatCurrency(bill.total_amount, currency)
            }}</strong>
          </div>
          <div
            v-if="Number(bill.paid_amount) > 0"
            class="mt-2 flex justify-between text-xs text-slate-500"
          >
            <span>{{ $t('Already paid') }}</span
            ><span>{{ formatCurrency(bill.paid_amount, currency) }}</span>
          </div>
          <div
            v-if="Number(bill.paid_amount) > 0 || paymentStatus === 'Paid'"
            class="mt-2 flex justify-between text-sm font-semibold"
          >
            <span>{{ $t('Total Due') }}</span
            ><span>{{ formatCurrency(bill.amount_due, currency) }}</span>
          </div>
        </template>
        <p v-if="billError" role="alert" class="mt-3 text-xs text-danger-600">
          {{ $t(billError) }}
        </p>
        <RouterLink
          v-if="order.invoice_id"
          :to="{
            name: bill?.payment?.status === 'paid' ? 'receipt' : 'session-checkout',
            params: { orderNumber: order.order_number },
          }"
          class="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          >{{ $t(bill?.payment?.status === 'paid' ? 'Receipt' : 'Checkout') }}</RouterLink
        >
        <RouterLink
          v-if="!bill?.closed_at && menuToken"
          :to="{ name: 'menu', params: { qrToken: menuToken } }"
          class="mt-3 flex min-h-11 items-center justify-center text-sm font-semibold text-slate-500 hover:text-primary-600"
          >{{ $t('Order more') }}</RouterLink
        >
      </section>
    </article>
    <section v-if="bill?.orders?.length" class="surface-card p-4" :aria-label="$t('Table Orders')">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold">{{ $t('Table Orders') }}</h2>
        <span class="text-xs text-slate-500">{{ bill.orders.length }} {{ $t('Orders') }}</span>
      </div>
      <div class="flex snap-x snap-proximity gap-2.5 overflow-x-auto px-px pt-0.5 pb-2">
        <RouterLink
          v-for="visitOrder in bill.orders"
          :key="visitOrder.order_number"
          :to="{ name: 'order-tracking', params: { orderNumber: visitOrder.order_number } }"
          :aria-current="visitOrder.order_number === order.order_number ? 'page' : undefined"
          class="flex w-36 shrink-0 snap-start flex-col gap-2 rounded-lg border p-3 focus-visible:outline-2 focus-visible:outline-primary-600"
          :class="
            visitOrder.order_number === order.order_number
              ? 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
          "
        >
          <strong class="text-xs font-semibold">#{{ visitOrder.order_number }}</strong>
          <span class="flex items-center justify-between gap-1.5 text-xs"
            ><strong>{{ formatCurrency(visitOrder.total_amount, currency) }}</strong
            ><span class="mt-1 block text-xs text-slate-500">{{
              $t(visitOrder.status === 'completed' ? 'Served' : visitOrder.status)
            }}</span></span
          >
        </RouterLink>
      </div>
    </section>
    <button
      v-if="!isCancelled && !order.invoice_id"
      :disabled="savingReceipt"
      class="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#eee9e8] bg-white text-xs font-bold disabled:opacity-50"
      @click="prepareReceipt"
    >
      <ArrowDownTrayIcon class="h-4 w-4" />{{ $t('Download Receipt') }}
    </button>
    <Modal v-model="receiptOpen" title="Receipt" size="sm">
      <div class="max-h-[65dvh] overflow-y-auto">
        <img
          :src="receiptImageUrl"
          :alt="$t('Receipt')"
          class="w-full rounded-lg border border-slate-200"
        />
      </div>
      <p class="my-3 text-sm text-slate-500">
        {{ $t('Press and hold the receipt image to save it to Photos.') }}
      </p>
      <button class="customer-primary w-full" :disabled="savingReceipt" @click="downloadReceipt">
        {{ $t('Save') }}
      </button>
      <p v-if="receiptError" role="alert" class="mt-2 text-sm text-danger-600">
        {{ $t(receiptError) }}
      </p>
    </Modal>
    <p v-if="receiptError" role="alert" class="text-sm text-danger-600">{{ $t(receiptError) }}</p>
  </div>
</template>
