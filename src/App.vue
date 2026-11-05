<script setup>
import { onMounted, watch } from 'vue'
import { useAuthStore } from './stores/auth'
import { useRestaurantStore } from './stores/restaurant'
import { locale, t } from './languages'

const auth = useAuthStore()
const restaurant = useRestaurantStore()

watch(
  () => [restaurant.name, locale.value],
  ([name]) => {
    document.title = `${name} | ${t('Korean Pizza & Chicken')}`
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
