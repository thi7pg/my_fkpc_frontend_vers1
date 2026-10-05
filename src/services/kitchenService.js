import api from './api'

export const kitchenService = {
  dashboard() {
    return api.get('/kitchen/dashboard')
  },
}
