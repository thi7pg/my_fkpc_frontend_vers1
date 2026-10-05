<script setup>
import '../customer.css'
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HomeIcon, ListBulletIcon, ShoppingCartIcon, DocumentTextIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '../stores/cart'
import CustomerNavbar from '../components/customer/CustomerNavbar.vue'
import CartDrawer from '../components/customer/CartDrawer.vue'
const cartOpen = ref(false)
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const menuRoute = computed(() => cart.qrToken ? { name: 'menu', params: { qrToken: cart.qrToken } } : { name: 'landing' })
const navVisible = computed(() => !['product-detail', 'checkout'].includes(route.name))
function openOrders() {
  const lastOrder = localStorage.getItem('fantasia_last_order')
  router.push(lastOrder ? { name: 'order-tracking', params: { orderNumber: lastOrder } } : { name: 'landing', query: { orders: '1' } })
}
</script>
<template>
  <div class="customer-app" :class="{ 'has-bottom-nav': navVisible }">
    <CustomerNavbar />
    <main class="customer-main"><RouterView /></main>
    <nav v-if="navVisible" class="customer-bottom-nav" :aria-label="$t('Customer navigation')">
      <RouterLink :to="{ name: 'landing' }" :class="{ active: route.name === 'landing' }"><HomeIcon /><span>{{ $t("Home") }}</span></RouterLink>
      <RouterLink :to="menuRoute" :class="{ active: route.name === 'menu' }"><ListBulletIcon /><span>{{ $t("Menu") }}</span></RouterLink>
      <RouterLink :to="{ name: 'cart' }" :class="{ active: route.name === 'cart' }"><span class="nav-icon-wrap"><ShoppingCartIcon /><i v-if="cart.itemCount">{{ cart.itemCount }}</i></span><span>{{ $t("Cart") }}</span></RouterLink>
      <button :class="{ active: route.name === 'order-tracking' }" @click="openOrders"><DocumentTextIcon /><span>{{ $t("Orders") }}</span></button>
    </nav>
    <CartDrawer v-model="cartOpen" />
  </div>
</template>
