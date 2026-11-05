import { test, expect } from '@playwright/test'

function visitSnapshot(checkoutRequestedAt) {
  return {
    id: 12,
    order_number: checkoutRequestedAt ? 'INV-000012' : null,
    table: '001',
    created_at: '2026-10-07T06:00:00Z',
    checkout_requested_at: checkoutRequestedAt,
    closed_at: null,
    subtotal: 10,
    tax_amount: 0,
    total_amount: 10,
    amount_due: 10,
    paid_amount: 0,
    payment: null,
    can_settle: true,
    orders: [
      {
        order_number: 'ORD-000101',
        total_amount: 10,
        status: 'completed',
        payment_status: 'pending',
      },
    ],
    items: [
      { id: 1, order_number: 'ORD-000101', product_name: 'Pizza', quantity: 1, subtotal: 10 },
    ],
  }
}

test('early paid checkout opens a receipt and preserves tracking for unfinished food', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('language', 'en')
    localStorage.setItem('fantasia_last_order', 'ORD-000101')
  })
  const paid = {
    ...visitSnapshot('2026-10-07T07:00:00Z'),
    amount_due: 0,
    paid_amount: 10,
    closed_at: null,
    can_settle: false,
    food_complete: false,
    can_close: false,
    payment: { status: 'paid', paid_at: '2026-10-07T07:01:00Z', method: 'cash' },
    orders: [
      { order_number: 'ORD-000101', status: 'preparing', payment_status: 'paid', total_amount: 10 },
    ],
  }
  await page.route('**/api/v1/**', (route) => route.fulfill({ json: { data: paid } }))
  await page.goto('/order/checkout/ORD-000101')
  await expect(page).toHaveURL(/\/order\/receipt\/ORD-000101$/)
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Order Tracking', exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fantasia_last_order'))).toBe('ORD-000101')
  await expect(page.getByText(/preparing.*Paid/i)).toBeVisible()
})

test('checkout failure preserves the visit and retries only after an explicit click', async ({
  page,
}) => {
  await page.clock.install()
  let requests = 0
  let checkoutRequestedAt = null
  await page.addInitScript(() => {
    localStorage.setItem('fantasia_last_order', 'ORD-000101')
    localStorage.setItem(
      'cart_state',
      JSON.stringify({
        qrToken: 'token',
        table: { table_number: '001' },
        restaurant: { currency: 'USD' },
        categories: [],
        items: [{ productId: 2, name: 'Soup', price: 7, quantity: 1 }],
      }),
    )
  })
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().endsWith('/checkout')) {
      requests++
      if (requests === 1)
        return route.fulfill({
          status: 503,
          json: { message: 'Checkout is unavailable. Try again.' },
        })
      checkoutRequestedAt = '2026-10-07T07:00:00Z'
    }
    return route.fulfill({ json: { data: visitSnapshot(checkoutRequestedAt) } })
  })
  await page.goto('/order/checkout/ORD-000101')
  await expect(page.getByRole('alert')).toContainText('Checkout is unavailable. Try again.')
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toHaveCount(
    0,
  )
  await expect(page.getByText(/Your checkout request is with the cashier/)).toHaveCount(0)
  await page.clock.fastForward(10000)
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeEnabled()
  expect(requests).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('fantasia_last_order'))).toBe('ORD-000101')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('cart_state')).items),
  ).toHaveLength(1)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests).toBe(2)
})

test('polling an invalidated checkout waits for the customer to request checkout again', async ({
  page,
}) => {
  await page.clock.install()
  let requests = 0
  let checkoutRequestedAt = null
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().endsWith('/checkout')) {
      requests++
      checkoutRequestedAt = '2026-10-07T07:00:00Z'
    }
    return route.fulfill({ json: { data: visitSnapshot(checkoutRequestedAt) } })
  })
  await page.goto('/order/checkout/ORD-000101')
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toBeVisible()
  expect(requests).toBe(1)
  // Another order in the same visit invalidates the earlier checkout request on the server.
  checkoutRequestedAt = null
  await page.clock.fastForward(5000)
  await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Order Summary' })).toContainText('Payment pending')
  await expect(page.getByText(/Your checkout request is with the cashier/)).toHaveCount(0)
  await page.clock.fastForward(10000)
  await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeEnabled()
  expect(requests).toBe(1)
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toBeVisible()
  expect(requests).toBe(2)
})

test('an unpaid receipt opens checkout for review without creating a payment request', async ({
  page,
}) => {
  let requests = 0
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().endsWith('/receipt'))
      return route.fulfill({
        status: 409,
        json: { message: 'Payment has not been confirmed yet.' },
      })
    if (route.request().url().endsWith('/checkout')) {
      requests++
      return route.fulfill({ json: { data: visitSnapshot('2026-10-07T07:00:00Z') } })
    }
    return route.fulfill({ json: { data: visitSnapshot(null) } })
  })
  await page.goto('/order/receipt/ORD-000101')
  await expect(page).toHaveURL(/checkout\/ORD-000101\?review=1$/)
  await expect(page.getByRole('button', { name: 'Checkout', exact: true })).toBeEnabled()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Checkout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toBeVisible()
  expect(requests).toBe(1)
})

test('cart reviews changed server prices and preserves items when placing an order fails', async ({
  page,
}) => {
  let submissions = 0
  await page.addInitScript(() => {
    localStorage.setItem(
      'cart_state',
      JSON.stringify({
        qrToken: 'token',
        table: { table_number: '001' },
        restaurant: { currency: 'USD' },
        categories: [],
        items: [{ productId: 1, name: 'Pizza', price: 10, quantity: 1, notes: 'No onion' }],
      }),
    )
  })
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().endsWith('/cart/validate'))
      return route.fulfill({
        json: {
          data: {
            subtotal: 11,
            tax_amount: 0,
            total_amount: 11,
          },
        },
      })
    submissions++
    expect(route.request().postDataJSON().items[0].notes).toBe('No onion')
    return route.fulfill({ status: 422, json: { message: 'Product unavailable' } })
  })
  await page.goto('/order/cart')
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Your order summary has changed')
  expect(submissions).toBe(0)
  await expect(page.getByText('$11.00').last()).toBeVisible()
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Product unavailable')
  expect(submissions).toBe(1)
  await expect(page).toHaveURL(/\/order\/cart$/)
  await expect(page.getByText('Pizza', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('cart_state')).items),
  ).toHaveLength(1)
})

test('customer orders twice, checks out once, and receives one paid session receipt', async ({
  page,
}) => {
  await page.clock.install()
  const orders = []
  let paid = false
  let checkoutRequests = 0
  let checkoutRequestedAt = null
  const products = [
    { id: 1, name: 'Pizza', price: 10, available: true },
    { id: 2, name: 'Soup', price: 7, available: true },
  ]
  const bill = () => ({
    id: 12,
    order_number: 'INV-000012',
    table: '001',
    created_at: new Date().toISOString(),
    closed_at: paid ? new Date().toISOString() : null,
    checkout_requested_at: checkoutRequestedAt,
    subtotal: 17,
    tax_amount: 0,
    total_amount: 17,
    amount_due: paid ? 0 : 17,
    paid_amount: paid ? 17 : 0,
    payment: { status: paid ? 'paid' : 'pending', method: paid ? 'cash' : null },
    can_settle: true,
    orders: orders.map((order) => ({ ...order, payment_status: paid ? 'paid' : 'pending' })),
    items: orders.flatMap((order) =>
      order.items.map((item) => ({ ...item, order_number: order.order_number })),
    ),
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/menu/table-token') || path.endsWith('/menu/001')) {
      return route.fulfill({
        json: {
          data: {
            restaurant: { name: 'Restaurant', currency: 'USD' },
            table: { id: 1, table_number: '001', qr_token: 'table-token' },
            categories: [{ id: 1, name: 'Food', products }],
          },
        },
      })
    }
    if (
      path.endsWith('/cart/validate') ||
      (path.endsWith('/orders') && route.request().method() === 'POST')
    ) {
      const payload = route.request().postDataJSON()
      const product = products.find((product) => product.id === payload.items[0].product_id)
      const order = {
        order_number: orders.length ? 'ORD-000108' : 'ORD-000101',
        invoice_id: 12,
        status: 'completed',
        table: '001',
        subtotal: product.price,
        total_amount: product.price,
        tax_amount: 0,
        created_at: '2026-10-07T06:00:00Z',
        items: [
          { id: product.id, product_name: product.name, quantity: 1, subtotal: product.price },
        ],
      }
      if (path.endsWith('/orders')) {
        orders.push(order)
        checkoutRequestedAt = null
      }
      return route.fulfill({ json: { data: order } })
    }
    if (path.endsWith('/checkout')) {
      expect(route.request().method()).toBe('POST')
      checkoutRequests++
      checkoutRequestedAt = '2026-10-07T07:00:00Z'
      return route.fulfill({ json: { data: bill() } })
    }
    if (path.endsWith('/bill')) return route.fulfill({ json: { data: bill() } })
    if (path.endsWith('/receipt')) {
      if (!paid)
        return route.fulfill({
          status: 409,
          json: { message: 'Payment has not been confirmed yet.' },
        })
      return route.fulfill({ json: { data: bill() } })
    }
    return route.fulfill({
      json: { data: orders.find((order) => path.endsWith(order.order_number)) },
    })
  })
  await page.goto('/order/menu/table-token')
  await page.getByRole('button', { name: 'Add Pizza to cart', exact: true }).first().click()
  await page.goto('/order/cart')
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect(page).toHaveURL(/track\/ORD-000101$/)
  await expect(page.getByRole('region', { name: 'Table payment' })).toContainText('Payment pending')
  await expect(page.getByRole('region', { name: 'Table payment' })).toContainText('INV-000012')
  expect(checkoutRequests).toBe(0)
  await page.getByRole('link', { name: 'Order more', exact: true }).click()
  expect(checkoutRequests).toBe(0)
  await page.getByRole('button', { name: 'Add Soup to cart', exact: true }).first().click()
  await page.goto('/order/cart')
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect(page).toHaveURL(/track\/ORD-000108$/)
  expect(orders).toHaveLength(2)
  expect(orders.map((order) => order.invoice_id)).toEqual([12, 12])
  expect(checkoutRequests).toBe(0)
  await page.getByRole('link', { name: 'Checkout', exact: true }).click()
  const summary = page.getByRole('region', { name: 'Order Summary', exact: true })
  await expect(summary).toContainText('ORD-000101')
  await expect(summary).toContainText('ORD-000108')
  await expect(summary).toContainText('$17.00')
  await expect(summary).toContainText('Pizza')
  await expect(summary).toContainText('Soup')
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toBeVisible()
  expect(checkoutRequests).toBe(1)
  await page.clock.fastForward(10000)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  expect(checkoutRequests).toBe(1)
  // Visiting the receipt URL cannot display an unpaid receipt.
  await page.goto('/order/receipt/ORD-000108')
  await expect(page).toHaveURL(/checkout\/ORD-000108\?review=1$/)
  await expect(page.getByRole('heading', { name: 'Checkout requested', exact: true })).toBeVisible()
  expect(checkoutRequests).toBe(1)
  paid = true // Existing cashier settlement confirms payment on the server.
  await page.clock.fastForward(5000)
  await expect(page).toHaveURL(/receipt\/ORD-000108$/)
  await expect(page.getByRole('heading', { name: 'Receipt', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Order Summary' })).toContainText('$17.00')
  await expect(page.getByRole('region', { name: 'Order Summary' })).toContainText('ORD-000101')
  expect(await page.evaluate(() => localStorage.getItem('fantasia_last_order'))).toBeNull()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('fantasia_table_orders'))),
  ).toEqual({})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Download Receipt', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Receipt', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Receipt', exact: true })).toBeVisible()
  await page.goto('/order/menu/table-token')
  await expect(page.getByRole('heading', { name: 'Our menu', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /View previous order/ })).toHaveCount(0)
})

test('opening an old receipt preserves tracking and cart for a newer visit', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'fantasia_table_orders',
      JSON.stringify({ token: 'ORD-000109', '001': 'ORD-000109' }),
    )
    localStorage.setItem('fantasia_last_order', 'ORD-000109')
    localStorage.setItem(
      'cart_state',
      JSON.stringify({
        qrToken: 'token',
        table: { table_number: '001' },
        restaurant: { currency: 'USD' },
        categories: [],
        items: [{ productId: 1, name: 'Pizza', price: 10, quantity: 1 }],
      }),
    )
  })
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        data: {
          id: 12,
          order_number: 'INV-000012',
          table: '001',
          created_at: '2026-10-07T06:00:00Z',
          closed_at: '2026-10-07T07:00:00Z',
          total_amount: 17,
          subtotal: 17,
          amount_due: 0,
          paid_amount: 17,
          payment: { status: 'paid' },
          orders: [
            {
              order_number: 'ORD-000108',
              total_amount: 17,
              status: 'completed',
              payment_status: 'paid',
            },
          ],
          items: [],
        },
      },
    }),
  )
  await page.goto('/order/receipt/ORD-000108')
  await expect(page.getByRole('heading', { name: 'Receipt', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Order Summary' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('fantasia_last_order'))).toBe('ORD-000109')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('fantasia_table_orders')).token),
  ).toBe('ORD-000109')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('cart_state')).items),
  ).toHaveLength(1)
})

test('a delayed placed order preserves the cart and tracking link for another table', async ({
  page,
}) => {
  const restaurant = { name: 'FKPC', currency: 'USD' }
  const soup = { id: 2, name: 'Soup', price: 7, available: true }
  let submitted
  let releaseOrder
  const orderResponse = new Promise((resolve) => {
    releaseOrder = resolve
  })
  await page.addInitScript(() => {
    localStorage.setItem('fantasia_last_order', 'ORD-NEW')
    localStorage.setItem(
      'fantasia_table_orders',
      JSON.stringify({ 'new-token': 'ORD-NEW', '002': 'ORD-NEW' }),
    )
    localStorage.setItem(
      'cart_state',
      JSON.stringify({
        qrToken: 'old-token',
        table: { table_number: '001' },
        restaurant: { currency: 'USD' },
        categories: [],
        items: [{ productId: 1, name: 'Pizza', price: 10, quantity: 1 }],
      }),
    )
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/cart/validate'))
      return route.fulfill({ json: { data: { subtotal: 10, total_amount: 10 } } })
    if (path.endsWith('/orders')) {
      submitted = route.request().postDataJSON()
      await orderResponse
      return route.fulfill({ json: { data: { order_number: 'ORD-ORIGINAL' } } })
    }
    if (path.endsWith('/bill')) return route.fulfill({ json: { data: { closed_at: null } } })
    return route.fulfill({
      json: {
        data: {
          restaurant,
          table: { table_number: '002', qr_token: 'new-token' },
          categories: [{ id: 1, name: 'Soup', products: [soup] }],
        },
      },
    })
  })
  await page.goto('/order/cart')
  await page.getByRole('button', { name: 'Place Order', exact: true }).click()
  await expect.poll(() => submitted?.qr_token).toBe('old-token')
  expect(submitted.customer_name).toBe('Table 001')
  await page.getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByRole('button', { name: 'Enter table number', exact: true }).click()
  await page.getByLabel('Table number', { exact: true }).fill('002')
  await page.getByRole('button', { name: 'Confirm table', exact: true }).click()
  await page.getByRole('button', { name: 'Add Soup to cart', exact: true }).click()
  releaseOrder()
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('fantasia_table_orders'))['old-token']),
    )
    .toBe('ORD-ORIGINAL')
  await expect(page).toHaveURL(/\/order\/menu\/002$/)
  expect(await page.evaluate(() => localStorage.getItem('fantasia_last_order'))).toBe('ORD-NEW')
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('cart_state')))
  expect(cart.qrToken).toBe('new-token')
  expect(cart.items).toEqual([expect.objectContaining({ productId: 2, quantity: 1 })])
})

test('a delayed receipt does not open over a different tracked order', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fantasia_last_order', 'ORD-NEW')
    const toBlob = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      window.finishReceipt = () => toBlob.apply(this, args)
    }
  })
  await page.route('**/api/v1/**', (route) => {
    const orderNumber = new URL(route.request().url()).pathname.split('/').pop()
    return route.fulfill({
      json: {
        data: {
          order_number: orderNumber,
          status: 'completed',
          table: '001',
          total_amount: 10,
          items: [{ id: 1, product_name: 'Pizza', quantity: 1, subtotal: 10 }],
        },
      },
    })
  })
  await page.goto('/order/track/ORD-OLD')
  await page.getByRole('button', { name: 'Download Receipt', exact: true }).click()
  await expect.poll(() => page.evaluate(() => typeof window.finishReceipt)).toBe('function')
  // Switch tracked orders without reloading the page or unmounting its pending receipt export.
  await page.evaluate(() => {
    history.pushState({}, '', '/order/track/ORD-NEW')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page).toHaveURL(/\/order\/track\/ORD-NEW$/)
  await expect(page.getByText('#ORD-NEW', { exact: true })).toBeVisible()
  await page.evaluate(() => window.finishReceipt())
  await expect(page.getByRole('button', { name: 'Download Receipt', exact: true })).toBeEnabled()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
