<script setup>
import { t } from '../../languages'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { menuService } from '../../services/menuService'
import { orderService } from '../../services/orderService'
import { useCartStore } from '../../stores/cart'
import { formatCurrency } from '../../utils/format'
import { rememberTableOrder } from '../../utils/tableOrders'

const cart = useCartStore()
const router = useRouter()
const toast = useToast()

const paymentMethod = ref('cash')
const submitting = ref(false)
const error = ref('')
const quote = ref(null)
const validating = ref(false)

const currency = computed(() => cart.restaurant?.currency ?? 'USD')

function cartLines() {
  return cart.items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    notes: item.notes || undefined,
  }))
}

async function validateCart() {
  if (!cart.qrToken || !cart.table || !cart.items.length) {
    quote.value = null
    router.replace({ name: 'cart' })
    return false
  }
  validating.value = true
  try {
    const res = await menuService.validateCart(cart.qrToken, cartLines())
    quote.value = res.data
    error.value = ''
    return true
  } catch (e) {
    quote.value = null
    if (e.status === 404) cart.reset()
    error.value = e.message
    return false
  } finally {
    validating.value = false
  }
}

onMounted(validateCart)

async function submitOrder() {
  if (submitting.value || validating.value) return
  submitting.value = true
  error.value = ''
  try {
    const previousQuote = JSON.stringify(quote.value)
    if (!(await validateCart())) return
    if (previousQuote !== JSON.stringify(quote.value)) {
      error.value = 'Your order summary has changed. Review it and confirm again.'
      return
    }
    const payload = {
      payment_method: paymentMethod.value,
      qr_token: cart.qrToken,
      customer_name: `Table ${cart.table.table_number}`,
      items: cart.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes || undefined,
      })),
    }
    const res = await orderService.place(payload)
    const orderNumber = res.data.order_number
    rememberTableOrder(cart.table, cart.qrToken, orderNumber)
    cart.clear()
    toast.success(t('Order placed! Track your food below.'))
    if (res.data.payment_token) {
      try {
        sessionStorage.setItem('demo_payment_' + orderNumber, res.data.payment_token)
        router.push({ name: 'acleda-payment', params: { orderNumber } })
      } catch {
        toast.info(t('Your order was placed. Please pay the cashier.'))
        router.push({ name: 'order-tracking', params: { orderNumber } })
      }
    } else {
      router.push({ name: 'order-tracking', params: { orderNumber } })
    }
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="checkout-page flex flex-col gap-5 pb-28">
    <div class="customer-page-heading">
      <h1>{{ $t('Checkout') }}</h1>
    </div>
    <div class="card p-5">
      <label for="payment-method" class="block mb-2 font-semibold">Payment method</label>
      <select
        id="payment-method"
        v-model="paymentMethod"
        :disabled="submitting"
        class="w-full rounded-xl border p-3"
      >
        <option value="cash">Cash — pay the cashier</option>
        <option value="acleda">ACLEDA QR</option>
      </select>
      <p v-if="paymentMethod === 'acleda'" class="mt-2 text-sm text-slate-500">
        Test payment — no money transferred.
      </p>
    </div>
    <div v-if="quote" class="card p-5">
      <h2 class="mb-3 font-semibold text-slate-900 dark:text-slate-100">
        {{ $t('Order Summary') }}
      </h2>
      <ul class="flex flex-col gap-2 text-sm">
        <li
          v-for="(item, index) in quote.items"
          :key="index"
          class="flex justify-between text-slate-600 dark:text-slate-300"
        >
          <span>{{ item.quantity }}&times; {{ item.product_name }}</span>
          <span>{{ formatCurrency(item.subtotal, currency) }}</span>
        </li>
      </ul>
      <div class="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
        <div class="flex justify-between text-slate-500 dark:text-slate-400">
          <span>{{ $t('Subtotal') }}</span>
          <span>{{ formatCurrency(quote.subtotal, currency) }}</span>
        </div>
        <div
          v-if="quote.tax_amount > 0"
          class="flex justify-between text-slate-500 dark:text-slate-400"
        >
          <span>{{ $t('Tax') }}</span>
          <span>{{ formatCurrency(quote.tax_amount, currency) }}</span>
        </div>
        <div
          v-if="quote.service_charge_amount > 0"
          class="flex justify-between text-slate-500 dark:text-slate-400"
        >
          <span>{{ $t('Service charge') }}</span>
          <span>{{ formatCurrency(quote.service_charge_amount, currency) }}</span>
        </div>
        <div class="flex justify-between text-base font-bold text-slate-900 dark:text-slate-100">
          <span>{{ $t('Total') }}</span>
          <span>{{ formatCurrency(quote.total_amount, currency) }}</span>
        </div>
      </div>
    </div>

    <button
      v-if="!quote && !validating && cart.items.length"
      class="customer-primary"
      @click="validateCart"
    >
      {{ $t('Try again') }}
    </button>
    <p v-if="validating" role="status">{{ $t('Checking your cart...') }}</p>
    <p v-if="error" role="alert" class="checkout-error text-sm font-medium text-danger-600">
      {{ $t(error) }}
    </p>

    <div v-if="quote" class="customer-action-bar">
      <div>
        <div class="action-total">
          <small>{{ $t('Total to pay') }}</small
          ><strong>{{ formatCurrency(quote.total_amount, currency) }}</strong>
        </div>
        <button class="customer-primary" :disabled="submitting || validating" @click="submitOrder">
          {{ submitting ? $t('Placing Order...') : $t('Confirm Order') }}
        </button>
      </div>
    </div>
  </div>
</template>
