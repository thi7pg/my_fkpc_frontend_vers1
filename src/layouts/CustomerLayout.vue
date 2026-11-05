<script setup>
import '../customer.css'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  HomeIcon,
  BookOpenIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/vue/24/outline'
import { useCartStore } from '../stores/cart'
import CustomerNavbar from '../components/customer/CustomerNavbar.vue'
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const menuRoute = computed(() =>
  cart.qrToken ? { name: 'menu', params: { qrToken: cart.qrToken } } : { name: 'landing' },
)
const navVisible = computed(() => !['product-detail', 'order-tracking'].includes(route.name))
const ordersActive = computed(
  () =>
    ['order-tracking', 'session-checkout', 'receipt'].includes(route.name) ||
    (route.name === 'landing' && route.query.orders === '1'),
)
function openOrders() {
  const lastOrder = localStorage.getItem('fantasia_last_order')
  router.push(
    lastOrder
      ? { name: 'order-tracking', params: { orderNumber: lastOrder } }
      : { name: 'landing', query: { orders: '1' } },
  )
}
</script>
<template>
  <div class="customer-app bg-[#f7f7f7]!" :class="{ 'has-bottom-nav': navVisible }">
    <CustomerNavbar />
    <main class="customer-main" :class="{ 'px-5! py-4! sm:px-6! sm:py-6!': route.name === 'menu' }">
      <RouterView />
    </main>
    <nav v-if="navVisible" class="customer-bottom-nav" :aria-label="$t('Customer navigation')">
      <RouterLink
        :to="{ name: 'landing' }"
        :class="{ active: route.name === 'landing' && !ordersActive }"
        ><HomeIcon aria-hidden="true" /><span>{{ $t('Home') }}</span></RouterLink
      >
      <RouterLink :to="menuRoute" :class="{ active: route.name === 'menu' }"
        ><BookOpenIcon aria-hidden="true" /><span>{{ $t('Menu') }}</span></RouterLink
      >
      <RouterLink :to="{ name: 'cart' }" :class="{ active: route.name === 'cart' }"
        ><span class="nav-icon-wrap"
          ><ShoppingCartIcon aria-hidden="true" /><i v-if="cart.itemCount">{{
            cart.itemCount
          }}</i></span
        ><span>{{ $t('Cart') }}</span></RouterLink
      >
      <button
        type="button"
        :class="{ active: ordersActive }"
        :aria-current="ordersActive ? 'page' : undefined"
        @click="openOrders"
      >
        <ClipboardDocumentListIcon aria-hidden="true" /><span>{{ $t('Orders') }}</span>
      </button>
    </nav>
  </div>
</template>
