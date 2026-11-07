import { test, expect } from '@playwright/test'

test('cashier filters the payment list by date and status and searches the loaded page', async ({
  page,
}) => {
  const requests = []
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Cashier', role: 'cashier' }))
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    requests.push(Object.fromEntries(url.searchParams))
    const closed = url.searchParams.get('status') === 'closed'
    const data = [
      { id: 1, table: '001', amount_due: 10, paid_amount: 10 },
      { id: 2, table: '002', amount_due: 7, paid_amount: 7 },
    ].map((session) => ({
      ...session,
      order_number: `INV-FKPC-00000${session.id}`,
      closed_at: closed ? '2026-10-07T07:00:00Z' : null,
      checkout_requested_at: '2026-10-07T06:00:00Z',
      can_settle: !closed,
    }))
    return route.fulfill({ json: { data, meta: { last_page: 2 } } })
  })
  await page.goto('/cashier')
  await expect(page.getByRole('button', { name: 'Pending', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('.payments-summary')).toContainText('$17.00')
  await page.getByLabel('Search table or invoice').fill('002')
  await expect(page.locator('.payment-row')).toHaveCount(1)
  await expect(page.locator('.payments-summary')).toContainText('$7.00')
  await page.getByLabel('Search table or invoice').fill('')
  await page.getByLabel('From').fill('2026-10-07')
  await page.getByLabel('To', { exact: true }).fill('2026-10-09')
  await expect
    .poll(() =>
      requests.some(
        (query) =>
          query.date_from === '2026-10-07' &&
          query.date_to === '2026-10-09' &&
          query.status === 'open',
      ),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (query) =>
          query.date_from === '2026-10-07' && query.date_to === '2026-10-09' && query.page === '2',
      ),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Paid', exact: true }).click()
  await expect
    .poll(() =>
      requests.some(
        (query) =>
          query.status === 'closed' &&
          query.date_from === '2026-10-07' &&
          query.date_to === '2026-10-09' &&
          query.page === '1',
      ),
    )
    .toBe(true)
  await expect(page.locator('.payment-row-action').first()).toHaveText('View receipt')
  await page.getByLabel('From', { exact: true }).fill('2026-10-10')
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('2026-10-10')
  await page.getByRole('button', { name: 'All days', exact: true }).click()
  await expect
    .poll(() =>
      requests.some((query) => query.status === 'closed' && !query.date_from && !query.date_to),
    )
    .toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
