import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminService } from '../services/adminService'

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchSummary() {
    loading.value = true
    error.value = null
    try {
      const res = await adminService.dashboard()
      summary.value = res.data
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, error, fetchSummary }
})
