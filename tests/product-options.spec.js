import { test, expect } from '@playwright/test'

test('customer places distinct size and topping selections in one order', async ({ page }) => {
  let submitted
  let validated
  const product = {
    id: 1,
    name: 'Pizza',
    price: 8,
    available: true,
    discount_percent: 10,
    sizes: [
      { name: 'M', price: 8 },
      { name: 'L', price: 10 },
    ],
    toppings: [{ name: 'Cheese', price: 2 }],
  }
  await page.addInitScript(
    (product) =>
      localStorage.getItem('cart_state') ||
      localStorage.setItem(
        'cart_state',
        JSON.stringify({
          qrToken: 'token',
          table: { table_number: '001', qr_token: 'token' },
          restaurant: { name: 'FKPC', currency: 'USD' },
          categories: [{ id: 1, products: [product] }],
          items: [],
        }),
      ),
    product,
  )
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/cart/validate')) {
      validated = route.request().postDataJSON()
      return route.fulfill({
        json: {
          data: {
            items: [
              { product_name: 'Pizza (L, Cheese)', quantity: 1, subtotal: 11 },
              { product_name: 'Pizza (M)', quantity: 1, subtotal: 7.2 },
            ],
            subtotal: 18.2,
            total_amount: 18.2,
            tax_amount: 0,
          },
        },
      })
    }
    if (path.endsWith('/orders')) {
      submitted = route.request().postDataJSON()
      return route.fulfill({ json: { data: { order_number: 'ORD-000001' } } })
    }
    return route.fulfill({
      json: {
        data: {
          restaurant: { name: 'FKPC', currency: 'USD' },
          table: { table_number: '001', qr_token: 'token' },
          categories: [{ id: 1, name: 'Pizza', products: [product] }],
          order_number: 'ORD-000001',
          status: 'pending',
          items: [],
        },
      },
    })
  })
  await page.goto('/order/product/1')
  await page.getByRole('radio', { name: /L/ }).check()
  await page.getByRole('checkbox', { name: /Cheese/ }).check()
  await page.getByLabel('Special Note (optional)', { exact: true }).fill('No onion')
  await expect(page.locator('.action-total')).toContainText('$11.00')
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
  await page.goto('/order/product/1')
  await expect(page.getByRole('radio', { name: /M/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Cheese/ })).not.toBeChecked()
  await expect(page.locator('.action-total')).toContainText('$7.20')
  await page.getByRole('button', { name: 'Add to Cart', exact: true }).click()
  await page.goto('/order/cart')
  await expect(page.getByText('Pizza (L, Cheese)', { exact: true })).toBeVisible()
  await expect(page.getByText('Pizza (M)', { exact: true })).toBeVisible()
  await expect(page.getByText('$18.20', { exact: true }).first()).toBeVisible()
  const note = page.getByLabel('Special Note (optional): Pizza (L, Cheese)', { exact: true })
  await expect(note).toHaveValue('No onion')
  await note.fill('No onion, sauce on the side')
  await page.goto('/order/checkout')
  await expect(page).toHaveURL(/\/order\/cart$/)
  await expect(note).toHaveValue('No onion, sauce on the side')
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect
    .poll(() => submitted?.items)
    .toEqual([
      {
        product_id: 1,
        quantity: 1,
        size: 'L',
        toppings: ['Cheese'],
        notes: 'No onion, sauce on the side',
      },
      { product_id: 1, quantity: 1, size: 'M', toppings: [] },
    ])
  expect(validated).toEqual({ qr_token: 'token', items: submitted.items })
  expect(submitted.payment_method).toBe('cash')
  expect(submitted.items.every((item) => !Object.hasOwn(item, 'price'))).toBe(true)
  await expect(page).toHaveURL(/\/order\/track\/ORD-000001$/)
})
