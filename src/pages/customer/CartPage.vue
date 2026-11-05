<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MinusIcon, PlusIcon, TrashIcon, ShoppingCartIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '../../stores/cart'
import { formatCurrency } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState.vue'
import { menuService } from '../../services/menuService'
import { orderService } from '../../services/orderService'
import { rememberTableOrder, tableOrder } from '../../utils/tableOrders'

const cart = useCartStore()
const router = useRouter()
const submitting = ref(false)
const error = ref('')
const quote = ref(null)
let disposed = false
onUnmounted(() => {
  disposed = true
})
const totals = computed(
  () =>
    quote.value || {
      subtotal: cart.subtotal,
      tax_amount: cart.taxAmount,
      total_amount: cart.total,
    },
)
watch(
  () => cart.items,
  () => {
    quote.value = null
    error.value = ''
  },
  { deep: true },
)

async function placeOrder() {
  if (submitting.value || !cart.items.length) return
  if (!cart.qrToken || !cart.table) {
    error.value = 'Please scan your table QR code again.'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const qrToken = cart.qrToken
    const table = { ...cart.table }
    const previousOrderNumber = tableOrder(table, qrToken)
    const submittedCart = JSON.stringify(cart.items)
    const items = cart.items.map((item) => ({
      product_id: item.productId,
      size: item.size || undefined,
      toppings: [...(item.toppings || [])],
      quantity: item.quantity,
      notes: item.notes || undefined,
    }))
    const previousTotal = Math.round(Number(totals.value.total_amount) * 100)
    const response = await menuService.validateCart(qrToken, items)
    if (disposed) return
    quote.value = response.data
    if (Math.round(Number(quote.value.total_amount) * 100) !== previousTotal) {
      error.value = 'Your order summary has changed. Review it and confirm again.'
      return
    }
    const result = await orderService.place({
      payment_method: 'cash',
      qr_token: qrToken,
      customer_name: `Table ${table.table_number}`,
      items,
    })
    const orderNumber = result.data.order_number
    const sameTable = cart.qrToken === qrToken && cart.table?.table_number === table.table_number
    if (tableOrder(table, qrToken) === previousOrderNumber) {
      rememberTableOrder(table, qrToken, orderNumber, sameTable)
    }
    if (sameTable && JSON.stringify(cart.items) === submittedCart) {
      cart.clear()
    }
    if (!disposed) await router.push({ name: 'order-tracking', params: { orderNumber } })
  } catch (e) {
    if (disposed) return
    const details = Object.values(e.errors || {})
      .flat()
      .filter((value) => typeof value === 'string')
    error.value = details.length ? details.join(' ') : e.message
  } finally {
    submitting.value = false
  }
}

const currency = computed(() => cart.restaurant?.currency ?? 'USD')

function backToMenu() {
  router.push(
    cart.qrToken ? { name: 'menu', params: { qrToken: cart.qrToken } } : { name: 'landing' },
  )
}
</script>

<template>
  <div class="cart-page flex flex-col gap-5">
    <EmptyState
      v-if="cart.items.length === 0"
      :icon="ShoppingCartIcon"
      :title="$t('Your cart is empty')"
      :message="$t('Browse the menu and add some delicious items.')"
    >
      <button
        class="mt-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
        @click="backToMenu"
      >
        {{ $t('Browse Menu') }}
      </button>
    </EmptyState>

    <template v-else>
      <fieldset :disabled="submitting" class="min-w-0">
        <ul class="flex flex-col gap-3">
          <li v-for="(item, index) in cart.items" :key="index" class="card flex gap-4 p-4">
            <div
              class="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              <img
                v-if="item.image"
                :src="item.image"
                :alt="item.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col">
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-slate-900 dark:text-slate-100">{{ item.name }}</p>
                <button
                  :aria-label="$t('Remove {name}', { name: item.name })"
                  class="customer-icon-button cart-remove text-slate-400 hover:text-danger-600"
                  @click="cart.removeItem(index)"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
              <input
                v-model="item.notes"
                :aria-label="$t('Special Note (optional)') + ': ' + item.name"
                type="text"
                :placeholder="$t('Add a note…')"
                class="mt-1 w-full max-w-xs rounded-lg border border-transparent bg-slate-50 px-2 py-1 text-xs text-slate-500 focus:border-primary-300 focus:bg-white focus:outline-none dark:bg-slate-800 dark:focus:bg-slate-900"
              />
              <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div
                  class="flex items-center gap-2 rounded-full border border-slate-200 px-1.5 py-0.5 dark:border-slate-700"
                >
                  <button
                    :aria-label="$t('Decrease {name}', { name: item.name })"
                    class="quantity-button text-slate-500 hover:text-primary-600"
                    @click="cart.updateQuantity(index, item.quantity - 1)"
                  >
                    <MinusIcon class="h-3.5 w-3.5" />
                  </button>
                  <span class="w-5 text-center text-sm font-medium">{{ item.quantity }}</span>
                  <button
                    :aria-label="$t('Increase {name}', { name: item.name })"
                    class="quantity-button text-slate-500 hover:text-primary-600"
                    @click="cart.updateQuantity(index, item.quantity + 1)"
                  >
                    <PlusIcon class="h-3.5 w-3.5" />
                  </button>
                </div>
                <span class="font-semibold text-slate-900 dark:text-slate-100">
                  {{ formatCurrency(item.price * item.quantity, currency) }}
                </span>
              </div>
            </div>
          </li>
        </ul>
      </fieldset>

      <div class="card space-y-2 p-5">
        <div class="flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>{{ $t('Subtotal') }}</span>
          <span>{{ formatCurrency(totals.subtotal, currency) }}</span>
        </div>
        <div
          v-if="totals.tax_amount > 0"
          class="flex justify-between text-sm text-slate-500 dark:text-slate-400"
        >
          <span>{{ $t('Tax') }}</span>
          <span>{{ formatCurrency(totals.tax_amount, currency) }}</span>
        </div>
        <div
          class="flex justify-between border-t border-slate-100 pt-2 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100"
        >
          <span>{{ $t('Total') }}</span>
          <span>{{ formatCurrency(totals.total_amount, currency) }}</span>
        </div>
      </div>

      <p v-if="error" role="alert" class="text-sm font-medium text-danger-600">{{ $t(error) }}</p>
      <div class="cart-actions">
        <button
          class="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          @click="backToMenu"
          :disabled="submitting"
        >
          {{ $t('Add More Items') }}
        </button>
        <button class="customer-primary flex-1" :disabled="submitting" @click="placeOrder">
          {{ $t(submitting ? 'Placing Order...' : 'Place Order') }}
        </button>
      </div>
    </template>
  </div>
</template>
