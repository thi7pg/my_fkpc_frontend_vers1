import { test, expect } from '@playwright/test'

test('restaurant settings keep tax but never submit a service charge', async ({ page }) => {
  const submissions = []
  const settings = {
    id: 1,
    name: 'Restaurant',
    currency: 'USD',
    tax_percentage: 10,
    service_charge_percentage: 5,
    opening_time: '08:00',
    closing_time: '22:00',
  }
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Admin', role: 'admin' }))
    localStorage.setItem('language', 'en')
  })
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) {
      return route.fulfill({ json: { data: { user: { id: 1, name: 'Admin', role: 'admin' } } } })
    }
    if (path.endsWith('/admin/settings')) {
      if (route.request().method() !== 'GET') submissions.push(route.request().postData())
      return route.fulfill({ json: { data: settings } })
    }
    return route.fulfill({ json: { data: {} } })
  })
  await page.goto('/dashboard/settings')
  await expect(page.getByLabel('Tax %')).toHaveValue('10')
  await expect(page.getByLabel('Service %')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await expect.poll(() => submissions.length).toBe(1)
  expect(submissions[0]).not.toContain('service_charge_percentage')
})
