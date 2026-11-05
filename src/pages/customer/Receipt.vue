<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderService } from '../../services/orderService'
import { useRestaurantStore } from '../../stores/restaurant'
import { useCartStore } from '../../stores/cart'
import { forgetSessionOrders } from '../../utils/tableOrders'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { createReceiptImage } from '../../utils/receiptImage'
import { t } from '../../languages'
import DiningSummary from '../../components/customer/DiningSummary.vue'

defineOptions({ name: 'DiningReceipt' })

const route = useRoute()
const router = useRouter()
const restaurant = useRestaurantStore()
const cart = useCartStore()
const bill = ref(null)
const error = ref('')
const loading = ref(false)
const saving = ref(false)
const imageUrl = ref('')
const currency = computed(() => restaurant.settings.currency || 'USD')
let requestVersion = 0

function clearImage() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
}

function reviewCheckout(orderNumber) {
  return router.replace({
    name: 'session-checkout',
    params: { orderNumber },
    query: { review: '1' },
  })
}

async function loadReceipt() {
  const request = ++requestVersion
  const orderNumber = route.params.orderNumber
  bill.value = null
  clearImage()
  loading.value = true
  saving.value = false
  error.value = ''
  try {
    const response = await orderService.sessionReceipt(orderNumber)
    if (request !== requestVersion) return
    if (response.data.payment?.status !== 'paid') {
      await reviewCheckout(orderNumber)
      return
    }
    bill.value = response.data
    // Remove only this visit's saved tracking links, preserving any newer visit.
    const currentVisit =
      bill.value.closed_at &&
      forgetSessionOrders(
        bill.value.orders.map((order) => order.order_number),
        cart.qrToken,
      )
    if (currentVisit) cart.clear()
  } catch (requestError) {
    if (request !== requestVersion) return
    if (requestError.status === 409) {
      await reviewCheckout(orderNumber)
    } else {
      error.value = requestError.message
    }
  } finally {
    if (request === requestVersion) loading.value = false
  }
}

async function prepareImage() {
  if (saving.value || !bill.value) return
  saving.value = true
  error.value = ''
  const request = requestVersion
  try {
    const blob = await createReceiptImage({
      order: bill.value,
      restaurant: restaurant.settings,
      t,
      money: (amount) => formatCurrency(amount, currency.value),
      date: formatDateTime,
    })
    if (request !== requestVersion) return
    clearImage()
    imageUrl.value = URL.createObjectURL(blob)
  } catch (imageError) {
    if (request === requestVersion) error.value = imageError.message
  } finally {
    if (request === requestVersion) saving.value = false
  }
}

watch(() => route.params.orderNumber, loadReceipt, { immediate: true })
onUnmounted(() => {
  requestVersion++
  clearImage()
})
</script>

<template>
  <div class="flex flex-col gap-5 pb-10">
    <div class="customer-page-heading">
      <h1>{{ $t('Receipt') }}</h1>
    </div>
    <p v-if="loading" role="status">{{ $t('Loading...') }}</p>
    <p v-if="error" role="alert" class="text-danger-600">{{ $t(error) }}</p>
    <button v-if="error && !bill" class="customer-primary" @click="loadReceipt">
      {{ $t('Try again') }}
    </button>
    <template v-if="bill">
      <div class="card p-5 text-center">
        <h2 class="text-xl font-bold">{{ restaurant.name }}</h2>
        <p class="mt-2 font-semibold text-green-700">{{ $t('Paid') }}</p>
        <p class="mt-1 text-sm text-slate-500">
          {{ formatDateTime(bill.payment?.paid_at || bill.closed_at) }}
        </p>
        <p class="mt-2 text-sm">{{ $t('Thank you for dining with us!') }}</p>
      </div>
      <DiningSummary :bill="bill" :currency="currency" />
      <RouterLink
        v-if="!bill.closed_at"
        :to="{ name: 'order-tracking', params: { orderNumber: route.params.orderNumber } }"
        class="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-center text-sm font-semibold text-primary-700"
        >{{ $t('Order Tracking') }}</RouterLink
      >
      <button class="customer-primary" :disabled="saving" @click="prepareImage">
        {{ $t(saving ? 'Loading...' : 'Download Receipt') }}
      </button>
      <template v-if="imageUrl">
        <img :src="imageUrl" :alt="$t('Receipt')" class="w-full rounded-xl" />
        <a
          :href="imageUrl"
          :download="`${bill.order_number}.png`"
          class="customer-primary text-center"
          >{{ $t('Save') }}</a
        >
        <p class="text-sm text-slate-500">
          {{ $t('Press and hold the receipt image to save it to Photos.') }}
        </p>
      </template>
    </template>
  </div>
</template>
