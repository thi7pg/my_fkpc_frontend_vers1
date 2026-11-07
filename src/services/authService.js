import api from './api'

export const authService = {
  login(name, password) {
    return api.post('/auth/login', { name, password })
  },
  logout() {
    return api.post('/auth/logout')
  },
  me() {
    return api.get('/auth/me')
  },
}
