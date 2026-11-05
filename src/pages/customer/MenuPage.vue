<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { tableOrder, forgetSessionOrders } from '../../utils/tableOrders'
import { orderService } from '../../services/orderService'
import { MagnifyingGlassIcon, FaceFrownIcon } from '@heroicons/vue/24/outline'
import { menuService } from '../../services/menuService'
import { useCartStore } from '../../stores/cart'
import ProductCard from '../../components/customer/ProductCard.vue'
import CategoryTabs from '../../components/customer/CategoryTabs.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const route = useRoute()
const cart = useCartStore()

const menu = ref(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const activeCategory = ref('all')
const previousOrderNumber = ref(null)
const browseAll = ref(false)

let requestVersion = 0
async function loadMenu() {
  const version = ++requestVersion
  const qrToken = route.params.qrToken
  if (cart.qrToken !== qrToken && cart.table?.table_number !== qrToken) cart.reset()
  menu.value = null
  loading.value = true
  error.value = ''
  try {
    const res = await menuService.getMenu(qrToken)
    if (version !== requestVersion || route.params.qrToken !== qrToken) return
    previousOrderNumber.value = tableOrder(res.data.table, qrToken)
    if (previousOrderNumber.value) {
      try {
        const response = await orderService.bill(previousOrderNumber.value)
        if (version !== requestVersion || route.params.qrToken !== qrToken) return
        if (response.data.closed_at) {
          const currentVisit = forgetSessionOrders(
            response.data.orders.map((order) => order.order_number),
            cart.qrToken,
          )
          if (currentVisit) cart.clear()
          previousOrderNumber.value = null
        }
      } catch {
        // The menu remains available when a previous visit cannot be refreshed.
      }
    }
    if (version !== requestVersion || route.params.qrToken !== qrToken) return
    menu.value = res.data
    activeCategory.value = 'all'
    cart.setContext({
      qrToken: menu.value.table.qr_token,
      table: menu.value.table,
      restaurant: menu.value.restaurant,
      categories: menu.value.categories,
    })
  } catch (e) {
    if (version === requestVersion) {
      if (e.status === 404) cart.reset()
      error.value = e.message
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

onMounted(loadMenu)
watch(() => route.params.qrToken, loadMenu)
onUnmounted(() => requestVersion++)

const filteredProducts = computed(() => {
  if (!menu.value) return []
  let categories = menu.value.categories
  if (activeCategory.value !== 'all') {
    categories = categories.filter((c) => c.id === activeCategory.value)
  }
  let products = categories.flatMap((c) => c.products ?? [])
  if (search.value.trim()) {
    const term = search.value.trim().toLowerCase()
    products = products.filter((p) => p.name.toLowerCase().includes(term))
  }
  return products
})
const allProducts = computed(() => menu.value?.categories.flatMap((c) => c.products ?? []) ?? [])
const topSellers = computed(() =>
  allProducts.value
    .filter((p) => p.available && (p.is_bestseller === true || Number(p.sales_count) > 0))
    .sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0))
    .slice(0, 4),
)
const showingPopular = computed(
  () =>
    !browseAll.value &&
    !search.value.trim() &&
    activeCategory.value === 'all' &&
    topSellers.value.length > 0,
)
const displayedProducts = computed(() =>
  showingPopular.value ? topSellers.value : filteredProducts.value,
)
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-5" :aria-label="$t('Loading...')">
    <div class="h-12 animate-pulse rounded-xl bg-slate-100" />
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <SkeletonLoader variant="card" :count="6" />
    </div>
  </div>
  <EmptyState
    v-else-if="error"
    :icon="FaceFrownIcon"
    :title="$t('Table not found')"
    :message="error"
    ><button class="customer-primary mt-4" @click="loadMenu">
      {{ $t('Try again') }}
    </button></EmptyState
  >
  <div v-else class="flex min-w-0 flex-col gap-5 sm:gap-6">
    <h1 class="sr-only">{{ $t('Our menu') }}</h1>
    <RouterLink
      v-if="previousOrderNumber"
      :to="{ name: 'order-tracking', params: { orderNumber: previousOrderNumber } }"
      class="block rounded-xl bg-primary-50 p-3 text-center text-sm font-semibold text-primary-600"
      >{{ $t('View previous order') }} &middot; #{{ previousOrderNumber }}</RouterLink
    >
    <label
      class="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:ring-2 focus-within:ring-primary-500"
    >
      <MagnifyingGlassIcon class="h-6 w-6 shrink-0 text-slate-500" />
      <input
        v-model="search"
        type="search"
        :aria-label="$t('Search dishes')"
        :placeholder="$t('Search food...')"
        class="min-w-0 flex-1 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
    </label>
    <CategoryTabs v-model="activeCategory" :categories="menu.categories" />
    <section class="flex flex-col gap-4" :aria-label="$t('Our menu')">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-slate-950 sm:text-xl">
          {{
            showingPopular
              ? $t('Popular')
              : activeCategory === 'all'
                ? $t('All')
                : menu.categories.find((category) => category.id === activeCategory)?.name
          }}
        </h2>
        <button
          v-if="showingPopular"
          type="button"
          class="min-h-11 font-semibold text-primary-600 hover:text-primary-700"
          @click="browseAll = true"
        >
          {{ $t('See All') }}
        </button>
        <span v-else class="text-xs text-slate-400"
          >{{ displayedProducts.length }} {{ $t('Items') }}</span
        >
      </div>
      <EmptyState
        v-if="!displayedProducts.length"
        :title="$t('No dishes found')"
        :message="$t('Try a different search term or category.')"
      />
      <div
        v-else
        id="menu-foods"
        class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4"
      >
        <ProductCard
          v-for="product in displayedProducts"
          :key="product.id"
          :product="product"
          :currency="menu.restaurant.currency"
        />
      </div>
    </section>
  </div>
</template>
