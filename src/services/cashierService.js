import api from './api'

export const cashierService = {
  previewMerge(ids) {
    return api.post('/cashier/invoices/merge/preview', { ids })
  },
  mergeInvoices(invoices) {
    return api.post('/cashier/invoices/merge', { invoices })
  },
  invoices(params = {}) {
    return api.get('/cashier/invoices', { params })
  },
  invoice(id) {
    return api.get(`/cashier/invoices/${id}`)
  },
  settleInvoice(id, method, expectedCents, requestKey) {
    return api.patch(`/cashier/invoices/${id}/pay`, {
      method,
      expected_cents: expectedCents,
      request_key: requestKey,
    })
  },
}
