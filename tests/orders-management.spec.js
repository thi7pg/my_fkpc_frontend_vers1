import { test, expect } from '@playwright/test'

const admin = { id: 1, name: 'Admin User', role: 'admin' }
const orders = [
  {
    id: 1,
    order_number: 'ORD-000001',
    table: { id: 7, table_number: '007' },
    customer_name: 'Table 007',
    status: 'pending',
    subtotal: 18,
    tax_amount: 1.8,
    total_amount: 19.8,
    created_at: '2026-10-08T03:00:00Z',
    notes: 'Serve together',
    items: [
      {
        id: 1,
        product_id: 1,
        product_name: 'Cheese pizza',
        quantity: 2,
        price: 9,
        subtotal: 18,
        notes: 'No onion',
      },
    ],
  },
  {
    id: 2,
    order_number: 'ORD-000002',
    table: { id: 11, table_number: '011' },
    customer_name: 'Table 011',
    status: 'preparing',
    subtotal: 7,
    tax_amount: 0,
    total_amount: 7,
    created_at: '2026-10-08T03:05:00Z',
    items: [
      {
        id: 2,
        product_id: 2,
        product_name: 'Kimchi soup',
        quantity: 1,
        price: 7,
        subtotal: 7,
        notes: 'Extra spicy',
      },
    ],
  },
  {
    id: 3,
    order_number: 'ORD-000003',
    table: { id: 24, table_number: '024' },
    customer_name: 'Table 024',
    status: 'completed',
    subtotal: 5,
    tax_amount: 0,
    total_amount: 5,
    created_at: '2026-10-08T03:10:00Z',
    items: [
      {
        id: 3,
        product_id: 3,
        product_name: 'Orange juice',
        quantity: 1,
        price: 5,
        subtotal: 5,
      },
    ],
  },
]

async function mockOrders(page, initialOrders = orders) {
  const savedOrders = structuredClone(initialOrders)
  const lists = []
  const changes = []
  const details = []
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, admin)
  await page.route('**/api/v1/**', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/auth/me') return route.fulfill({ json: { data: { user: admin } } })
    if (path === '/admin/settings')
      return route.fulfill({ json: { data: { name: 'FKPC', currency: 'USD' } } })
    if (path === '/orders' && request.method() === 'GET') {
      const query = Object.fromEntries(url.searchParams)
      lists.push(query)
      const filtered = savedOrders.filter(
        (order) =>
          (!query.status || order.status === query.status) &&
          (!query.date_from || order.created_at.slice(0, 10) >= query.date_from) &&
          (!query.date_to || order.created_at.slice(0, 10) <= query.date_to),
      )
      const pageNumber = Number(query.page || 1)
      return route.fulfill({
        json: {
          data: filtered.slice((pageNumber - 1) * 2, pageNumber * 2),
          meta: {
            current_page: pageNumber,
            last_page: Math.max(1, Math.ceil(filtered.length / 2)),
            per_page: 2,
            total: filtered.length,
          },
        },
      })
    }
    const orderMatch = path.match(/^\/orders\/(\d+)$/)
    if (orderMatch && request.method() === 'GET') {
      const id = Number(orderMatch[1])
      details.push(id)
      return route.fulfill({ json: { data: savedOrders.find((order) => order.id === id) } })
    }
    const statusMatch = path.match(/^\/orders\/(\d+)\/status$/)
    if (statusMatch && request.method() === 'PATCH') {
      const body = request.postDataJSON()
      const order = savedOrders.find((order) => order.id === Number(statusMatch[1]))
      changes.push({ id: order.id, ...body })
      Object.assign(order, body)
      return route.fulfill({ json: { data: order } })
    }
    return route.fulfill({ status: 404, json: { message: `Unexpected request: ${path}` } })
  })
  return { lists, changes, details }
}

test('orders search matches table, food, and order number on the loaded page', async ({ page }) => {
  const { lists } = await mockOrders(page)
  await page.goto('/dashboard/orders')
  const first = page.getByRole('button', { name: 'View order ORD-000001', exact: true })
  const second = page.getByRole('button', { name: 'View order ORD-000002', exact: true })
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'Search orders on this page', exact: true })
  await search.fill('007')
  await expect(first).toBeVisible()
  await expect(second).toHaveCount(0)
  await search.fill('KIMCHI')
  await expect(first).toHaveCount(0)
  await expect(second).toBeVisible()
  await search.fill('ORD-000001')
  await expect(first).toBeVisible()
  await expect(second).toHaveCount(0)
  await search.fill('Orange juice')
  await expect(first).toHaveCount(0)
  await expect(second).toHaveCount(0)
  await search.clear()
  await expect(first).toBeVisible()
  await expect(second).toBeVisible()
  expect(lists).toHaveLength(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('order details show notes, totals, and status and close with Escape', async ({ page }) => {
  const { details: requestedDetails } = await mockOrders(page)
  await page.goto('/dashboard/orders')
  const details = page.getByRole('button', { name: 'View order ORD-000001', exact: true })
  await details.click()
  const dialog = page.getByRole('dialog', { name: 'Order details', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('ORD-000001')
  await expect(dialog).toContainText('Table 007')
  await expect(dialog).toContainText('Pending')
  await expect(dialog).toContainText('Cheese pizza')
  await expect(dialog).toContainText('No onion')
  await expect(dialog).toContainText('$18.00')
  await expect(dialog).toContainText('$1.80')

  await expect(dialog).toContainText('$19.80')
  await expect(dialog).toContainText('2026')
  expect(requestedDetails).toEqual([1])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(details).toBeFocused()
})

test('an order status action updates the current order and its details', async ({ page }) => {
  const { lists, changes } = await mockOrders(page)
  await page.goto('/dashboard/orders')
  await page.getByRole('button', { name: 'Mark Confirmed', exact: true }).click()
  await expect.poll(() => changes).toEqual([{ id: 1, status: 'confirmed' }])
  await expect(page.getByRole('button', { name: 'Mark Preparing', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View order ORD-000001', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Order details', exact: true })).toContainText(
    'Confirmed',
  )
  expect(lists).toHaveLength(1)
})

test('cancelling an order requires confirmation and sends the staff reason', async ({ page }) => {
  const { changes } = await mockOrders(page)
  await page.goto('/dashboard/orders')
  await page
    .getByRole('searchbox', { name: 'Search orders on this page', exact: true })
    .fill('ORD-000001')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel order', exact: true })
  await expect(dialog).toBeVisible()
  expect(changes).toEqual([])
  const reason = dialog.getByLabel('Cancellation reason (optional)', { exact: true })
  await expect(reason).toHaveAttribute('maxlength', '255')
  await reason.fill('Customer requested cancellation')
  await dialog.getByRole('button', { name: 'Confirm cancellation', exact: true }).click()
  await expect
    .poll(() => changes)
    .toEqual([{ id: 1, status: 'cancelled', cancelled_reason: 'Customer requested cancellation' }])
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'View order ORD-000001', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Confirmed', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0)
})

test('order date and status filters reset pagination and reach the API', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-08T03:00:00Z') })
  const { lists } = await mockOrders(page)
  await page.goto('/dashboard/orders')
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => lists.at(-1)?.page).toBe('2')
  await expect(
    page.getByRole('button', { name: 'View order ORD-000003', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect
    .poll(() => lists.at(-1))
    .toMatchObject({ page: '1', date_from: '2026-10-08', date_to: '2026-10-08' })
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('2026-10-08')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => lists.at(-1)?.page).toBe('2')
  await page.getByRole('combobox', { name: 'Order status', exact: true }).selectOption('preparing')
  await expect
    .poll(() => lists.at(-1))
    .toMatchObject({
      page: '1',
      date_from: '2026-10-08',
      status: 'preparing',
    })
  await expect(
    page.getByRole('button', { name: 'View order ORD-000002', exact: true }),
  ).toBeVisible()
  await page.getByLabel('From', { exact: true }).fill('2026-10-07')
  await page.getByLabel('To', { exact: true }).fill('2026-10-09')
  await expect
    .poll(() => lists.at(-1))
    .toMatchObject({ date_from: '2026-10-07', date_to: '2026-10-09' })
  await expect.poll(() => lists.at(-1)?.date_from).toBe('2026-10-07')
  await page.getByRole('button', { name: 'All days', exact: true }).click()
  await expect.poll(() => lists.at(-1)).toEqual({ page: '1', status: 'preparing' })
})

for (const action of ['advance', 'cancel']) {
  test(`${action} on the last filtered page returns to the remaining orders`, async ({ page }) => {
    const pendingOrders = orders.map((order) => ({ ...order, status: 'pending' }))
    const { lists, changes } = await mockOrders(page, pendingOrders)
    await page.goto('/dashboard/orders')
    await page.getByLabel('From', { exact: true }).fill('2026-10-08')
    await page.getByRole('combobox', { name: 'Order status', exact: true }).selectOption('pending')
    await expect
      .poll(() => lists.at(-1))
      .toEqual({ page: '1', date_from: '2026-10-08', status: 'pending' })
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'View order ORD-000003', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'View order ORD-000001', exact: true }),
    ).toHaveCount(0)
    if (action === 'advance') {
      await page.getByRole('button', { name: 'Mark Confirmed', exact: true }).click()
      await expect.poll(() => changes).toEqual([{ id: 3, status: 'confirmed' }])
    } else {
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page
        .getByRole('dialog', { name: 'Cancel order', exact: true })
        .getByRole('button', { name: 'Confirm cancellation', exact: true })
        .click()
      await expect
        .poll(() => changes)
        .toEqual([{ id: 3, status: 'cancelled', cancelled_reason: 'Cancelled by staff' }])
    }
    await expect
      .poll(() => lists.at(-1))
      .toEqual({ page: '1', date_from: '2026-10-08', status: 'pending' })
    await expect(
      page.getByRole('button', { name: 'View order ORD-000001', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'View order ORD-000002', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'View order ORD-000003', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0)
  })
}
