<script setup>
import { t } from '../../i18n'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MinusIcon, PlusIcon, ClockIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import { menuService } from '../../services/menuService'
import { useCartStore } from '../../stores/cart'
import { formatCurrency } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const toast = useToast()

const product = ref(null)
const loading = ref(true)
const error = ref('')
const quantity = ref(1)
const note = ref('')

async function load() {
  loading.value = true
  error.value = ''

  const cached = cart.findProduct(route.params.id)
  if (cached) {
    product.value = cached
    loading.value = false
    return
  }

  if (!cart.qrToken) {
    error.value = t("Please scan your table's QR code to view the menu.")
    loading.value = false
    return
  }

  try {
    const res = await menuService.getMenu(cart.qrToken)
    cart.setContext({
      qrToken: cart.qrToken,
      table: res.data.table,
      restaurant: res.data.restaurant,
      categories: res.data.categories,
    })
    product.value = cart.findProduct(route.params.id)
    if (!product.value) error.value = t('This item is no longer available.')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const currency = computed(() => cart.restaurant?.currency ?? 'USD')
const lineTotal = computed(() => (product.value ? product.value.price * quantity.value : 0))

function addToCart() {
  cart.addItem(product.value, quantity.value, note.value.trim())
  toast.success(t('Added {name} to cart', { name: product.value.name }))
  router.push({ name: 'menu', params: { qrToken: cart.qrToken } })
}
</script>

<template>
  <div v-if="loading" class="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  <div v-else-if="error" class="py-20 text-center text-danger-600">{{ $t(error) }}</div>

  <div v-else-if="product" class="product-page flex flex-col gap-5 pb-28">
    <div class="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
      <img v-if="product.image" :src="product.image" :alt="product.name" class="h-full w-full object-cover" />
      <div v-else class="flex h-full items-center justify-center bg-[#fff0d6]"><img src="/food-illustration.svg" alt="Pizza illustration" class="h-full p-5" /></div>
    </div>

    <div>
      <div class="flex items-start justify-between gap-4">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">{{ product.name }}</h1>
        <span class="shrink-0 text-xl font-bold text-primary-600 dark:text-primary-400">
          {{ formatCurrency(product.price, currency) }}
        </span>
      </div>
      <p v-if="product.preparation_time" class="mt-1 flex items-center gap-1 text-sm text-slate-400">
        <ClockIcon class="h-4 w-4" /> {{ product.preparation_time }} {{ $t("min") }} </p>
      <p v-if="product.description" class="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {{ product.description }}
      </p>
      <p v-if="!product.available" class="mt-3 text-sm font-medium text-danger-600"> {{ $t("This item is currently unavailable.") }} </p>
    </div>

    <div class="card p-4">
      <label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">{{ $t("Quantity") }}</label>
      <div class="flex w-fit items-center gap-4 rounded-full border border-slate-200 px-2 py-1 dark:border-slate-700">
        <button :aria-label="$t('Decrease quantity')" class="quantity-button text-slate-500 hover:text-primary-600" @click="quantity = Math.max(1, quantity - 1)">
          <MinusIcon class="h-4 w-4" />
        </button>
        <span class="w-6 text-center font-semibold">{{ quantity }}</span>
        <button :aria-label="$t('Increase quantity')" class="quantity-button text-slate-500 hover:text-primary-600" @click="quantity++">
          <PlusIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="card p-4">
      <label for="note" class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"> {{ $t("Special Note (optional)") }} </label>
      <textarea
        id="note"
        v-model="note"
        rows="3"
        :placeholder="$t('E.g. no onions, extra spicy…')"
        class="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      />
    </div>

    <div class="customer-action-bar"><div><div class="action-total"><small>{{ $t("Your selection") }}</small><strong>{{ formatCurrency(lineTotal, currency) }}</strong></div><button class="customer-primary" :disabled="!product.available" @click="addToCart">{{ $t("Add to Cart") }}</button></div></div>
  </div>
</template>
