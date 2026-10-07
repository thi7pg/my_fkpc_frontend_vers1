<script setup>
import { t } from '../../languages'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  CheckCircleIcon,
  XCircleIcon,
  FaceFrownIcon,
  ArrowDownTrayIcon,
} from '@heroicons/vue/24/solid'
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
const loading = ref(true)
const error = ref('')
const receiptError = ref('')
const savingReceipt = ref(false)
const receiptOpen = ref(false)
const receiptImageUrl = ref('')
let receiptFile = null
let pollTimer = null
let requestVersion = 0

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
  const version = ++requestVersion
  const orderNumber = route.params.orderNumber
  try {
    const res = await orderService.track(orderNumber)
    if (version !== requestVersion) return
    order.value = res.data
    error.value = ''
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
  clearInterval(pollTimer)
  if (receiptImageUrl.value) URL.revokeObjectURL(receiptImageUrl.value)
})
watch(
  () => route.params.orderNumber,
  () => {
    order.value = null
    receiptOpen.value = false
    receiptFile = null
    receiptError.value = ''
    if (receiptImageUrl.value) URL.revokeObjectURL(receiptImageUrl.value)
    receiptImageUrl.value = ''
    loading.value = true
    load()
  },
)

async function prepareReceipt() {
  if (!order.value || savingReceipt.value) return
  savingReceipt.value = true
  receiptError.value = ''
  try {
    const snapshot = order.value
    const blob = await createReceiptImage({
      order: snapshot,
      restaurant: cart.restaurant,
      t,
      money: (amount) => formatCurrency(amount, currency.value),
      date: formatDateTime,
    })
    const filename = `Receipt-${snapshot.order_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`
    receiptFile = new File([blob], filename, { type: 'image/png' })
    if (receiptImageUrl.value) URL.revokeObjectURL(receiptImageUrl.value)
    receiptImageUrl.value = URL.createObjectURL(receiptFile)
    receiptOpen.value = true
  } catch {
    receiptError.value = t(
      'Could not save the receipt. Open this page in Safari or Chrome and try again.',
    )
  } finally {
    savingReceipt.value = false
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
    receiptError.value = t(
      'Could not save the receipt. Open this page in Safari or Chrome and try again.',
    )
  } finally {
    savingReceipt.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  <EmptyState
    v-else-if="error"
    :icon="FaceFrownIcon"
    :title="$t('Order not found')"
    :message="error"
    ><button class="customer-primary mt-4" @click="load">{{ $t('Try again') }}</button></EmptyState
  >
  <div v-else-if="order" class="tracking-page flex flex-col gap-5">
    <section class="tracking-banner" role="status">
      <XCircleIcon v-if="isCancelled" /><CheckCircleIcon v-else />
      <div>
        <h1>
          {{
            isCancelled ? $t('Order cancelled') : $t(steps[currentStepIndex]?.label ?? order.status)
          }}
        </h1>
        <p>
          {{
            isCancelled
              ? $t('Please speak with our team if you need help.')
              : order.status === 'completed'
                ? $t('Enjoy your meal!')
                : order.status === 'preparing'
                  ? $t('A little magic in the kitchen.')
                  : order.status === 'ready'
                    ? $t('Fresh, hot, and ready for you.')
                    : order.status === 'confirmed'
                      ? $t('Your meal is next in line.')
                      : $t('Your order is with our team.')
          }}
        </p>
      </div>
    </section>
    <div class="card tracking-order-meta">
      <div>
        <p class="customer-eyebrow">{{ $t('ORDER NUMBER') }}</p>
        <p class="tracking-order-number">#{{ order.order_number }}</p>
      </div>
      <span class="tracking-table">{{ $t('Table') }} {{ order.table }}</span>
    </div>
    <section v-if="!isCancelled" class="tracking-timeline" :aria-label="$t('Order progress')">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="tracking-step"
        :class="{ done: index < currentStepIndex, current: index === currentStepIndex }"
        :aria-current="index === currentStepIndex ? 'step' : undefined"
      >
        <span class="tracking-dot"
          ><CheckCircleIcon v-if="index < currentStepIndex" /><span v-else>{{
            index + 1
          }}</span></span
        >
        <div>
          <h3>{{ $t(step.label) }}</h3>
          <p v-if="index === currentStepIndex">
            {{
              step.key === 'pending'
                ? $t('Your order is with our team.')
                : step.key === 'confirmed'
                  ? $t('Your meal is next in line.')
                  : step.key === 'preparing'
                    ? $t('A little magic in the kitchen.')
                    : step.key === 'ready'
                      ? $t('Fresh, hot, and ready for you.')
                      : $t('Thank you for dining with Fantasia.')
            }}
          </p>
        </div>
      </div>
    </section>
    <section class="card p-5">
      <h2 class="mb-4 text-base font-extrabold">{{ $t('Order Items') }}</h2>
      <ul class="space-y-3 text-sm">
        <li v-for="item in order.items" :key="item.id" class="flex justify-between gap-3">
          <span class="text-slate-600">{{ item.quantity }}&times; {{ item.product_name }}</span
          ><strong class="shrink-0">{{ formatCurrency(item.subtotal, currency) }}</strong>
        </li>
      </ul>
      <div class="mt-5 flex justify-between border-t border-[#eee9e8] pt-4 text-lg font-extrabold">
        <span>{{ $t('Total') }}</span
        ><span class="text-primary-600">{{ formatCurrency(order.total_amount, currency) }}</span>
      </div>
    </section>
    <button
      v-if="!isCancelled"
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
        {{ receiptError }}
      </p>
    </Modal>
    <p v-if="receiptError" role="alert" class="text-sm text-danger-600">{{ receiptError }}</p>
    <p class="text-center text-[10px] text-slate-400">
      {{ $t('Placed at') }} {{ formatTime(order.created_at) }} {{ $t('· updates automatically') }}
    </p>
  </div>
</template>
