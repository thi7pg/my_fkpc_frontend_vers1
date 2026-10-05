import api from './api'

export const orderService = {
  place(payload) {
    return api.post('/orders', payload)
  },
  track(orderNumber) {
    return api.get(`/orders/track/${orderNumber}`)
  },
  list(params = {}) {
    return api.get('/orders', { params })
  },
  get(id) {
    return api.get(`/orders/${id}`)
  },
  updateStatus(id, status, cancelledReason) {
    return api.patch(`/orders/${id}/status`, { status, cancelled_reason: cancelledReason })
  },
}
