import { test, expect } from '@playwright/test'

test('a receipt export survives an order status refresh', async ({ page }) => {
  await page.clock.install()
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.finishReceipt = () => toBlob.apply(this, args)
    }
  })
  let requests = 0
  await page.route('**/api/v1/**', (route) => {
    requests++
    return route.fulfill({
      json: {
        data: {
          order_number: 'ORD-000001',
          status: 'completed',
          created_at: '2026-10-07T06:00:00Z',
          table: '001',
          total_amount: 10,
          items: [],
        },
      },
    })
  })
  await page.goto('/order/track/ORD-000001')
  await page.getByRole('button', { name: 'Download Receipt', exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof window.finishReceipt)).toBe('function')
  await page.clock.fastForward(10000)
  await expect.poll(() => requests).toBeGreaterThan(1)
  await page.evaluate(() => window.finishReceipt())
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Receipt', exact: true })).toBeVisible()
})

test('customers can place an order when browser storage is full', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'cart_state',
      JSON.stringify({
        qrToken: 'table-token',
        table: { table_number: '001' },
        restaurant: { currency: 'USD' },
        categories: [],
        items: [{ productId: 1, name: 'Pizza', price: 10, quantity: 1 }],
      }),
    )
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    }
  })
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  let placed = false
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().endsWith('/orders')) placed = true
    return route.fulfill({
      json: {
        data: {
          order_number: 'ORD-000001',
          status: 'pending',
          table: '001',
          created_at: '2026-10-07T06:00:00Z',
          total_amount: 10,
          items: [],
        },
      },
    })
  })
  await page.goto('/order/cart')
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect(page).toHaveURL(/track\/ORD-000001$/)
  expect(placed).toBe(true)
  expect(browserErrors).toEqual([])
})
