import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useRestaurantStore } from './restaurant'

const STORAGE_KEY = 'cart_state'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useCartStore = defineStore('cart', () => {
  const saved = loadState()
  const branding = useRestaurantStore()
  if (saved?.restaurant && !branding.settings.name) branding.setSettings(saved.restaurant)

  const qrToken = ref(saved?.qrToken ?? null)
  const table = ref(saved?.table ?? null)
  const restaurant = ref(saved?.restaurant ?? null)
  const categories = ref(saved?.categories ?? [])
  const items = ref(
    (saved?.items ?? []).map((item) => ({
      ...item,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
    })),
  )

  const products = computed(() => categories.value.flatMap((c) => c.products ?? []))

  const itemCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const subtotal = computed(() =>
    items.value.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0),
  )
  const taxAmount = computed(() =>
    restaurant.value?.tax_percentage ? subtotal.value * (restaurant.value.tax_percentage / 100) : 0,
  )
  const serviceChargeAmount = computed(() =>
    restaurant.value?.service_charge_percentage
      ? subtotal.value * (restaurant.value.service_charge_percentage / 100)
      : 0,
  )
  const total = computed(() => subtotal.value + taxAmount.value + serviceChargeAmount.value)

  function setContext({ qrToken: token, table: tableInfo, restaurant: restaurantInfo, categories: categoriesInfo }) {
    const currentToken = qrToken.value ? String(qrToken.value) : null
    const nextToken = token ? String(token) : null

    if (currentToken && nextToken && currentToken !== nextToken) {
      items.value = []
    }
    qrToken.value = nextToken
    table.value = tableInfo
    restaurant.value = restaurantInfo
    branding.setSettings(restaurantInfo)
    categories.value = categoriesInfo ?? []
  }

  function findProduct(id) {
    return products.value.find((p) => String(p.id) === String(id)) ?? null
  }

  function addItem(product, quantity = 1, notes = '') {
    const existing = items.value.find((item) => item.productId === product.id && item.notes === notes)
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + Math.max(1, Math.trunc(Number(quantity) || 1)))
      return
    }
    items.value.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: product.image,
      quantity: Math.min(99, Math.max(1, Math.trunc(Number(quantity) || 1))),
      notes,
    })
  }

  function updateQuantity(index, quantity) {
    if (quantity < 1) {
      items.value.splice(index, 1)
      return
    }
    items.value[index].quantity = Math.min(99, Math.max(1, Math.trunc(Number(quantity) || 1)))
  }

  function updateNote(index, notes) {
    items.value[index].notes = notes
  }

  function removeItem(index) {
    items.value.splice(index, 1)
  }

  function clear() {
    items.value = []
  }

  function reset() {
    items.value = []
    qrToken.value = null
    table.value = null
    restaurant.value = null
    categories.value = []
  }

  watch(
    [qrToken, table, restaurant, categories, items],
    () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          qrToken: qrToken.value,
          table: table.value,
          restaurant: restaurant.value,
          categories: categories.value,
          items: items.value,
        }),
      )
    },
    { deep: true },
  )

  return {
    qrToken,
    table,
    restaurant,
    categories,
    products,
    items,
    itemCount,
    subtotal,
    taxAmount,
    serviceChargeAmount,
    total,
    setContext,
    findProduct,
    addItem,
    updateQuantity,
    updateNote,
    removeItem,
    clear,
    reset,
  }
})
