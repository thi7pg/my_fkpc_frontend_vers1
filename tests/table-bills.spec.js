import { test, expect } from '@playwright/test'

test('cashier lists successful orders and automatically refreshes checkout requests', async ({
  page,
}) => {
  await page.clock.install()
  let requested = false
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Cashier', role: 'cashier' }))
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    return route.fulfill({
      json: {
        data:
          url.pathname.endsWith('/invoices') && url.searchParams.get('status') === 'open'
            ? [
                {
                  id: 6,
                  table: '006',
                  order_number: 'INV-000006',
                  created_at: '2026-10-07T06:00:00Z',
                  checkout_requested_at: requested ? '2026-10-07T06:30:00Z' : null,
                  closed_at: null,
                  amount_due: 10,
                  can_settle: true,
                  items: [],
                  orders: [],
                },
              ]
            : [],
        meta: { last_page: 1 },
      },
    })
  })
  await page.goto('/cashier')
  await expect(page.getByRole('button', { name: /Table 006/ })).toContainText('Take payment')
  await page.getByRole('button', { name: /Table 006/ }).click()
  await expect(page.getByRole('button', { name: 'Confirm payment' })).toBeDisabled()
  await expect(page.getByLabel('Cash received')).toBeVisible()
  requested = true
  await page.clock.fastForward(5000)
  await expect(page.getByRole('button', { name: /Table 006/ })).toContainText('Take payment')
  await expect(page.getByRole('button', { name: /Table 006/ })).toContainText('Checkout requested')
  await expect(page.getByRole('button', { name: 'Confirm payment' })).toBeDisabled()
})

test('cashier takes early payment without asking for guest departure confirmation', async ({
  page,
}) => {
  let ready = false
  let settlement = null
  let closed = false
  const bill = () => ({
    id: 11,
    table: '011',
    order_number: 'INV-000011',
    created_at: '2026-10-07T06:00:00Z',
    checkout_requested_at: null,
    closed_at: closed ? '2026-10-07T07:00:00Z' : null,
    can_settle: !settlement,
    food_complete: ready,
    can_close: !!settlement && ready && !closed,
    total_amount: 17,
    amount_due: settlement ? 0 : 17,
    paid_amount: settlement ? 17 : 0,
    orders: [],
    items: [],
    payment: { status: settlement ? 'paid' : 'pending' },
  })
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Cashier', role: 'cashier' }))
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/11/pay')) {
      settlement = route.request().postDataJSON()
      return route.fulfill({ json: { data: bill() } })
    }
    if (url.pathname.endsWith('/11/close')) {
      expect(route.request().postDataJSON()).toEqual({ guests_left: true })
      closed = true
      return route.fulfill({ json: { data: bill() } })
    }
    return route.fulfill({
      json: {
        data:
          url.pathname.endsWith('/invoices') &&
          url.searchParams.get('status') === (settlement ? 'closed' : 'open')
            ? [bill()]
            : [],
        meta: { last_page: 1 },
      },
    })
  })
  await page.goto('/cashier')
  await page.getByRole('button', { name: /Table 011/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Save receipt' })).toHaveCount(0)
  await dialog.getByLabel('Payment method').selectOption('bank')
  const pay = dialog.getByRole('button', { name: 'Confirm payment' })
  await expect(pay).toBeDisabled()
  await dialog.getByRole('checkbox').check()
  await expect(pay).toBeEnabled()
  await pay.click()
  await expect
    .poll(() => settlement)
    .toEqual({ method: 'bank', expected_cents: 1700, request_key: expect.any(String) })
  await expect(dialog.getByRole('button', { name: 'Save receipt' })).toBeVisible()
  await expect(pay).toHaveCount(0)
  const close = dialog.getByRole('button', { name: 'Close table', exact: true })
  await expect(close).toHaveCount(0)
  await expect(dialog.getByLabel('Guests have left the table')).toHaveCount(0)
})

test('tracking refreshes the combined payment after cashier closes the visit', async ({ page }) => {
  let paid = false
  await page.clock.install()
  await page.route('**/api/v1/**', (route) => {
    const isBill = route.request().url().endsWith('/bill')
    return route.fulfill({
      json: {
        data: isBill
          ? {
              order_number: 'INV-FKPC-000001',
              total_amount: 19.75,
              paid_amount: paid ? 19.75 : 0,
              amount_due: paid ? 0 : 19.75,
              checkout_requested_at: '2026-10-07T06:30:00Z',
              closed_at: paid ? new Date().toISOString() : null,
              payment: { status: paid ? 'paid' : 'pending' },
            }
          : {
              order_number: 'FKPC-000008',
              invoice_id: 1,
              table: '001',
              status: 'completed',
              items: [],
              total_amount: 10.5,
              created_at: new Date().toISOString(),
            },
      },
    })
  })
  await page.goto('/order/track/FKPC-000008')
  const payment = page.getByRole('region', { name: 'Table payment' })
  await expect(payment.getByText('Payment pending', { exact: true })).toBeVisible()
  await expect(payment.getByText('$19.75').first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Order more', exact: true })).toBeVisible()
  paid = true
  await page.clock.fastForward(10000)
  await expect(payment.getByText('Paid', { exact: true })).toBeVisible()
  await expect(payment.getByText('$0.00', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Order more', exact: true })).toHaveCount(0)
})

test('cashier pays one checkout for multiple orders and keeps a paid receipt', async ({ page }) => {
  let settlement
  let bill = {
    id: 1,
    order_number: 'INV-FKPC-000001',
    table: '005',
    created_at: new Date().toISOString(),
    checkout_requested_at: '2026-10-07T06:30:00Z',
    closed_at: null,
    subtotal: 9.25,
    total_amount: 9.25,
    paid_amount: 0,
    amount_due: 9.25,
    can_settle: true,
    orders: [
      { order_number: 'FKPC-000001', status: 'completed', total_amount: 5.25 },
      { order_number: 'FKPC-000002', status: 'completed', total_amount: 4 },
    ],
    items: [
      { id: 1, quantity: 1, product_name: 'Fish', subtotal: 5.25 },
      { id: 2, quantity: 1, product_name: 'Pizza', subtotal: 4 },
    ],
    payment: { status: 'pending' },
  }
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Cashier', role: 'cashier' }))
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    if (request.url().endsWith('/invoices/1/pay')) {
      settlement = request.postDataJSON()
      bill = {
        ...bill,
        closed_at: new Date().toISOString(),
        can_settle: false,
        paid_amount: 9.25,
        amount_due: 0,
        payment: { status: 'paid' },
      }
      return route.fulfill({ json: { data: bill } })
    }
    if (request.url().includes('/invoices'))
      return route.fulfill({
        json: {
          data:
            new URL(request.url()).searchParams.get('status') ===
            (bill.closed_at ? 'closed' : 'open')
              ? [bill]
              : [],
          meta: { current_page: 1, last_page: 1 },
        },
      })
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto('/cashier')
  await expect(
    page.getByRole('button', { name: 'Earlier individual payments', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Table 005/ })).toContainText('Take payment')
  await page.getByRole('button', { name: /Table 005/ }).click()
  await expect(page.getByRole('dialog')).toContainText('#INV-FKPC-000001')
  await expect(page.getByRole('button', { name: 'Save receipt' })).toHaveCount(0)
  const pay = page.getByRole('button', { name: 'Confirm payment', exact: true })
  await page.getByLabel('Cash received').fill('9')
  await expect(pay).toBeDisabled()
  await page.getByLabel('Cash received').fill('10')
  await expect(page.getByText('Change: $0.75')).toBeVisible()
  await pay.click()
  await expect
    .poll(() => settlement)
    .toEqual({ method: 'cash', expected_cents: 925, request_key: expect.any(String) })
  await expect(pay).toHaveCount(0)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save receipt' }).click()
  expect((await download).suggestedFilename()).toBe('INV-FKPC-000001.png')
})

test('customer rescans table and can order more without a tracking redirect', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('fantasia_table_orders', JSON.stringify({ token: 'FKPC-000001' })),
  )
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        data: {
          restaurant: { name: 'FKPC', currency: 'USD' },
          table: { table_number: '005', qr_token: 'token' },
          categories: [],
        },
      },
    }),
  )
  await page.goto('/order/menu/token')
  await expect(page.getByRole('heading', { name: 'Our menu', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /View previous order/ })).toBeVisible()
  await expect(page).toHaveURL(/\/order\/menu\/token$/)
})

test('cashier cannot retry a stale checkout when refresh fails', async ({ page }) => {
  let stale = false
  let attempts = 0
  const bill = {
    id: 3,
    order_number: 'INV-FKPC-000003',
    table: '003',
    created_at: new Date().toISOString(),
    checkout_requested_at: '2026-10-07T06:30:00Z',
    closed_at: null,
    total_amount: 10,
    amount_due: 10,
    paid_amount: 0,
    can_settle: true,
    items: [],
    orders: [],
    payment: { status: 'pending' },
  }
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Cashier', role: 'cashier' }))
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/3/pay')) {
      attempts++
      stale = true
      return route.fulfill({
        status: 409,
        json: { message: 'Bill amount changed. Refresh and try again.' },
      })
    }
    if (url.pathname.endsWith('/invoices')) {
      if (stale) return route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      return route.fulfill({
        json: {
          data: url.searchParams.get('status') === 'open' ? [bill] : [],
          meta: { last_page: 1 },
        },
      })
    }
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto('/cashier')
  await page.getByRole('button', { name: /Table 003/ }).click()
  await page.getByLabel('Cash received').fill('10')
  const pay = page.getByRole('button', { name: 'Confirm payment', exact: true })
  await pay.click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Bill amount changed')
  await page.getByLabel('Cash received').fill('20')
  await expect(pay).toBeDisabled()
  expect(attempts).toBe(1)
})

test('customer switches between orders in the same visit', async ({ page }) => {
  const orders = [
    { order_number: 'ORD-000011', status: 'preparing', total_amount: 10.5 },
    { order_number: 'ORD-000012', status: 'pending', total_amount: 2 },
  ]
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/bill'))
      return route.fulfill({
        json: {
          data: {
            id: 3,
            order_number: 'INV-FKPC-000003',
            orders,
            total_amount: 12.5,
            paid_amount: 0,
            amount_due: 12.5,
            checkout_requested_at: '2026-10-07T06:30:00Z',
            payment: { status: 'pending' },
          },
        },
      })
    const selected = orders.find((order) => path.endsWith(order.order_number)) || orders[1]
    return route.fulfill({
      json: {
        data: {
          ...selected,
          invoice_id: 3,
          table: '002',
          created_at: new Date().toISOString(),
          items: [],
        },
      },
    })
  })
  await page.goto('/order/track/ORD-000012')
  const visit = page.getByRole('region', { name: 'Table Orders' })
  await expect(visit.getByRole('link')).toHaveCount(2)
  await expect(visit.locator('[aria-current="page"]')).toContainText('ORD-000012')
  await expect(
    page.getByRole('region', { name: 'Table payment' }).getByText('$12.50'),
  ).toBeVisible()
  await visit.getByRole('link', { name: /ORD-000011/ }).click()
  await expect(page).toHaveURL(/ORD-000011$/)
  await expect(visit.locator('[aria-current="page"]')).toContainText('ORD-000011')
  await expect(page.getByRole('status').first()).toContainText('Preparing')
})
