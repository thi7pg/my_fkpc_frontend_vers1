import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { translations } from '../src/languages/translations.js'

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? sourceFiles(path) : /\.(vue|js)$/.test(path) ? [path] : []
  })
}

test('static interface phrases and labels have Khmer and Korean translations', () => {
  const missing = []
  const literals =
    /(?:\$t|\bt)\(\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(?:label|title|message|actionLabel)\s*:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g
  for (const file of sourceFiles('src').filter((file) => !file.includes('/languages/'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(literals)) {
      const quoted = match[1] || match[2]
      const key = quoted.slice(1, -1).replace(/\\(['"\\])/g, '$1')
      if (!/[A-Za-z]/.test(key) || ['CSV', 'PDF'].includes(key)) continue
      const normalized = key.charAt(0).toUpperCase() + key.slice(1)
      for (const language of ['km', 'ko']) {
        if (!translations[language][key] && !translations[language][normalized])
          missing.push(`${file}: ${language}: ${key}`)
      }
    }
  }
  expect(missing).toEqual([])
})

test('translation dictionaries preserve placeholders and contain valid text', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
  for (const language of ['km', 'ko']) {
    for (const [key, value] of Object.entries(translations[language])) {
      expect(key, `${language}: whitespace in key`).toBe(key.trim())
      expect(value.trim(), `${language}: ${key}`).not.toBe('')
      expect(value, `${language}: ${key}`).not.toContain('\uFFFD')
      expect(placeholders(value), `${language}: ${key}`).toEqual(placeholders(key))
    }
  }
})

for (const language of ['km', 'ko']) {
  test(`tracking and checkout labels stay translated in ${language}`, async ({ page }) => {
    await page.addInitScript((language) => localStorage.setItem('language', language), language)
    await page.route('**/api/v1/**', (route) => {
      const isBill = new URL(route.request().url()).pathname.endsWith('/bill')
      const order = {
        id: 1,
        order_number: 'ORD-1',
        invoice_id: 1,
        table: '001',
        status: 'preparing',
        created_at: '2026-10-20T06:00:00Z',
        total_amount: 10,
        items: [{ id: 1, product_name: 'Pizza', quantity: 1, subtotal: 10 }],
      }
      return route.fulfill({
        json: {
          data: isBill
            ? {
                total_amount: 10,
                amount_due: 10,
                paid_amount: 0,
                payment: { status: 'pending' },
                items: order.items,
                orders: [order],
              }
            : order,
        },
      })
    })
    await page.goto('/order/track/ORD-1')
    const dictionary = translations[language]
    await expect(
      page.getByRole('heading', { name: dictionary['Your meal is being prepared'], exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: dictionary['Table Orders'], exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: dictionary.Checkout, exact: true })).toBeVisible()
    await expect(page.getByText(dictionary.Payment, { exact: true })).toBeVisible()
    await expect(page.getByText(dictionary['Total for this visit'], { exact: true })).toBeVisible()
    await expect(page.locator('main')).not.toContainText('Not checked out')
    await expect(page.locator('main')).not.toContainText('Total for this visit')
    await expect(page.locator('main')).toContainText('Pizza')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('an existing customer error updates immediately when the language changes', async ({
  page,
}) => {
  await page.goto('/order/product/1')
  const message = "Please scan your table's QR code to view the menu."
  await expect(page.locator('main')).toContainText(message)
  for (const language of ['km', 'ko', 'en']) {
    await page.getByRole('button', { name: 'Language', exact: true }).click()
    await page.getByRole('menuitemradio').nth(['en', 'km', 'ko'].indexOf(language)).click()
    await expect(page.locator('main')).toContainText(translations[language][message] || message)
  }
})
