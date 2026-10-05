<script setup>
import { watch, onUnmounted, ref, nextTick } from 'vue'
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon, ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { useRouter } from 'vue-router'
import { useCartStore } from '../../stores/cart'
import { formatCurrency } from '../../utils/format'
import EmptyState from '../ui/EmptyState.vue'
const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
const cart = useCartStore()
const router = useRouter()
const panel = ref(null)
let previousFocus = null
let previousOverflow = ''
function close() { emit('update:modelValue', false) }
function keydown(event) {
  if (event.key === 'Escape') close()
  if (event.key !== 'Tab' || !panel.value) return
  const elements = [...panel.value.querySelectorAll('button:not(:disabled), a[href], input, textarea, [tabindex="0"]')]
  const first = elements[0], last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
watch(() => props.modelValue, async open => {
  if (open) {
    previousFocus = document.activeElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', keydown)
    await nextTick()
    panel.value?.querySelector('button')?.focus()
  } else {
    document.body.style.overflow = previousOverflow
    document.removeEventListener('keydown', keydown)
    previousFocus?.focus()
  }
})
onUnmounted(() => {
  document.removeEventListener('keydown', keydown)
  if (props.modelValue) document.body.style.overflow = previousOverflow
})
function goCheckout() { close(); router.push({ name: 'checkout' }) }
const currency = () => cart.restaurant?.currency ?? 'USD'
</script>
<template>
  <Teleport to="body">
    <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0" leave-active-class="transition duration-150" leave-to-class="opacity-0"><div v-if="modelValue" class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" @click="close" /></Transition>
    <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="translate-x-full" leave-active-class="transition duration-200 ease-in" leave-to-class="translate-x-full">
      <aside v-if="modelValue" ref="panel" class="customer-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header class="drawer-header"><div><p class="customer-eyebrow">{{ $t("SOMETHING DELICIOUS AWAITS") }}</p><h2 id="drawer-title">{{ $t("Your Order") }}</h2></div><button class="customer-icon-button" :aria-label="$t('Close cart')" @click="close"><XMarkIcon /></button></header>
        <div class="drawer-content">
          <EmptyState v-if="!cart.items.length" :icon="ShoppingBagIcon" :title="$t('Your cart is empty')" :message="$t('Add your favourites from the menu.')" />
          <ul v-else class="flex flex-col gap-4">
            <li v-for="(item, index) in cart.items" :key="index" class="card flex gap-3 p-3">
              <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary-50"><img v-if="item.image" :src="item.image" :alt="item.name" class="h-full w-full object-cover" /><img v-else src="/food-illustration.svg" alt="" class="h-full w-full object-contain p-1" /></div>
              <div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><p class="text-sm font-bold">{{ item.name }}</p><button class="customer-icon-button !h-8 !w-8 text-slate-400" :aria-label="$t('Remove {name}', { name: item.name })" @click="cart.removeItem(index)"><TrashIcon class="!h-4 !w-4" /></button></div><p v-if="item.notes" class="text-xs text-slate-500">{{ item.notes }}</p><div class="mt-2 flex flex-wrap items-center justify-between gap-1"><div class="flex items-center rounded-xl bg-[#faf8f6]"><button class="quantity-button" :aria-label="$t('Decrease {name}', { name: item.name })" @click="cart.updateQuantity(index, item.quantity - 1)"><MinusIcon class="h-3.5 w-3.5" /></button><span class="text-xs font-bold">{{ item.quantity }}</span><button class="quantity-button" :aria-label="$t('Increase {name}', { name: item.name })" @click="cart.updateQuantity(index, item.quantity + 1)"><PlusIcon class="h-3.5 w-3.5" /></button></div><strong class="text-xs text-primary-600">{{ formatCurrency(item.price * item.quantity, currency()) }}</strong></div></div>
            </li>
          </ul>
        </div>
        <footer v-if="cart.items.length" class="drawer-footer"><div class="space-y-2 text-sm"><div class="flex justify-between text-slate-500"><span>{{ $t("Subtotal") }}</span><span>{{ formatCurrency(cart.subtotal, currency()) }}</span></div><div v-if="cart.taxAmount" class="flex justify-between text-slate-500"><span>{{ $t("Tax") }}</span><span>{{ formatCurrency(cart.taxAmount, currency()) }}</span></div><div v-if="cart.serviceChargeAmount" class="flex justify-between text-slate-500"><span>{{ $t("Service charge") }}</span><span>{{ formatCurrency(cart.serviceChargeAmount, currency()) }}</span></div><div class="flex justify-between border-t border-[#eee9e8] pt-3 text-lg font-extrabold"><span>{{ $t("Total") }}</span><span class="text-primary-600">{{ formatCurrency(cart.total, currency()) }}</span></div></div><button class="customer-primary" @click="goCheckout">{{ $t("Proceed to Checkout") }}</button></footer>
      </aside>
    </Transition>
  </Teleport>
</template>
