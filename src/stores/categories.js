import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminService } from '../services/adminService'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchCategories(params = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await adminService.categories.list(params)
      categories.value = res.data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { categories, loading, error, fetchCategories }
})
