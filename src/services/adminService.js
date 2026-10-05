import api from './api'

export const adminService = {
  dashboard() {
    return api.get('/admin/dashboard')
  },
  activityLogs(params = {}) {
    return api.get('/admin/activity-logs', { params })
  },

  getSettings() {
    return api.get('/admin/settings')
  },
  updateSettings(payload) {
    return api.post('/admin/settings?_method=PUT', payload)
  },

  tables: {
    list(params = {}) {
      return api.get('/admin/tables', { params })
    },
    get(id) {
      return api.get(`/admin/tables/${id}`)
    },
    create(payload) {
      return api.post('/admin/tables', payload)
    },
    update(id, payload) {
      return api.put(`/admin/tables/${id}`, payload)
    },
    remove(id) {
      return api.delete(`/admin/tables/${id}`)
    },
    regenerateQr(id) {
      return api.post(`/admin/tables/${id}/regenerate-qr`)
    },
  },

  categories: {
    list(params = {}) {
      return api.get('/admin/categories', { params })
    },
    create(payload) {
      return api.post('/admin/categories', payload)
    },
    update(id, payload) {
      return api.post(`/admin/categories/${id}?_method=PUT`, payload)
    },
    remove(id) {
      return api.delete(`/admin/categories/${id}`)
    },
  },

  products: {
    list(params = {}) {
      return api.get('/admin/products', { params })
    },
    create(payload) {
      return api.post('/admin/products', payload)
    },
    update(id, payload) {
      return api.post(`/admin/products/${id}?_method=PUT`, payload)
    },
    remove(id) {
      return api.delete(`/admin/products/${id}`)
    },
  },

  reports: {
    revenue(params = {}) {
      return api.get('/admin/reports/revenue', { params })
    },
  },

  users: {
    list(params = {}) {
      return api.get('/admin/users', { params })
    },
    create(payload) {
      return api.post('/admin/users', payload)
    },
    update(id, payload) {
      return api.put(`/admin/users/${id}`, payload)
    },
    remove(id) {
      return api.delete(`/admin/users/${id}`)
    },
  },
}
