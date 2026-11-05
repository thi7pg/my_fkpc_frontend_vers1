import { test, expect } from '@playwright/test'

async function setup(page, { stale = false, loseResponse = false } = {}) {
  const originals = [10, 15, 20, 8, 9].map((amount, index) => ({
    id: index + 1,
    table: String(index + 1),
    tables: [{ id: index + 1, table: String(index + 1) }],
    order_number: `INV-${index + 1}`,
    created_at: '2026-11-05T07:00:00Z',
    closed_at: null,
    can_settle: true,
    amount_due: amount,
    total_amount: amount,
    paid_amount: 0,
    payment: { status: 'pending' },
    orders: [],
    items: [
      {
        id: index + 1,
        table: String(index + 1),
        product_name: 'Pizza',
        quantity: 1,
        subtotal: amount,
      },
    ],
  }))
  let bills = [...originals]
  let combined = null
  let receipt = null
  const payments = []
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test')
    localStorage.setItem('auth_user', JSON.stringify({ id: 2, name: 'Cashier', role: 'cashier' }))
    localStorage.setItem('language', 'en')
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith('/invoices/merge/preview')) {
      return route.fulfill({
        json: { data: { invoices: originals.slice(0, 3), total_amount: 45 } },
      })
    }
    if (path.endsWith('/invoices/merge')) {
      if (stale)
        return route.fulfill({
          status: 409,
          json: { message: 'An invoice total changed. Refresh and review before combining.' },
        })
      combined = {
        ...originals[0],
        table: '1, 2, 3',
        tables: originals.slice(0, 3).flatMap((bill) => bill.tables),
        items: originals.slice(0, 3).flatMap((bill) => bill.items),
        amount_due: 45,
        total_amount: 45,
      }
      bills = [combined, ...originals.slice(3)]
      return route.fulfill({ json: { data: combined } })
    }
    if (path.endsWith('/invoices/1/pay')) {
      payments.push(route.request().postDataJSON())
      receipt = {
        ...combined,
        paid_amount: 45,
        amount_due: 0,
        can_settle: false,
        payment: { status: 'paid', method: 'bank' },
      }
      bills = [receipt, ...originals.slice(3)]
      if (loseResponse && payments.length === 1) return route.abort('failed')
      return route.fulfill({ json: { data: receipt } })
    }
    if (path.endsWith('/invoices')) {
      const paid = url.searchParams.get('status') === 'closed'
      return route.fulfill({
        json: {
          data: bills.filter((bill) => (bill.payment.status === 'paid') === paid),
          meta: { last_page: 1 },
        },
      })
    }
    return route.fulfill({ json: { data: { name: 'FKPC', currency: 'USD' } } })
  })
  await page.goto('/cashier')
  await expect(page.locator('.payment-row')).toHaveCount(5)
  await page.getByRole('button', { name: 'Combine invoices', exact: true }).click()
  for (const table of ['1', '2', '3'])
    await page.getByRole('checkbox', { name: `Table ${table}`, exact: true }).check()
  await page.getByRole('button', { name: 'Review invoices', exact: true }).click()
  const merge = page.getByRole('dialog', { name: 'Combine invoices', exact: true })
  await expect(merge.getByText('$45.00', { exact: true })).toBeVisible()
  return { merge, payments }
}

test('cashier combines three tables into one invoice and pays once while two tables stay separate', async ({
  page,
}) => {
  const { merge, payments } = await setup(page)
  await merge.getByRole('button', { name: 'Combine invoices', exact: true }).click()
  const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true })
  await expect(checkout).toBeVisible()
  await expect(page.locator('.payment-row')).toHaveCount(3)
  await checkout.getByLabel('Payment method').selectOption('bank')
  await checkout.getByRole('checkbox').check()
  await checkout.getByRole('button', { name: 'Confirm payment', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Receipt', exact: true })).toBeVisible()
  expect(payments).toHaveLength(1)
  expect(payments[0].expected_cents).toBe(4500)
  expect(payments[0].request_key).toMatch(/^[a-f0-9-]{36}$/)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Pending', exact: true }).click()
  await expect(page.locator('.payment-row')).toHaveCount(2)
  await expect(page.locator('.payment-row').first()).toContainText('Table 4')
})

test('cashier must review again when a selected invoice changes', async ({ page }) => {
  const { merge, payments } = await setup(page, { stale: true })
  await merge.getByRole('button', { name: 'Combine invoices', exact: true }).click()
  await expect(merge.getByRole('alert')).toContainText('total changed')
  await expect(merge.getByRole('button', { name: 'Combine invoices', exact: true })).toBeDisabled()
  expect(payments).toHaveLength(0)
  await expect(page.locator('.payment-row')).toHaveCount(5)
})

test('cashier retries a lost payment response with the same request key', async ({ page }) => {
  const { merge, payments } = await setup(page, { loseResponse: true })
  await merge.getByRole('button', { name: 'Combine invoices', exact: true }).click()
  const checkout = page.getByRole('dialog', { name: 'Checkout', exact: true })
  await checkout.getByLabel('Payment method').selectOption('bank')
  await checkout.getByRole('checkbox').check()
  await checkout.getByRole('button', { name: 'Confirm payment', exact: true }).click()
  await checkout.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Receipt', exact: true })).toBeVisible()
  expect(payments).toHaveLength(2)
  expect(payments[1]).toEqual(payments[0])
})
