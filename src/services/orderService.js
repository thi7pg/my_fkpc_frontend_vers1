import api from './api'

export const orderService = {
  sessionReceipt(orderNumber) {
    return api.get(`/orders/track/${encodeURIComponent(orderNumber)}/receipt`)
  },
  bill(orderNumber) {
    return api.get(`/orders/track/${orderNumber}/bill`)
  },
  requestCheckout(orderNumber) {
    return api.post(`/orders/track/${encodeURIComponent(orderNumber)}/checkout`)
  },
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
    return api.get(`/orders/${encodeURIComponent(id)}`)
  },
  updateStatus(id, status, cancelledReason) {
    return api.patch(`/orders/${id}/status`, { status, cancelled_reason: cancelledReason })
  },
}
