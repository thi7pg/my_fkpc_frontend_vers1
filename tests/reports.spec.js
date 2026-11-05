import { test, expect } from '@playwright/test'
import ExcelJS from 'exceljs/dist/exceljs.min.js'

test.use({ timezoneId: 'Asia/Bangkok' })

const admin = { id: 1, name: 'Admin User', role: 'admin' }

function report(total) {
  return {
    total_revenue: total,
    total_orders: 1,
    total_invoices: 1,
    series: [{ period: '2026-10-07', revenue: total, orders_count: 1 }],
  }
}

async function mockReports(page, handleReport) {
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, admin)
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/admin/reports/revenue')) return handleReport(route, url)
    const data = url.pathname.endsWith('/auth/me')
      ? { user: admin }
      : { name: 'Fantasia', currency: 'USD' }
    return route.fulfill({ json: { data } })
  })
}

test('report presets use the local date and load once at the start of the day', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-06T18:15:00Z'))
  const requests = []
  const warnings = []
  page.on('console', (message) => {
    if (message.text().includes('Duplicate keys')) warnings.push(message.text())
  })
  await mockReports(page, (route, url) => {
    requests.push(Object.fromEntries(url.searchParams))
    return route.fulfill({ json: { data: report(0.75) } })
  })

  await page.goto('/dashboard/reports')
  await expect(page.getByText('$0.75', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Invoices', { exact: true })).toBeVisible()
  expect(requests).toEqual([
    { from: '2026-10-01', to: '2026-10-07', group_by: 'day', timezone: 'Asia/Bangkok' },
  ])
  expect(warnings).toEqual([])

  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('Yesterday')
  await expect.poll(() => requests.at(-1)?.from).toBe('2026-10-06')
  expect(requests.at(-1)?.to).toBe('2026-10-06')
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('Custom')
  await expect(page.locator('input[type="date"]').nth(0)).toHaveValue('2026-10-06')
  await expect(page.locator('input[type="date"]').nth(1)).toHaveValue('2026-10-06')
})

test('This Year groups revenue by month and shorter presets return to daily grouping', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-20T06:00:00Z'))
  const requests = []
  await mockReports(page, (route, url) => {
    const params = Object.fromEntries(url.searchParams)
    requests.push(params)
    return route.fulfill({
      json: {
        data: {
          ...report(107.5),
          group_by: params.group_by,
          series: [
            {
              period: params.group_by === 'month' ? '2026-10' : '2026-10-20',
              revenue: 107.5,
              orders_count: 13,
            },
          ],
        },
      },
    })
  })
  await page.goto('/dashboard/reports')
  await expect(page.getByRole('button', { name: /Oct 20, Revenue:/ })).toBeVisible()
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('This Year')
  const chart = page.getByRole('region', { name: 'Revenue', exact: true })
  await expect(page.getByRole('combobox')).toHaveValue('This Year')
  await expect(chart.getByRole('button', { name: /Oct 26, Revenue:/ })).toBeVisible()
  expect(requests.at(-1)).toEqual({
    from: '2026-01-01',
    to: '2026-10-20',
    group_by: 'month',
    timezone: 'Asia/Bangkok',
  })
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('This Month')
  await expect(page.getByRole('combobox')).toHaveValue('This Month')
  expect(requests.at(-1).group_by).toBe('day')
  expect(requests).toHaveLength(3)
})

test('a delayed report response cannot replace the latest selected range', async ({ page }) => {
  let delayedRoute
  let requestCount = 0
  await mockReports(page, (route) => {
    requestCount++
    if (requestCount === 1) {
      delayedRoute = route
      return
    }
    return route.fulfill({ json: { data: report(17) } })
  })

  await page.goto('/dashboard/reports')
  await expect.poll(() => Boolean(delayedRoute)).toBe(true)
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('Today')
  await expect(page.getByText('$17.00', { exact: true }).first()).toBeVisible()

  await delayedRoute.fulfill({ json: { data: report(99) } })
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('$17.00', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('$99.00', { exact: true })).toHaveCount(0)
  expect(requestCount).toBe(2)
})

test('long revenue charts stay inside the card and support keyboard selection', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-08T06:00:00Z'))
  const series = Array.from({ length: 30 }, (_, i) => ({
    period: new Date(Date.UTC(2026, 8, i + 9)).toISOString().slice(0, 10),
    revenue: i + 1,
    orders_count: 1,
  }))
  await mockReports(page, (route) =>
    route.fulfill({
      json: {
        data: {
          group_by: 'day',
          total_revenue: 465,
          total_orders: 30,
          series,
          daily_summary: series.map((point) => ({ ...point, paid_invoices: 1 })),
        },
      },
    }),
  )
  await page.goto('/dashboard/reports')
  const chart = page.getByRole('region', { name: 'Revenue', exact: true })
  const bars = chart.getByRole('button', { name: /Revenue:/ })
  await expect(bars).toHaveCount(30)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await bars.first().click()
  await page.keyboard.press('Tab')
  await expect(bars.nth(1)).toBeFocused()
  await expect(chart.locator('header')).toContainText('$2.00')
  await bars.last().click()
  await expect(chart.locator('header')).toContainText('$30.00')

  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  await expect(
    page.getByRole('table', { name: 'Daily sales summary' }).locator('tbody tr'),
  ).toHaveCount(15)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('table', { name: 'Daily sales summary' })).toContainText('2026-10-08')
})

test('a failed refresh keeps the previous report readable', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  let monthlyLoaded = false
  await mockReports(page, (route) => {
    if (!monthlyLoaded) {
      monthlyLoaded = true
      return route.fulfill({
        json: {
          data: {
            ...report(10),
            group_by: 'month',
            series: [{ period: '2026-10', revenue: 10, orders_count: 1 }],
          },
        },
      })
    }
    if (monthlyLoaded)
      return route.fulfill({ status: 503, json: { message: 'Reports temporarily unavailable' } })
    return route.fulfill({ json: { data: { ...report(10), group_by: 'day' } } })
  })
  await page.goto('/dashboard/reports')
  const chart = page.getByRole('region', { name: 'Revenue', exact: true })
  await expect(chart.getByRole('button', { name: /Revenue:/ })).toBeVisible()
  await expect(chart.getByRole('button', { name: /Oct 26, Revenue:/ })).toBeVisible()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Reports temporarily unavailable')
  await expect(chart.getByRole('button', { name: /Oct 26, Revenue:/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('report exports download the loaded date range and real totals', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-20T06:00:00Z'))
  await mockReports(page, (route) =>
    route.fulfill({
      json: {
        data: {
          ...report(168),
          total_orders: 16,
          completed_orders: 14,
          cancelled_orders: 2,
        },
      },
    }),
  )
  await page.goto('/dashboard/reports')
  await expect(page.getByText('$168.00', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toHaveCount(0)
  for (const extension of ['PDF', 'Excel']) {
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: extension, exact: true }).click()
    const download = await downloaded
    expect(download.suggestedFilename()).toBe(
      `report-2026-10-01-2026-10-20.${extension === 'Excel' ? 'xlsx' : extension.toLowerCase()}`,
    )
    const stream = await download.createReadStream()
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    const text = buffer.toString('latin1')
    if (extension === 'PDF') {
      expect(text.startsWith('%PDF-')).toBe(true)
      expect(text).toContain('(Revenue Report)')
      expect(text).toContain('(USD 168.00)')
      expect(text).toContain('(Completed orders)')
      expect(text).toContain('(Page 1 of 1)')
      const start = Number(text.match(/startxref\n(\d+)/)[1])
      expect(text.slice(start, start + 4)).toBe('xref')
    } else {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(buffer)
      const summary = workbook.getWorksheet('Summary')
      expect(summary.getCell('C5').value).toBe('2026-10-01')
      expect(summary.getCell('C6').value).toBe('2026-10-20')
      expect(summary.getCell('E12').value).toBe(168)
      expect(summary.getCell('E14').value).toBe(14)
      expect(summary.getCell('A16').value).toBe('Total invoices')
      expect(summary.getCell('E16').value).toBe(1)
      expect(summary.getCell('E12').numFmt).toContain('USD')
      expect(summary.views[0].showGridLines).toBe(false)
      expect(summary.pageSetup.printArea).toContain('A1:F')
      const revenue = workbook.getWorksheet('Revenue')
      expect(revenue.getCell('A8').value).toBe('2026-10-07')
      expect(revenue.getCell('B8').value).toBe(168)
      expect(revenue.getCell('C8').value).toBe(1)
      expect(revenue.getCell('B9').value).toEqual({ formula: 'SUM(B8:B8)', result: 168 })
      expect(revenue.views[0].ySplit).toBe(7)
    }
  }
})

test('long PDF exports repeat table headings and retain the final row', async ({ page }) => {
  const series = Array.from({ length: 120 }, (_, index) => ({
    period: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    revenue: 1,
    orders_count: 1,
  }))
  await mockReports(page, (route) =>
    route.fulfill({
      json: { data: { total_revenue: 120, total_orders: 120, series } },
    }),
  )
  await page.goto('/dashboard/reports')
  const button = page.getByRole('button', { name: 'PDF', exact: true })
  await expect(button).toBeEnabled()
  const downloaded = page.waitForEvent('download')
  await button.click()
  const download = await downloaded
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('latin1')
  const pages = [...text.matchAll(/\/Type \/Page\b/g)].length
  expect(pages).toBeGreaterThan(1)
  expect(text.match(/\(Period\)/g)).toHaveLength(pages)
  expect(text).toContain('(2026-04-30)')
  expect(text).toContain(`(Page ${pages} of ${pages})`)
  expect(text).toContain('(Unavailable)')
})

test('Khmer exports preserve the selected language and system colors', async ({ page }) => {
  await mockReports(page, (route) => route.fulfill({ json: { data: report(25) } }))
  await page.goto('/dashboard/reports')
  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page
    .getByRole('menuitemradio')
    .filter({ has: page.locator('[lang="km"]') })
    .click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'km')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  const download = await downloaded
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString('latin1')).toContain('/Subtype /Image')
  const excelDownloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Excel', exact: true }).click()
  const excelStream = await (await excelDownloaded).createReadStream()
  const excelChunks = []
  for await (const chunk of excelStream) excelChunks.push(chunk)
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(Buffer.concat(excelChunks))
  expect(book.getWorksheet('Summary').getCell('A1').value).toBe('របាយការណ៍')
  expect(book.getWorksheet('Summary').getCell('A11').fill.fgColor.argb).toBe('FFFFF0F3')
  expect(book.getWorksheet('Summary').getCell('A1').font.name).toBe('Khmer OS Siemreap')
})

test('report shows unavailable status counts honestly and supports custom dates', async ({
  page,
}) => {
  const requests = []
  await mockReports(page, (route, url) => {
    requests.push(Object.fromEntries(url.searchParams))
    return route.fulfill({ json: { data: report(10) } })
  })
  await page.goto('/dashboard/reports')
  await expect(page.getByTitle('Not available')).toHaveCount(2)
  await page.getByRole('combobox', { name: 'Date range', exact: true }).selectOption('Custom')
  await page.getByLabel('From', { exact: true }).fill('2026-01-01')
  await expect.poll(() => requests.at(-1)?.from).toBe('2026-01-01')
  await page.getByLabel('To', { exact: true }).fill('2026-01-31')
  await expect.poll(() => requests.at(-1)?.to).toBe('2026-01-31')
})

test('refresh updates real order totals and status counts without changing the range', async ({
  page,
}) => {
  const requests = []
  await mockReports(page, (route, url) => {
    requests.push(Object.fromEntries(url.searchParams))
    return route.fulfill({
      json: {
        data: {
          ...report(requests.length === 1 ? 10 : 20),
          total_all_orders: 8,
          completed_orders: 5,
          cancelled_orders: 2,
        },
      },
    })
  })
  await page.goto('/dashboard/reports')
  await expect(page.getByText('$10.00', { exact: true }).first()).toBeVisible()
  await expect(page.getByTitle('Not available')).toHaveCount(0)
  await expect(
    page.getByTitle('Total Orders', { exact: true }).getByText('Orders', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveValue('This Month')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('$20.00', { exact: true }).first()).toBeVisible()
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
})
