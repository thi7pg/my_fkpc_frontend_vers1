import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs/dist/exceljs.min.js'

async function setup(page, type, fail = false) {
  const requests = []
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Admin', role: 'admin' }))
    localStorage.setItem('language', 'en')
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/auth/me'))
      return route.fulfill({ json: { data: { user: { id: 1, name: 'Admin', role: 'admin' } } } })
    if (url.pathname.endsWith('/admin/settings'))
      return route.fulfill({ json: { data: { currency: 'USD', name: 'FKPC' } } })
    const query = Object.fromEntries(url.searchParams)
    requests.push(query)
    const current = Number(query.page || 1)
    if (fail && current === 2)
      return route.fulfill({ status: 500, json: { message: 'Export page failed' } })
    const table = current === 2 ? '009' : '007'
    const record =
      type === 'orders'
        ? {
            id: current,
            order_number: `ORD-${current}`,
            created_at: '2026-11-05T08:00:00Z',
            table: { table_number: table },
            items: [{ quantity: 2, product_name: 'Pizza' }],
            status: 'pending',
            total_amount: current * 5,
          }
        : {
            id: current,
            order_number: `INV-${current}`,
            created_at: '2026-11-05T08:00:00Z',
            table,
            payment: { status: 'paid', method: 'cash', paid_at: '2026-11-06T08:00:00Z' },
            closed_at: '2026-11-05T09:00:00Z',
            paid_amount: current * 5,
            amount_due: 0,
          }
    return route.fulfill({
      json: { data: [record], meta: { current_page: current, last_page: 3 } },
    })
  })
  await page.goto(type === 'orders' ? '/dashboard/orders' : '/cashier')
  await page.getByLabel('From', { exact: true }).fill('2026-11-01')
  await page.getByLabel('To', { exact: true }).fill('2026-11-07')
  return requests
}

async function bytes(download) {
  const chunks = []
  for await (const chunk of await download.createReadStream()) chunks.push(chunk)
  return Buffer.concat(chunks)
}

for (const type of ['orders', 'payments']) {
  test(`${type} exports all filtered pages to Excel and PDF`, async ({ page }) => {
    const requests = await setup(page, type)
    if (type === 'orders')
      await page
        .getByRole('combobox', { name: 'Order status', exact: true })
        .selectOption('pending')
    else await page.getByRole('button', { name: 'Paid', exact: true }).click()
    await page.getByRole('searchbox').fill('007')
    for (const kind of ['Excel', 'PDF']) {
      const downloaded = page.waitForEvent('download')
      await page.getByRole('button', { name: kind, exact: true }).click()
      const buffer = await bytes(await downloaded)
      if (kind === 'Excel') {
        const book = new ExcelJS.Workbook()
        await book.xlsx.load(buffer)
        const sheet = book.worksheets[0]
        expect(sheet.getCell('A2').value).toBe(type === 'orders' ? 'ORD-1' : 'INV-1')
        expect(sheet.getCell('A3').value).toBe(type === 'orders' ? 'ORD-3' : 'INV-3')
        expect(sheet.getCell('F4').value.result).toBe(20)
      } else {
        const text = buffer.toString('latin1')
        expect(text).toContain(type === 'orders' ? '(ORD-1)' : '(INV-1)')
        expect(text).toContain(type === 'orders' ? '(ORD-3)' : '(INV-3)')
        expect(text).not.toContain(type === 'orders' ? '(ORD-2)' : '(INV-2)')
      }
    }
    expect(
      requests.some(
        (query) =>
          query.page === '3' &&
          query.date_from === '2026-11-01' &&
          query.date_to === '2026-11-07' &&
          query.status === (type === 'orders' ? 'pending' : 'closed'),
      ),
    ).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('a failed export page shows an error and creates no partial download', async ({ page }) => {
  await setup(page, 'orders', true)
  const downloads = []
  page.on('download', (download) => downloads.push(download))
  await page.getByRole('button', { name: 'Excel', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Export page failed')
  expect(downloads).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeEnabled()
})

test('paid invoice dates and export requests use the payment day and browser timezone', async ({
  page,
}) => {
  const requests = await setup(page, 'payments')
  await page.getByRole('button', { name: 'Paid', exact: true }).click()
  await expect(page.locator('.payment-date time').first()).toHaveAttribute(
    'datetime',
    '2026-11-06T08:00:00Z',
  )
  const timezone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  await expect
    .poll(() => requests.some((query) => query.status === 'closed' && query.timezone === timezone))
    .toBe(true)
})

for (const type of ['orders', 'payments']) {
  test(`${type} rejects duplicate records across export pages`, async ({ page }) => {
    await setup(page, type)
    await page.route(
      type === 'orders' ? '**/api/v1/orders?*' : '**/api/v1/cashier/invoices?*',
      (route) =>
        route.fulfill({
          json: {
            data: [{ id: 10, order_number: 'DUPLICATE', total_amount: 10 }],
            meta: { last_page: 2 },
          },
        }),
    )
    const downloads = []
    page.on('download', (download) => downloads.push(download))
    await page.getByRole('button', { name: 'Excel', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(
      'The list changed during export. Please try again.',
    )
    expect(downloads).toHaveLength(0)
    await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeEnabled()
  })
}

test('export rejects pagination that changes while reading pages', async ({ page }) => {
  await setup(page, 'orders')
  await page.route('**/api/v1/orders?*', (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page') || 1)
    return route.fulfill({
      json: { data: [{ id: current }], meta: { last_page: current === 1 ? 3 : 2 } },
    })
  })
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'The list changed during export. Please try again.',
  )
})
