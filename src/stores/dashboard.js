import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminService } from '../services/adminService'

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let requestVersion = 0

  async function fetchSummary() {
    const version = ++requestVersion
    loading.value = true
    error.value = null
    try {
      const res = await adminService.dashboard()
      if (version !== requestVersion) return
      summary.value = res.data
    } catch (e) {
      if (version === requestVersion) error.value = e.message
    } finally {
      if (version === requestVersion) loading.value = false
    }
  }

  return { summary, loading, error, fetchSummary }
})
