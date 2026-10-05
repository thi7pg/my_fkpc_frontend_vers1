<script setup>
import { t } from '../../i18n'
import { ClockIcon, PlusIcon, FireIcon } from '@heroicons/vue/24/outline'
import { useRouter } from 'vue-router'
import { formatCurrency } from '../../utils/format'
import { useCartStore } from '../../stores/cart'
import { useToast } from 'vue-toastification'
const props = defineProps({ product: { type: Object, required: true }, currency: { type: String, default: 'USD' } })
const router = useRouter()
const cart = useCartStore()
const toast = useToast()
function openDetail() { router.push({ name: 'product-detail', params: { id: props.product.id } }) }
function quickAdd(event) {
  event.stopPropagation()
  if (!props.product.available) return
  cart.addItem(props.product, 1)
  toast.success(t('Added {name} to cart', { name: props.product.name }))
}
</script>
<template>
  <article class="food-card">
    <button class="food-card-image" :aria-label="$t('View {name}', { name: product.name })" @click="openDetail">
      <img v-if="product.image" :src="product.image" :alt="product.name" loading="lazy" />
      <span v-else class="food-placeholder"><FireIcon /><span>{{ $t("Made to crave") }}</span></span>
      <span v-if="!product.available" class="food-unavailable">{{ $t("Unavailable") }}</span>
    </button>
    <div class="food-card-content">
      <button class="food-card-title" @click="openDetail"><h3>{{ product.name }}</h3></button>
      <p v-if="product.description" class="food-description">{{ product.description }}</p>
      <span v-if="product.preparation_time" class="food-time"><ClockIcon />{{ product.preparation_time }} {{ $t("min") }}</span>
      <div class="food-card-bottom"><strong>{{ formatCurrency(product.price, currency) }}</strong><button class="food-add" :aria-label="$t('Add {name} to cart', { name: product.name })" :disabled="!product.available" @click="quickAdd"><PlusIcon /></button></div>
    </div>
  </article>
</template>
