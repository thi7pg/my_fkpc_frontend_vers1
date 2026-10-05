<script setup>
import { ref, watch } from 'vue'
import { useRestaurantStore } from '../../stores/restaurant'
defineProps({ light: Boolean })
const restaurant = useRestaurantStore()
const logoFailed = ref(false)
watch(() => restaurant.logo, () => { logoFailed.value = false })
</script>
<template>
  <div class="fantasia-brand" :class="{ 'fantasia-brand-light': light }" aria-label="Fantasia Korean Pizza and Chicken">
    <img v-if="restaurant.logo && !logoFailed" :src="restaurant.logo" alt="Fantasia restaurant logo" class="brand-logo" @error="logoFailed = true" />
    <span v-else class="brand-emblem" aria-hidden="true">F<span>&#10022;</span></span>
    <div><span class="brand-wordmark">Fantasia</span><span class="brand-tagline">{{ $t("KOREAN PIZZA & CHICKEN") }}</span></div>
  </div>
</template>
