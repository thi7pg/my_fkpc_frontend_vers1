import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import defaultBrand from '../assets/restaurant-brand.json'

const STORAGE_KEY = 'restaurant_brand'

export const useRestaurantStore = defineStore('restaurant', () => {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
  const settings = ref(saved && typeof saved === 'object' ? saved : {})
  const logo = computed(() => settings.value.logo || defaultBrand.logo)
  const name = computed(() => settings.value.name || defaultBrand.name || 'Fantasia')

  function setSettings(next) {
    if (!next || typeof next !== 'object') return
    settings.value = { ...settings.value, ...next }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: name.value, logo: logo.value }))
  }

  return { settings, logo, name, setSettings }
})
