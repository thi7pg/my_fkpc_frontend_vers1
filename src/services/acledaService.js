import api from './api'

function paymentHeaders(token) {
  return { 'X-Payment-Token': token }
}

export const acledaService = {
  get(orderNumber, token) {
    return api.get(`/demo-payments/${encodeURIComponent(orderNumber)}`, {
      headers: paymentHeaders(token),
    })
  },
  confirm(orderNumber, token) {
    return api.post(
      `/demo-payments/${encodeURIComponent(orderNumber)}/confirm`,
      {},
      {
        headers: paymentHeaders(token),
      },
    )
  },
}
