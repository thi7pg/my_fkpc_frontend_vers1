<script setup>
import { onMounted, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { useRestaurantStore } from './stores/restaurant'
import { locale, t } from './languages'

const auth = useAuthStore()
const restaurant = useRestaurantStore()

watch(
  () => [restaurant.name, restaurant.logo, locale.value],
  ([name, logo]) => {
    document.title = `${name} | ${t('Korean Pizza & Chicken')}`
    const icon = document.querySelector('link[rel="icon"]')
    if (icon) {
      icon.removeAttribute('type')
      icon.href = logo || '/favicon.svg'
    }
  },
  { immediate: true },
)

onMounted(async () => {
  if (!auth.token) return
  try {
    await auth.fetchMe()
  } catch {
    // Session expiry is handled by the API interceptor.
  }
})
</script>

<template>
  <RouterView />
</template>
