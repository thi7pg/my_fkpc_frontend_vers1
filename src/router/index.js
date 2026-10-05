import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const CustomerLayout = () => import('../layouts/CustomerLayout.vue')
const StaffLayout = () => import('../layouts/StaffLayout.vue')
const AuthLayout = () => import('../layouts/AuthLayout.vue')

const routes = [
  {
    path: '/',
    redirect: () => {
      const auth = useAuthStore()
      return auth.isAuthenticated ? auth.dashboardRouteForRole() : '/login'
    },
  },
  {
    path: '/order',
    component: CustomerLayout,
    children: [
      { path: '', name: 'landing', component: () => import('../pages/customer/LandingPage.vue') },
      { path: 'menu/:qrToken', name: 'menu', component: () => import('../pages/customer/MenuPage.vue') },
      { path: 'product/:id', name: 'product-detail', component: () => import('../pages/customer/ProductDetailPage.vue') },
      { path: 'cart', name: 'cart', component: () => import('../pages/customer/CartPage.vue') },
      { path: 'checkout', name: 'checkout', component: () => import('../pages/customer/CheckoutPage.vue') },
      { path: 'track/:orderNumber', name: 'order-tracking', component: () => import('../pages/customer/OrderTrackingPage.vue') },
    ],
  },
  {
    path: '/login',
    component: AuthLayout,
    children: [
      { path: '', name: 'login', component: () => import('../pages/auth/LoginPage.vue'), meta: { guestOnly: true } },
    ],
  },
  {
    path: '/dashboard',
    component: StaffLayout,
    meta: { requiresAuth: true, roles: ['admin'] },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../pages/admin/DashboardPage.vue'), meta: { title: 'Dashboard' } },
      { path: 'tables', name: 'admin-tables', component: () => import('../pages/admin/TablesPage.vue'), meta: { title: 'Tables' } },
      { path: 'categories', name: 'admin-categories', component: () => import('../pages/admin/CategoriesPage.vue'), meta: { title: 'Categories' } },
      { path: 'products', name: 'admin-products', component: () => import('../pages/admin/ProductsPage.vue'), meta: { title: 'Products' } },
      { path: 'orders', name: 'admin-orders', component: () => import('../pages/admin/OrdersPage.vue'), meta: { title: 'Orders' } },
      { path: 'reports', name: 'admin-reports', component: () => import('../pages/admin/ReportsPage.vue'), meta: { title: 'Reports' } },
      { path: 'users', name: 'admin-users', component: () => import('../pages/admin/UsersPage.vue'), meta: { title: 'Staff Users' } },
      { path: 'settings', name: 'admin-settings', component: () => import('../pages/admin/SettingsPage.vue'), meta: { title: 'Restaurant Settings' } },
    ],
  },
  {
    path: '/kitchen',
    component: StaffLayout,
    meta: { requiresAuth: true, roles: ['admin', 'kitchen'] },
    children: [
      { path: '', name: 'kitchen-dashboard', component: () => import('../pages/kitchen/KitchenDashboardPage.vue'), meta: { title: 'Kitchen' } },
    ],
  },
  {
    path: '/cashier',
    component: StaffLayout,
    meta: { requiresAuth: true, roles: ['admin', 'cashier'] },
    children: [
      { path: '', name: 'cashier-dashboard', component: () => import('../pages/cashier/CashierDashboardPage.vue'), meta: { title: 'Payments' } },
      { path: 'dashboard', name: 'cashier-overview', component: () => import('../pages/admin/DashboardPage.vue'), meta: { title: 'Dashboard' } },
      { path: 'tables', name: 'cashier-tables', component: () => import('../pages/admin/TablesPage.vue'), meta: { title: 'Tables' } },
      { path: 'categories', name: 'cashier-categories', component: () => import('../pages/admin/CategoriesPage.vue'), meta: { title: 'Categories' } },
      { path: 'products', name: 'cashier-products', component: () => import('../pages/admin/ProductsPage.vue'), meta: { title: 'Products' } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/NotFoundPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { path: auth.dashboardRouteForRole() }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.roles && auth.isAuthenticated && !to.meta.roles.includes(auth.role)) {
    return { path: auth.dashboardRouteForRole() }
  }

  return true
})

export default router
