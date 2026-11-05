import { test, expect } from '@playwright/test'

const admin = { id: 1, name: 'Admin User', role: 'admin' }
const staff = {
  id: 2,
  name: 'Kitchen Staff',
  username: 'kitchen',
  email: 'kitchen@example.test',
  role: 'kitchen',
  is_active: true,
}

async function mockStaffUsers(page, handleUsers) {
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, admin)
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (path === '/admin/users' && route.request().method() === 'GET') return handleUsers(route)
    if (path === '/auth/me') return route.fulfill({ json: { data: admin } })
    if (path === '/admin/settings')
      return route.fulfill({ json: { data: { name: 'FKPC', currency: 'USD' } } })
    return route.fulfill({ status: 404, json: { message: `Unexpected request: ${path}` } })
  })
}

function failStaffRequest(route) {
  return route.fulfill({
    status: 500,
    json: { success: false, message: 'Server Error', errors: [] },
  })
}

test('a staff users server error shows a retry action instead of an empty list', async ({
  page,
}) => {
  await mockStaffUsers(page, failStaffRequest)
  await page.goto('/dashboard/users')

  const error = page.getByRole('alert')
  await expect(error).toContainText('Could not load staff users.')
  await expect(error.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expect(page.getByText('No staff users yet', { exact: true })).toHaveCount(0)
  await expect(page.locator('.Vue-Toastification__toast')).toHaveCount(0)
})

test('staff users can retry a failed request and load the staff list', async ({ page }) => {
  let requests = 0
  let retryRoute
  await mockStaffUsers(page, (route) => {
    requests++
    if (requests === 1) return failStaffRequest(route)
    retryRoute = route
  })
  await page.goto('/dashboard/users')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()

  await expect.poll(() => Boolean(retryRoute)).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('No staff users yet', { exact: true })).toHaveCount(0)
  await retryRoute.fulfill({ json: { success: true, data: [staff] } })

  await expect(page.getByText('Kitchen Staff', { exact: true })).toBeVisible()
  await expect(page.getByText('kitchen · kitchen@example.test', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
  expect(requests).toBe(2)
})

test('a successful empty staff users response shows the empty state', async ({ page }) => {
  await mockStaffUsers(page, (route) => route.fulfill({ json: { success: true, data: [] } }))
  await page.goto('/dashboard/users')

  await expect(page.getByText('No staff users yet', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
})
