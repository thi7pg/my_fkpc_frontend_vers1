<script setup>
import { ref, watch } from 'vue'
import { useRestaurantStore } from '../../stores/restaurant'
defineProps({ light: Boolean, compact: Boolean, logoOnly: Boolean })
const restaurant = useRestaurantStore()
const logoFailed = ref(false)
watch(
  () => restaurant.logo,
  () => {
    logoFailed.value = false
  },
)
</script>
<template>
  <div
    class="flex min-w-0 items-center gap-2.5"
    translate="no"
    :class="light ? 'text-white' : 'text-primary-600'"
    aria-label="Fantasia Korean Pizza and Chicken"
  >
    <img
      v-if="restaurant.logo && !logoFailed"
      :src="restaurant.logo"
      alt="Fantasia restaurant logo"
      class="h-12 w-12 shrink-0 rounded-xl bg-white object-contain sm:h-14 sm:w-14"
      @error="logoFailed = true"
    />
    <span
      v-else
      class="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-400 font-serif text-3xl font-bold italic text-primary-600"
      aria-hidden="true"
      >F</span
    >
    <div v-if="!logoOnly" class="min-w-0" :class="{ 'hidden min-[450px]:block': compact }">
      <span
        class="block font-serif text-[27px] leading-none font-bold tracking-tighter italic sm:text-4xl"
        >Fantasia</span
      >
      <span class="mt-1 block text-[5px] font-bold tracking-[0.07em] sm:text-[7px]"
        >KOREAN PIZZA &amp; CHICKEN</span
      >
    </div>
  </div>
</template>
