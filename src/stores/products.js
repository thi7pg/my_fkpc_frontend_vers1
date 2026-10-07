import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminService } from '../services/adminService'

export const useProductsStore = defineStore('products', () => {
  const products = ref([])
  const meta = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let requestVersion = 0

  async function fetchProducts(params = {}) {
    const version = ++requestVersion
    loading.value = true
    error.value = null
    try {
      const res = await adminService.products.list(params)
      if (version !== requestVersion) return
      products.value = res.data
      meta.value = res.meta ?? null
    } catch (e) {
      if (version === requestVersion) error.value = e.message
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  return { products, meta, loading, error, fetchProducts }
})
