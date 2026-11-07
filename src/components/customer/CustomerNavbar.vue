<script setup>
import LanguageSelector from '../ui/LanguageSelector.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { useCartStore } from '../../stores/cart'
import FantasiaBrand from './FantasiaBrand.vue'
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const showBack = computed(() => !['landing', 'menu'].includes(route.name))
const isCart = computed(() => route.name === 'cart')
const isTracking = computed(() => route.name === 'order-tracking')
function goBack() {
  router.push(
    cart.qrToken ? { name: 'menu', params: { qrToken: cart.qrToken } } : { name: 'landing' },
  )
}
</script>
<template>
  <header
    class="sticky top-0 z-30 border-b"
    :class="
      isTracking
        ? 'border-slate-100 bg-white text-slate-800'
        : 'border-primary-700 bg-primary-600 text-white'
    "
  >
    <div
      class="mx-auto flex max-w-[1000px] items-center gap-3 px-4 py-3 sm:px-6"
      :class="isCart || isTracking ? 'min-h-20' : 'min-h-24'"
    >
      <button
        v-if="showBack"
        type="button"
        class="grid h-11 w-11 shrink-0 place-items-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2"
        :class="
          isTracking
            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 focus-visible:outline-primary-600'
            : 'border-white/30 bg-white/10 hover:bg-white/20 focus-visible:outline-white'
        "
        :aria-label="$t('Back to menu')"
        @click="goBack"
      >
        <ArrowLeftIcon class="h-5 w-5" />
      </button>
      <FantasiaBrand
        v-if="
          !isCart &&
          !isTracking &&
          !['receipt', 'session-checkout', 'product-detail'].includes(route.name)
        "
        :light="!isTracking"
        :compact="showBack"
        :logo-only="isTracking"
        class="min-w-0"
        :class="{
          '[&>img]:h-10! [&>img]:w-10!': isTracking,
        }"
      />
      <div v-if="isCart" class="min-w-0 flex-1">
        <h1 class="truncate text-base font-bold leading-tight sm:text-lg">{{ $t('Your Cart') }}</h1>
        <p v-if="cart.table" class="mt-1 text-xs font-medium text-white/80">
          {{ $t('Table') }} {{ cart.table.table_number }}
        </p>
      </div>
      <div class="ml-auto flex shrink-0 flex-col items-end gap-2">
        <LanguageSelector :light="!isTracking" />
        <span
          v-if="cart.table && !isCart"
          class="rounded-full border px-2.5 py-1 text-[10px] font-medium"
          :class="
            isTracking
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-white/40 text-white'
          "
          >{{ $t('Table') }} {{ cart.table.table_number }}</span
        >
      </div>
    </div>
  </header>
</template>
