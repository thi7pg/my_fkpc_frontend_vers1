import api from './api'

export const cashierService = {
  payments(params = {}) {
    return api.get('/cashier/payments', { params })
  },
  pay(orderId, method = 'cash') {
    return api.patch(`/cashier/payments/${orderId}/pay`, { method })
  },
}
