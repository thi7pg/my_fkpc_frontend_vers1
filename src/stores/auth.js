import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authService } from '../services/authService'

export const useAuthStore = defineStore('auth', () => {
  let savedUser = null
  try {
    const storedUser = localStorage.getItem('auth_user')
    savedUser = storedUser ? JSON.parse(storedUser) : null
    if (savedUser && (typeof savedUser !== 'object' || Array.isArray(savedUser) || !['admin', 'kitchen', 'cashier'].includes(savedUser.role))) {
      throw new Error('Invalid saved session')
    }
  } catch {
    savedUser = null
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
  }

  const user = ref(savedUser)
  const token = ref(localStorage.getItem('auth_token'))
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)
  const role = computed(() => user.value?.role ?? null)

  function persist(nextUser, nextToken) {
    user.value = nextUser
    token.value = nextToken

    if (nextToken) {
      localStorage.setItem('auth_token', nextToken)
      localStorage.setItem('auth_user', JSON.stringify(nextUser))
    } else {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
  }

  async function login(username, password) {
    loading.value = true
    try {
      const res = await authService.login(username, password)
      persist(res.data.user, res.data.token)
      return res.data.user
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authService.logout()
    } finally {
      persist(null, null)
    }
  }

  async function fetchMe() {
    try {
      const res = await authService.me()
      user.value = res.data.user ?? res.data
      localStorage.setItem('auth_user', JSON.stringify(user.value))
      return user.value
    } catch (e) {
      persist(null, null)
      throw e
    }
  }

  function dashboardRouteForRole() {
    switch (role.value) {
      case 'kitchen':
        return '/kitchen'
      case 'cashier':
        return '/cashier/dashboard'
      default:
        return '/dashboard'
    }
  }

  return { user, token, loading, isAuthenticated, role, login, logout, fetchMe, dashboardRouteForRole }
})
