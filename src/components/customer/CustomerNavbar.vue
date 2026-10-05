<script setup>
import LanguageSelector from '../ui/LanguageSelector.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon, MapPinIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '../../stores/cart'
import FantasiaBrand from './FantasiaBrand.vue'
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const showBack = computed(() => !['landing', 'menu'].includes(route.name))
function goBack() { router.push(cart.qrToken ? { name: 'menu', params: { qrToken: cart.qrToken } } : { name: 'landing' }) }
</script>
<template>
  <header class="customer-header">
    <div class="customer-header-inner">
      <button v-if="showBack" class="customer-icon-button header-back" :aria-label="$t('Back to menu')" @click="goBack"><ArrowLeftIcon /></button>
      <FantasiaBrand />
      <div class="header-actions">
        <LanguageSelector />
      </div>
    </div>
    <div v-if="cart.table" class="customer-table-row"><span class="table-badge"><MapPinIcon /><span>{{ $t("Table") }} {{ cart.table.table_number }}</span></span></div>
  </header>
</template>
