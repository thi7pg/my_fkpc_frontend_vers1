import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs/dist/exceljs.min.js'

async function setup(page) {
  await page.clock.setFixedTime(new Date('2026-11-05T07:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Admin', role: 'admin' }))
    localStorage.setItem('language', 'en')
  })
  const products = [
    { id: '1', name: 'Cheese pizza', category: 'Food', quantity: 12, sales: 30 },
    { id: '2', name: 'Fish cutlet', category: 'Food', quantity: 8, sales: 20 },
    { id: '3', name: 'Cola', category: 'Drinks', quantity: 6, sales: 20 },
    { id: '4', name: 'Ice cream', category: 'Desserts', quantity: 3, sales: 10.5 },
  ]
  const daily = Array.from({ length: 5 }, (_, index) => ({
    period: `2026-11-0${index + 1}`,
    revenue: index === 3 ? 22.25 : index === 4 ? 58.25 : 0,
    orders_count: index === 3 ? 8 : index === 4 ? 3 : 0,
    paid_invoices: index === 3 ? 2 : index === 4 ? 3 : 0,
  }))
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/admin/reports/revenue')
      ? {
          group_by: 'day',
          total_revenue: 80.5,
          total_all_orders: 11,
          total_orders: 11,
          total_invoices: 5,
          completed_orders: 10,
          cancelled_orders: 0,
          series: daily,
          orders_series: daily,
          daily_summary: daily,
          product_sales: products,
          top_products: products,
          category_sales: [
            { name: 'Food', sales: 50, quantity: 20 },
            { name: 'Drinks', sales: 20, quantity: 6 },
            { name: 'Desserts', sales: 10.5, quantity: 3 },
          ],
        }
      : path.endsWith('/auth/me')
        ? { user: { id: 1, name: 'Admin', role: 'admin' } }
        : { name: 'FKPC', currency: 'USD' }
    return route.fulfill({ json: { data } })
  })
  await page.goto('/dashboard/reports')
  await expect(page.getByText('$80.50', { exact: true })).toBeVisible()
}

test('overview has four charts and Details reveals searchable real-data tables', async ({
  page,
}, testInfo) => {
  await setup(page)
  await expect(page.getByRole('region', { name: 'Revenue', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Orders', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sales by category' })).toContainText('$50.00')
  await expect(page.getByRole('region', { name: 'Top 5 best-selling products' })).toContainText(
    'Cheese pizza',
  )
  await expect(page.getByRole('table')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (testInfo.project.name === 'desktop')
    await page.screenshot({ path: 'artifacts/report-redesign-preview.png', fullPage: true })
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  const daily = page.getByRole('table', { name: 'Daily sales summary' })
  await expect(daily.locator('tbody tr')).toHaveCount(5)
  await expect(daily.locator('tbody tr').first()).toContainText('$0.00')
  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'View all', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const table = page.getByRole('table', { name: 'Product sales details' })
  await expect(table.locator('tbody tr')).toHaveCount(4)
  await page.getByRole('searchbox').fill('Drinks')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table).toContainText('Cola')
  await page.getByRole('searchbox').fill('missing')
  await expect(table).toContainText('No data yet')
})

test('Excel includes daily, category and product datasets and PDF includes their headings', async ({
  page,
}) => {
  await setup(page)
  for (const kind of ['Excel', 'PDF']) {
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: kind, exact: true }).click()
    const stream = await (await downloaded).createReadStream()
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    if (kind === 'Excel') {
      const book = new ExcelJS.Workbook()
      await book.xlsx.load(buffer)
      expect(book.getWorksheet('Daily sales').getCell('B6').value).toBe(58.25)
      expect(book.getWorksheet('Products').getCell('A2').value).toBe('Cheese pizza')
      expect(book.getWorksheet('Products').getCell('D2').value).toBe(30)
      expect(book.getWorksheet('Categories').getCell('C2').value).toBe(50)
      expect(book.getWorksheet('Best sellers').getCell('B2').value).toBe(12)
    } else {
      const text = buffer.toString('latin1')
      expect(text).toContain('(Product sales details)')
      expect(text).toContain('(Sales by category)')
      expect(text).toContain('(Cheese pizza)')
    }
  }
})

test('Khmer overview and detailed exports retain translated headings', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page
    .getByRole('menuitemradio')
    .filter({ has: page.locator('[lang="km"]') })
    .click()
  await expect(page.getByRole('tab', { name: 'ទិដ្ឋភាពទូទៅ', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'ព័ត៌មានលម្អិត', exact: true }).click()
  await expect(
    page.getByRole('table', { name: 'សង្ខេបការលក់ប្រចាំថ្ងៃ', exact: true }),
  ).toBeVisible()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  const stream = await (await downloaded).createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('latin1')
  expect([...text.matchAll(/\/Type \/Page\b/g)].length).toBeGreaterThanOrEqual(5)
  expect(text).toContain('/Subtype /Image')
})
