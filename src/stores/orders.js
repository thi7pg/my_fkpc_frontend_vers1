import { defineStore } from 'pinia'
import { ref } from 'vue'
import { orderService } from '../services/orderService'

export const useOrdersStore = defineStore('orders', () => {
  const orders = ref([])
  const meta = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchOrders(params = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await orderService.list(params)
      orders.value = res.data
      meta.value = res.meta ?? null
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function updateStatus(id, status, cancelledReason) {
    const res = await orderService.updateStatus(id, status, cancelledReason)
    const index = orders.value.findIndex((order) => order.id === id)
    if (index !== -1) orders.value[index] = res.data
    return res.data
  }

  return { orders, meta, loading, error, fetchOrders, updateStatus }
})
