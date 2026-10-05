import api from './api'

export const cashierService = {
  payments(params = {}) {
    return api.get('/cashier/payments', { params })
  },
  pay(orderId) {
    return api.patch(`/cashier/payments/${orderId}/pay`)
  },
}
