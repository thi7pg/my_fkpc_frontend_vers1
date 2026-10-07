import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminService } from '../services/adminService'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([])
  const loading = ref(false)
  const error = ref(null)
  let requestVersion = 0

  async function fetchCategories(params = {}) {
    const version = ++requestVersion
    loading.value = true
    error.value = null
    try {
      const res = await adminService.categories.list(params)
      if (version !== requestVersion) return
      categories.value = res.data
    } catch (e) {
      if (version === requestVersion) error.value = e.message
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  return { categories, loading, error, fetchCategories }
})
