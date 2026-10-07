<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { acledaService } from '../../services/acledaService'
import { formatCurrency } from '../../utils/format'
import { useCartStore } from '../../stores/cart'

const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const payment = ref(null)
const error = ref('')
const busy = ref(false)
let timer
let version = 0

function sessionToken(orderNumber) {
  try {
    return sessionStorage.getItem('demo_payment_' + orderNumber)
  } catch {
    return null
  }
}

async function load() {
  const requestVersion = ++version
  const orderNumber = String(route.params.orderNumber)
  const token = sessionToken(orderNumber)
  clearTimeout(timer)
  if (!token) {
    error.value =
      'Payment session missing. Open the payment page in the same tab used for checkout.'
    return
  }
  try {
    const response = await acledaService.get(orderNumber, token)
    if (requestVersion !== version) return
    payment.value = response.data
    error.value = ''
  } catch (e) {
    if (requestVersion !== version) return
    error.value = e.message
    if ([401, 403, 404].includes(e.status)) return
  }
  if (requestVersion === version && payment.value?.status !== 'paid' && !payment.value?.expired) {
    timer = setTimeout(load, 5000)
  }
}

async function confirm() {
  if (busy.value || !payment.value || payment.value.status === 'paid' || payment.value.expired)
    return
  const orderNumber = String(route.params.orderNumber)
  const token = sessionToken(orderNumber)
  if (!token) return
  busy.value = true
  try {
    await acledaService.confirm(orderNumber, token)
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

onMounted(load)
watch(
  () => route.params.orderNumber,
  () => {
    payment.value = null
    load()
  },
)
onUnmounted(() => {
  version++
  clearTimeout(timer)
})
</script>
<template>
  <section
    class="card mx-auto flex max-w-md flex-col items-center gap-4 overflow-hidden border border-slate-200 p-6 text-center"
  >
    <div class="-mx-6 -mt-6 mb-2 w-[calc(100%+3rem)] bg-[#12335b] px-6 py-5 text-white">
      <p class="text-xs uppercase tracking-widest text-white/70">Bank payment</p>
      <h1 class="mt-1 text-2xl font-semibold">ACLEDA QR</h1>
    </div>
    <p class="text-xs text-slate-500">Test payment — no money transferred.</p>
    <p>{{ route.params.orderNumber }}</p>
    <template v-if="payment">
      <strong class="text-2xl">{{
        formatCurrency(payment.amount, cart.restaurant?.currency || 'USD')
      }}</strong>
      <p v-if="payment.status === 'paid'" role="status">Test payment confirmed.</p>
      <p v-else-if="payment.expired" role="status">QR expired. No payment was made.</p>
      <template v-else>
        <img
          :src="'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(payment.qr_svg)"
          alt="Test payment QR"
          width="240"
          height="240"
        />
        <p class="text-sm">Awaiting confirmation. QR expires in 10 minutes.</p>
        <button class="customer-primary" :disabled="busy" @click="confirm">
          {{ busy ? 'Confirming...' : 'Confirm test payment' }}
        </button>
      </template>
    </template>
    <p v-if="error" role="alert" class="text-red-600">{{ error }}</p>
    <button
      class="customer-primary"
      @click="
        router.push({ name: 'order-tracking', params: { orderNumber: route.params.orderNumber } })
      "
    >
      Track order
    </button>
  </section>
</template>
