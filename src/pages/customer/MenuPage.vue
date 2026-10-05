<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { orderService } from '../../services/orderService'
import { tableOrder } from '../../utils/tableOrders'
import { MagnifyingGlassIcon, FaceFrownIcon } from '@heroicons/vue/24/outline'
import { menuService } from '../../services/menuService'
import { useCartStore } from '../../stores/cart'
import ProductCard from '../../components/customer/ProductCard.vue'
import CategoryTabs from '../../components/customer/CategoryTabs.vue'
import SkeletonLoader from '../../components/ui/SkeletonLoader.vue'
import EmptyState from '../../components/ui/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const cart = useCartStore()

const menu = ref(null)
const loading = ref(true)
const error = ref('')
const search = ref('')
const activeCategory = ref('all')

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
    const previousOrder = tableOrder(res.data.table, qrToken)
    if (previousOrder) {
      try {
        const tracked = await orderService.track(previousOrder)
        if (version !== requestVersion || route.params.qrToken !== qrToken) return
        if (['pending', 'confirmed', 'preparing', 'ready'].includes(tracked.data.status)) {
          await router.replace({ name: 'order-tracking', params: { orderNumber: previousOrder } })
          return
        }
      } catch { /* A missing or temporarily unavailable order must not block the menu. */ }
    }
    if (version !== requestVersion || route.params.qrToken !== qrToken) return
    menu.value = res.data
    activeCategory.value = 'all'
    cart.setContext({ qrToken: menu.value.table.qr_token, table: menu.value.table, restaurant: menu.value.restaurant, categories: menu.value.categories })
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
const allProducts = computed(() => menu.value?.categories.flatMap(c => c.products ?? []) ?? [])
const topSellers = computed(() => allProducts.value
  .filter(p => p.available && (p.is_bestseller === true || Number(p.sales_count) > 0))
  .sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0)).slice(0, 4))
const signatureProducts = computed(() => allProducts.value.filter(p => p.available && p.is_signature === true).slice(0, 4))
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-5">
    <div class="h-12 animate-pulse rounded-xl bg-slate-100" />
    <div class="food-grid">
      <SkeletonLoader variant="card" :count="6" />
    </div>
  </div>
  <EmptyState v-else-if="error" :icon="FaceFrownIcon" :title="$t('Table not found')" :message="error"><button
      class="customer-primary mt-4" @click="loadMenu">{{ $t("Try again") }}</button></EmptyState>
  <div v-else class="menu-page">
    <div class="menu-greeting">
      <div>
        <h1>{{ $t('Our menu') }}</h1>
      </div><span class="menu-dish-count">{{ filteredProducts.length }}</span>
    </div>
    <div class="customer-search">
      <MagnifyingGlassIcon /><input v-model="search" type="search" :aria-label="$t('Search dishes')"
        :placeholder="$t('Search dishes...')" />
    </div>
    <section class="menu-category-section">
      <CategoryTabs v-model="activeCategory" :categories="menu.categories" />
    </section>
    <section v-if="!search.trim() && activeCategory === 'all' && topSellers.length" class="menu-collection">
      <div class="menu-section-heading">
        <h2>{{ $t('Top Sellers') }}</h2>
      </div>
      <div v-if="topSellers.length" class="food-grid">
        <ProductCard v-for="product in topSellers" :key="product.id" :product="product"
          :currency="menu.restaurant.currency" />
      </div>
    </section>
    <section v-if="!search.trim() && activeCategory === 'all' && signatureProducts.length" class="menu-collection">
      <div class="menu-section-heading">
        <h2>{{ $t('Signature') }}</h2>
      </div>
      <div v-if="signatureProducts.length" class="food-grid">
        <ProductCard v-for="product in signatureProducts" :key="product.id" :product="product"
          :currency="menu.restaurant.currency" />
      </div>
    </section>
    <div class="menu-section-heading">
      <div>
        <h2>{{activeCategory === 'all' ? $t("All") : menu.categories.find(c => c.id === activeCategory)?.name}}
        </h2>
      </div>
    </div>
    <EmptyState v-if="filteredProducts.length === 0" :title="$t('No dishes found')"
      :message="$t('Try a different search term or category.')" />
    <div v-else id="menu-foods" class="food-grid">
      <ProductCard v-for="product in filteredProducts" :key="product.id" :product="product"
        :currency="menu.restaurant.currency" />
    </div>
  </div>
</template>
  
