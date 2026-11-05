import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const decoder = readFileSync(createRequire(import.meta.url).resolve('jsqr'), 'utf8')
const admin = { id: 1, name: 'Admin User', role: 'admin' }
const currentToken = 'table005CurrentToken8Zq7K4'
const replacementToken = 'table005ReplacementToken9Xa2'

async function mockTables(page, token = currentToken) {
  let table = {
    id: 5,
    table_number: '005',
    capacity: 4,
    status: 'available',
    qr_token: token,
    qr_code_image: '/storage/qrcodes/005.svg',
  }
  const storageRequests = []
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, admin)
  await page.route('**/storage/qrcodes/**', (route) => {
    storageRequests.push(route.request().url())
    return route.fulfill({
      contentType: 'image/svg+xml',
      body: readFileSync(new URL('./fixtures/table-menu.svg', import.meta.url), 'utf8'),
    })
  })
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (path === '/auth/me') return route.fulfill({ json: { data: admin } })
    if (path === '/admin/settings')
      return route.fulfill({ json: { data: { name: 'FKPC', currency: 'USD' } } })
    if (path === '/admin/tables') return route.fulfill({ json: { data: [table] } })
    if (path === '/admin/tables/5/regenerate-qr' && route.request().method() === 'POST') {
      table = { ...table, qr_token: replacementToken }
      return route.fulfill({ json: { data: table } })
    }
    return route.fulfill({ status: 404, json: { message: `Unexpected request: ${path}` } })
  })
  return storageRequests
}

async function readQr(page) {
  await page.addScriptTag({ content: decoder })
  return page.getByRole('img', { name: 'QR code', exact: true }).evaluate(async (image) => {
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    return window.jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null
  })
}

test('table QR uses the current API token and prints the displayed image', async ({ page }) => {
  const storageRequests = await mockTables(page)
  await page.goto('/dashboard/tables')
  const image = page.getByRole('img', { name: 'QR code', exact: true })
  await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/)
  expect(await readQr(page)).toBe(`${new URL(page.url()).origin}/order/menu/${currentToken}`)

  await page.evaluate(() => {
    const append = Element.prototype.append
    Element.prototype.append = function (...nodes) {
      const result = append.apply(this, nodes)
      for (const node of nodes) {
        if (node instanceof HTMLIFrameElement) {
          node.contentWindow.print = () => {
            window.printedQrImage = node.contentDocument.querySelector('img')?.src
          }
        }
      }
      return result
    }
  })
  const displayedImage = await image.getAttribute('src')
  await page.getByRole('button', { name: 'Print QR', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.printedQrImage)).toBe(displayedImage)
  expect(storageRequests).toEqual([])
})

test('New QR shows the replacement token without reading a stale storage image', async ({
  page,
}) => {
  const storageRequests = await mockTables(page)
  await page.goto('/dashboard/tables')
  await expect(page.getByRole('button', { name: 'Print QR', exact: true })).toBeEnabled()
  expect(await readQr(page)).toBe(`${new URL(page.url()).origin}/order/menu/${currentToken}`)

  const refreshed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/v1/admin/tables' &&
      response.request().method() === 'GET',
  )
  await page.getByRole('button', { name: 'New QR', exact: true }).click()
  await refreshed
  await expect(page.getByRole('button', { name: 'Print QR', exact: true })).toBeEnabled()
  await expect
    .poll(() => readQr(page))
    .toBe(`${new URL(page.url()).origin}/order/menu/${replacementToken}`)
  expect(storageRequests).toEqual([])
})

test('a table without a token cannot display or print a stored QR image', async ({ page }) => {
  const storageRequests = await mockTables(page, null)
  await page.goto('/dashboard/tables')
  await expect(page.getByText('005', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR code', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Print QR', exact: true })).toBeDisabled()
  expect(storageRequests).toEqual([])
})
