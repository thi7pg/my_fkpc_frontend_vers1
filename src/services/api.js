import axios from 'axios'

const configuredBaseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
// During development, Vite forwards API requests to the configured backend.
// Keeping browser requests on the frontend origin also supports LAN access.
const baseURL = import.meta.env.DEV
  ? new URL(configuredBaseURL, window.location.origin).pathname
  : configuredBaseURL

export const api = axios.create({
  baseURL,
  headers: {
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status
    const payload = error.response?.data

    if (status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      const isStaffArea = ['/dashboard', '/kitchen', '/cashier'].some((p) =>
        window.location.pathname.startsWith(p),
      )
      if (isStaffArea) {
        window.location.href = '/login'
      }
    }

    const message = payload?.message || error.message || 'Something went wrong'
    const normalized = new Error(message)
    normalized.status = status
    normalized.errors = payload?.errors ?? null
    return Promise.reject(normalized)
  },
)

export default api
