import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminService } from '../services/adminService'

export const useProductsStore = defineStore('products', () => {
  const products = ref([])
  const meta = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchProducts(params = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await adminService.products.list(params)
      products.value = res.data
      meta.value = res.meta ?? null
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { products, meta, loading, error, fetchProducts }
})
