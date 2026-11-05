<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderService } from '../../services/orderService'
import { useRestaurantStore } from '../../stores/restaurant'
import DiningSummary from '../../components/customer/DiningSummary.vue'

defineOptions({ name: 'DiningCheckout' })

const route = useRoute()
const router = useRouter()
const restaurant = useRestaurantStore()
const currency = computed(() => restaurant.settings.currency || 'USD')
const bill = ref(null)
const loadError = ref('')
const checkoutError = ref('')
const refreshing = ref(false)
const requesting = ref(false)
const checkoutRequested = computed(
  () => !!bill.value?.checkout_requested_at && !checkoutError.value,
)
let pollTimer
let requestVersion = 0
let disposed = false

async function fetchBill({ submitCheckout = false } = {}) {
  clearTimeout(pollTimer)
  const request = ++requestVersion
  const orderNumber = route.params.orderNumber
  if (submitCheckout) {
    requesting.value = true
    checkoutError.value = ''
  } else {
    refreshing.value = true
  }
  try {
    const response = submitCheckout
      ? await orderService.requestCheckout(orderNumber)
      : await orderService.bill(orderNumber)
    if (disposed || request !== requestVersion) return
    bill.value = response.data
    loadError.value = ''
    if (bill.value.payment?.status === 'paid') {
      await router.replace({ name: 'receipt', params: { orderNumber } })
      return
    }
  } catch (error) {
    if (!disposed && request === requestVersion) {
      if (submitCheckout) {
        checkoutError.value = error.message || 'Could not request checkout. Please try again.'
      } else {
        loadError.value = error.message
      }
    }
  } finally {
    if (!disposed && request === requestVersion) {
      refreshing.value = false
      requesting.value = false
      pollTimer = setTimeout(refreshBill, 5000)
    }
  }
}

function refreshBill() {
  if (!refreshing.value && !requesting.value) return fetchBill()
}

function requestCheckout() {
  if (!refreshing.value && !requesting.value) return fetchBill({ submitCheckout: true })
}

function initialize() {
  requestVersion++
  bill.value = null
  loadError.value = ''
  checkoutError.value = ''
  refreshing.value = false
  requesting.value = false
  // An unpaid receipt URL may open this page for review, without requesting payment.
  if (route.query.review === '1') refreshBill()
  else requestCheckout()
}

watch(() => [route.params.orderNumber, route.query.review], initialize, { immediate: true })
onUnmounted(() => {
  disposed = true
  requestVersion++
  clearTimeout(pollTimer)
})
</script>

<template>
  <div class="flex flex-col gap-5 pb-10">
    <div class="customer-page-heading">
      <h1>{{ $t('Checkout') }}</h1>
    </div>
    <p v-if="!bill && (refreshing || requesting)" role="status">{{ $t('Loading...') }}</p>
    <p v-if="loadError" role="alert" class="text-danger-600">{{ $t(loadError) }}</p>
    <p v-if="checkoutError" role="alert" class="text-danger-600">{{ $t(checkoutError) }}</p>
    <DiningSummary v-if="bill" :bill="bill" :currency="currency" />
    <template v-if="bill || checkoutError">
      <section class="card p-5" aria-live="polite">
        <h2 class="font-bold">
          {{ $t(checkoutRequested ? 'Checkout requested' : 'Ready to check out?') }}
        </h2>
        <p class="mt-2 text-sm text-slate-500">
          {{
            $t(
              checkoutRequested
                ? 'Your checkout request is with the cashier. Your receipt will appear after payment is confirmed.'
                : 'Tap Checkout to send your visit total to the cashier.',
            )
          }}
        </p>
        <p
          v-if="checkoutRequested && bill.food_complete === false"
          class="mt-3 text-sm text-amber-700"
        >
          {{ $t('Food still being prepared or served') }}
        </p>
        <button
          v-if="!checkoutRequested"
          class="customer-primary mt-4 w-full"
          :disabled="refreshing || requesting"
          @click="requestCheckout"
        >
          {{ $t(requesting ? 'Loading...' : checkoutError ? 'Try again' : 'Checkout') }}
        </button>
      </section>
    </template>
    <button class="customer-primary" :disabled="refreshing || requesting" @click="refreshBill">
      {{ $t(refreshing ? 'Refreshing...' : 'Refresh') }}
    </button>
    <RouterLink
      :to="{ name: 'order-tracking', params: { orderNumber: route.params.orderNumber } }"
      class="text-center text-sm font-semibold"
      >{{ $t('Order Tracking') }}</RouterLink
    >
  </div>
</template>
