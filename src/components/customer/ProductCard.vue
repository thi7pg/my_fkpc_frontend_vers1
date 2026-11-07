<script setup>
import { kitchenItem } from '../../utils/kitchenItems'
import { productPrice } from '../../utils/productOptions'
import { t } from '../../languages'
import { PlusIcon, FireIcon } from '@heroicons/vue/24/outline'
import { useRouter } from 'vue-router'
import { formatCurrency } from '../../utils/format'
import { useCartStore } from '../../stores/cart'
import { useToast } from 'vue-toastification'
const props = defineProps({
  product: { type: Object, required: true },
  currency: { type: String, default: 'USD' },
})
const router = useRouter()
const cart = useCartStore()
const toast = useToast()
function openDetail() {
  router.push({ name: 'product-detail', params: { id: props.product.id } })
}
function quickAdd(event) {
  event.stopPropagation()
  if (!props.product.available) return
  if (props.product.sizes?.length || props.product.toppings?.length) {
    openDetail()
    return
  }
  cart.addItem(props.product, 1)
  toast.success(t('Added {name} to cart', { name: props.product.name }))
}
</script>
<template>
  <article class="surface-card flex min-w-0 flex-col overflow-hidden">
    <button
      class="group relative block aspect-[1.48] w-full overflow-hidden bg-primary-50"
      :aria-label="$t('View {name}', { name: product.name })"
      @click="openDetail"
    >
      <img
        v-if="product.image"
        :src="product.image"
        :alt="product.name"
        loading="lazy"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transition-none"
      />
      <span
        v-else
        class="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary-50 to-orange-100 text-primary-600"
        ><FireIcon class="h-12 w-12 opacity-70" /><span class="text-[10px] font-semibold">{{
          $t('Made to crave')
        }}</span></span
      >
      <span
        v-if="!product.available"
        class="absolute inset-0 grid place-items-center bg-white/70 text-sm font-bold text-slate-600"
        >{{ $t('Unavailable') }}</span
      >
    </button>
    <div class="flex flex-1 flex-col gap-4 p-3 sm:p-4">
      <button class="text-left" @click="openDetail">
        <h3 class="line-clamp-2 text-sm leading-snug font-bold text-slate-950 sm:text-base">
          {{ kitchenItem({ product }).name }}
        </h3>
      </button>
      <div class="mt-auto flex items-center justify-between gap-2">
        <strong class="min-w-0 break-words text-base font-bold text-primary-600 sm:text-lg">{{
          formatCurrency(productPrice(product, product.sizes?.[0]?.name), currency)
        }}</strong>
        <button
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-600 text-white transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:bg-slate-200 disabled:text-slate-400"
          :aria-label="$t('Add {name} to cart', { name: product.name })"
          :disabled="!product.available"
          @click="quickAdd"
        >
          <PlusIcon class="h-6 w-6" />
        </button>
      </div>
    </div>
  </article>
</template>
