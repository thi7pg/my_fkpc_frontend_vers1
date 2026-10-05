import api from './api'

export const menuService = {
  getMenu(qrToken) {
    return api.get(`/menu/${encodeURIComponent(qrToken)}`)
  },
  validateCart(qrToken, items) {
    return api.post('/cart/validate', { qr_token: qrToken, items })
  },
}
