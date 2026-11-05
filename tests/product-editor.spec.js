import { test, expect } from '@playwright/test'

test('product editor stays within the viewport and saves options through its footer', async ({
  page,
}) => {
  const admin = { id: 1, name: 'Admin', role: 'admin' }
  const product = {
    id: 1,
    name: 'Cheese pizza',
    category_id: 1,
    price: 4,
    available: true,
    sizes: [{ name: 'M', price: 4 }],
    toppings: [{ name: 'Cheese', price: 0.25 }],
  }
  let saved = false
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, admin)
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/products/1') && route.request().method() === 'POST') {
      saved = true
      return route.fulfill({ json: { data: product } })
    }
    const data = path.endsWith('/auth/me')
      ? { user: admin }
      : path.endsWith('/admin/products')
        ? [product]
        : path.endsWith('/admin/categories')
          ? [{ id: 1, name: 'Pizza' }]
          : { name: 'FKPC', currency: 'USD' }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/dashboard/products')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Product' })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  const viewport = page.viewportSize()
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
  await expect(dialog.getByRole('button', { name: 'Save Product', exact: true })).toBeInViewport()
  await dialog.getByLabel('Sizes name 1').fill('Large')
  await dialog.getByRole('button', { name: 'Save Product', exact: true }).click()
  await expect.poll(() => saved).toBe(true)
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})
