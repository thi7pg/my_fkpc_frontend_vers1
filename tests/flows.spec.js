import { test, expect } from '@playwright/test'
import { translations } from '../src/languages/translations.js'
import { readFileSync } from 'node:fs'

const restaurant = {
  name: 'Fantasia',
  currency: 'USD',
  tax_percentage: 0,
  service_charge_percentage: 0,
}
const product = { id: 1, name: 'Pizza', price: 9.25, available: true }
const menu = {
  restaurant,
  table: { id: 1, table_number: '003', qr_token: 'table-token' },
  categories: [{ id: 1, name: 'Pizza', products: [product] }],
}
const order = {
  id: 1,
  order_number: 'FKPC-000001',
  table: menu.table,
  status: 'pending',
  subtotal: 9.25,
  tax_amount: 0,
  service_charge_amount: 0,
  total_amount: 9.25,
  created_at: '2026-10-06T07:04:36Z',
  items: [{ id: 1, product_id: 1, product_name: 'Pizza', quantity: 1, subtotal: 9.25 }],
}
const quote = { ...order, items: order.items }

async function mockApi(page, options = {}) {
  const requests = []
  let paid = false
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const endpoint = url.pathname.replace('/api/v1', '')
    const body = request.postDataJSON()
    requests.push({ endpoint, body, query: Object.fromEntries(url.searchParams) })
    let data
    if (options.failLogout && endpoint === '/auth/logout')
      return route.fulfill({ status: 503, json: { message: 'Offline' } })
    if (endpoint === '/auth/login')
      data = {
        user: { id: 2, name: 'Cashier User', role: options.role || 'cashier' },
        token: 'test-token',
      }
    else if (endpoint === '/auth/me')
      data = { user: { id: 2, name: 'Cashier User', role: options.role || 'cashier' } }
    else if (endpoint === '/auth/logout') data = null
    else if (endpoint.startsWith('/menu/')) data = menu
    else if (endpoint === '/cart/validate') data = quote
    else if (endpoint === '/orders' && request.method() === 'POST')
      data = {
        ...order,
        ...(body.payment_method === 'acleda' ? { payment_token: 'payment-token' } : {}),
      }
    else if (endpoint.startsWith('/orders/track/')) data = { ...order, table: '003' }
    else if (endpoint === '/orders') data = [order]
    else if (endpoint === '/orders/1') data = order
    else if (endpoint === '/orders/1/status') data = { ...order, status: body.status }
    else if (endpoint === '/cashier/payments')
      data = [
        {
          id: 1,
          order_id: 1,
          order_number: order.order_number,
          amount: 9.25,
          method: 'cash',
          status: paid ? 'paid' : 'pending',
          received_by: paid ? 'Cashier User' : null,
        },
      ].filter((p) => p.status === url.searchParams.get('status'))
    else if (endpoint === '/cashier/payments/1/pay') {
      paid = true
      data = {}
    } else if (endpoint.startsWith('/demo-payments/'))
      data = {
        amount: 9.25,
        status: 'pending',
        expired: false,
        qr_svg: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"></svg>',
      }
    else if (endpoint === '/admin/dashboard')
      data = {
        today_revenue: 0,
        today_orders: 1,
        pending_orders: 1,
        preparing_orders: 0,
        completed_orders: 0,
        recent_orders: [order],
        popular_menu: [],
      }
    else if (endpoint === '/kitchen/dashboard')
      data = { pending: [order], confirmed: [], preparing: [], ready: [] }
    else if (endpoint === '/admin/settings') data = restaurant
    else return route.fulfill({ status: 404, json: { message: `Unmocked endpoint ${endpoint}` } })
    await route.fulfill({ json: { data, meta: { current_page: 1, last_page: 1 } } })
  })
  return requests
}

async function login(page, role = 'cashier') {
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill(role)
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await expect(page).toHaveURL(
    role === 'cashier'
      ? /\/cashier\/dashboard$/
      : role === 'kitchen'
        ? /\/kitchen$/
        : /\/dashboard$/,
  )
  await expect(
    page.getByRole('heading', {
      name: role === 'kitchen' ? 'Kitchen' : 'Welcome back, Cashier',
      exact: true,
    }),
  ).toBeVisible()
}

async function checkout(page) {
  await page.goto('/order/menu/table-token')
  await page.getByRole('button', { name: 'Add Pizza to cart', exact: true }).first().click()
  await page.goto('/order/checkout')
  await expect(page.getByRole('button', { name: 'Confirm Order', exact: true })).toBeEnabled()
}

test('customer manual table entry opens the menu without overflow', async ({ page }) => {
  await mockApi(page)
  await page.goto('/order')
  await page.getByRole('button', { name: 'Enter table number', exact: true }).click()
  await page.getByLabel('Table number', { exact: true }).fill('003')
  await page.getByRole('button', { name: 'Confirm table', exact: true }).click()
  await expect(page).toHaveURL(/\/order\/menu\/003$/)
  await expect(page.getByRole('heading', { name: 'Our menu', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('customer camera photo decodes the table QR and opens its menu', async ({ page }) => {
  await mockApi(page)
  await page.goto('/order')
  const svg = readFileSync(new URL('./fixtures/table-menu.svg', import.meta.url), 'utf8')
  const photo = await page.evaluate(async (svg) => {
    const image = new Image()
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1200
    const context = canvas.getContext('2d')
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 650, 450, 300, 300)
    return canvas.toDataURL('image/png').split(',')[1]
  }, svg)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'table-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(photo, 'base64'),
  })
  await expect(page).toHaveURL(/\/order\/menu\/table-token$/)
})

test('customer cash checkout submits without personal information', async ({ page }) => {
  const requests = await mockApi(page)
  await checkout(page)
  await expect(page.locator('#name, #phone')).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirm Order', exact: true }).click()
  await expect(page).toHaveURL(/\/order\/track\/FKPC-000001$/)
  const submitted = requests.find((r) => r.endpoint === '/orders' && r.body)
  expect(submitted.body.customer_name).toBe('Table 003')
  expect(submitted.body.payment_method).toBe('cash')
})

test('customer ACLEDA option submits the renamed method and opens payment', async ({ page }) => {
  const requests = await mockApi(page)
  await checkout(page)
  await page.locator('#payment-method').selectOption('acleda')
  await page.getByRole('button', { name: 'Confirm Order', exact: true }).click()
  await expect(page).toHaveURL(/\/order\/payment\/FKPC-000001$/)
  await expect(
    page.getByRole('button', { name: 'Confirm test payment', exact: true }),
  ).toBeVisible()
  expect(requests.find((r) => r.endpoint === '/orders' && r.body).body.payment_method).toBe(
    'acleda',
  )
})

test('customer receipt exports an A6 PNG and supports keyboard dismissal', async ({ page }) => {
  await mockApi(page)
  await page.goto('/order/track/FKPC-000001')
  await page.getByRole('button', { name: 'Download Receipt', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Receipt', exact: true })
  await expect(dialog).toBeVisible()
  const image = dialog.getByRole('img', { name: 'Receipt', exact: true })
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((img) => [img.naturalWidth, img.naturalHeight]))
    .toEqual([1240, 1748])
  expect(
    await image.evaluate(async (img) => (await fetch(img.src)).headers.get('content-type')),
  ).toBe('image/png')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('customer corrupted saved cart does not crash startup', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() =>
    localStorage.setItem('cart_state', JSON.stringify({ items: {}, categories: null })),
  )
  await mockApi(page)
  await page.goto('/order')
  await expect(page.getByRole('heading', { name: 'Our menu', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('cashier cash payment validates tender and calculates change', async ({ page }) => {
  const requests = await mockApi(page)
  await login(page)
  await page.goto('/cashier')
  await page.getByRole('button').filter({ hasText: '#FKPC-000001' }).click()
  await expect(
    page.getByRole('button', { name: 'Receive Cash & Complete', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('Cash received', { exact: true }).fill('9')
  await expect(
    page.getByRole('button', { name: 'Receive Cash & Complete', exact: true }),
  ).toBeDisabled()
  await page.getByLabel('Cash received', { exact: true }).fill('10')
  await expect(page.getByRole('dialog').getByText('$0.75', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Receive Cash & Complete', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(requests.find((r) => r.endpoint.endsWith('/pay')).body.method).toBe('cash')
})

test('cashier bank payment requires received-transfer verification', async ({ page }) => {
  const requests = await mockApi(page)
  await login(page)
  await page.goto('/cashier')
  await page.getByRole('button').filter({ hasText: '#FKPC-000001' }).click()
  await page.getByRole('button', { name: 'Bank', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Confirm bank payment', exact: true }),
  ).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Confirm bank payment', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(requests.find((r) => r.endpoint.endsWith('/pay')).body.method).toBe('bank')
})

test('cashier order and payment date filters reach the API', async ({ page }) => {
  const requests = await mockApi(page)
  await login(page)
  await page.goto('/cashier/orders')
  await page.locator('#order-day').fill('2026-10-05')
  await expect
    .poll(() => requests.some((r) => r.endpoint === '/orders' && r.query.date === '2026-10-05'))
    .toBe(true)
  await page.getByRole('button', { name: 'Mark Confirmed', exact: true }).click()
  await expect
    .poll(() =>
      requests.some((r) => r.endpoint === '/orders/1/status' && r.body.status === 'confirmed'),
    )
    .toBe(true)
  await page.goto('/cashier')
  await page.locator('#payment-day').fill('2026-10-06')
  await expect
    .poll(() =>
      requests.some((r) => r.endpoint === '/cashier/payments' && r.query.date === '2026-10-06'),
    )
    .toBe(true)
})

test('staff logout still returns to login when the API is offline', async ({ page }) => {
  await mockApi(page, { failLogout: true })
  await login(page)
  await page.getByRole('button').filter({ hasText: 'Cashier User' }).click()
  await page.getByRole('button', { name: /Logout|Log out|Sign out/i }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('language selector persists Khmer and Korean across reloads', async ({ page }) => {
  await mockApi(page)
  await page.goto('/login')
  for (const code of ['km', 'ko', 'en']) {
    await page.locator('.language-selector select').selectOption(code)
    await expect(page.locator('html')).toHaveAttribute('lang', code)
    const heading = translations[code]?.['Welcome back'] || 'Welcome back'
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('.language-selector select')).toHaveValue(code)
  }
})
