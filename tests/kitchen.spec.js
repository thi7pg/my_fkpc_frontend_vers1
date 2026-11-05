import { test, expect } from '@playwright/test'

test('kitchen keeps older orders visible and updates status', async ({ page }) => {
  const recent = new Date().toISOString()
  const older = new Date(Date.now() - 3 * 86400000).toISOString()
  const orders = [
    {
      id: 2,
      order_number: 'FKPC-000002',
      created_at: recent,
      table: { table_number: '002' },
      notes: 'Serve together',
      items: [
        {
          id: 2,
          quantity: 2,
          product_name: 'Pizza',
          notes: 'No onion',
          product: { image: 'https://example.test/pizza.svg' },
        },
      ],
    },
    {
      id: 1,
      order_number: 'FKPC-000001',
      created_at: older,
      table: { table_number: '001' },
      items: [],
    },
  ]
  let status
  const transitions = []
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 3, name: 'Kitchen User', role: 'kitchen' }),
    )
  })
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/status')) {
      status = route.request().postDataJSON().status
      transitions.push(status)
      return route.fulfill({ json: { data: {} } })
    }
    const data = url.pathname.endsWith('/kitchen/dashboard')
      ? {
          pending: orders.filter((order) => order.id !== 2 || !status),
          confirmed: status === 'confirmed' ? [orders[0]] : [],
          preparing: status === 'preparing' ? [orders[0]] : [],
          ready: [],
        }
      : { user: { id: 3, name: 'Kitchen User', role: 'kitchen' } }
    await route.fulfill({ json: { data } })
  })
  await page.route('https://example.test/pizza.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="orange"/></svg>',
    }),
  )
  await page.goto('/kitchen')
  await expect(page.locator('.kitchen-ticket')).toHaveCount(2)
  await expect(page.locator('.kitchen-ticket').first()).toContainText('Table 001')
  await expect(page.getByText('Note: No onion')).toBeVisible()
  await expect(page.locator('.kitchen-time').first()).toContainText('3d')
  await page.getByLabel('Filter by day').selectOption('today')
  await expect(page.locator('.kitchen-ticket')).toHaveCount(1)
  await expect(
    page.getByText('unfinished orders from earlier days', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('img', { name: 'Pizza', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View details', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Serve together')
  await expect(dialog).toContainText('No onion')
  await expect(dialog.getByRole('img', { name: 'Pizza', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect.poll(() => status).toBe('preparing')
  expect(transitions).toEqual(['confirmed', 'preparing'])
  await expect(page.locator('.kitchen-column').nth(1)).toContainText('FKPC-000002')
  await expect(page.getByRole('button', { name: 'Start cooking', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark ready', exact: true })).toBeVisible()
})

test('kitchen names, options and notes stay readable after customer styles load', async ({
  page,
}) => {
  const productName =
    'Korean cheese pizza (M, Cheese, Extra mozzarella, Sweet corn, Mushrooms, Bell peppers, Spicy chicken, Garlic sauce)'
  const itemNotes = 'No onion, please.\nUse a separate sauce cup.'
  const orderNotes = 'Serve all dishes together.\nOne customer has a peanut allergy.'
  const order = {
    id: 15,
    order_number: 'ORD-000015',
    created_at: new Date().toISOString(),
    table: { table_number: '001' },
    notes: orderNotes,
    items: [
      {
        id: 15,
        quantity: 2,
        product_name: productName,
        product_image: 'https://example.test/pizza.svg',
        notes: itemNotes,
      },
    ],
  }
  const user = { id: 3, name: 'Kitchen User', role: 'kitchen' }
  await page.addInitScript((user) => {
    localStorage.setItem('auth_token', 'test-token')
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, user)
  await page.route('**/api/v1/**', (route) => {
    const data = new URL(route.request().url()).pathname.endsWith('/kitchen/dashboard')
      ? { pending: [order], confirmed: [], preparing: [], ready: [] }
      : { user }
    return route.fulfill({ json: { data } })
  })
  await page.route('https://example.test/pizza.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="orange"/></svg>',
    }),
  )

  await page.goto('/kitchen')
  const ticket = page.locator('.kitchen-ticket')
  await expect(ticket).toHaveCount(1)
  // Customer styles remain in the document when moving between layouts in the SPA.
  await page.addStyleTag({ path: 'src/customer.css' })

  async function expectReadable(container) {
    const name = container.getByText(productName, { exact: true })
    await expect(name).toBeVisible()
    const clippedBy = await name.evaluate((element) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const textRects = [...range.getClientRects()]
      const clipped = []
      let current = element
      while (current && !current.matches('article, dialog')) {
        const style = getComputedStyle(current)
        const bounds = current.getBoundingClientRect()
        const clipsX = ['hidden', 'clip'].includes(style.overflowX)
        const clipsY = ['hidden', 'clip'].includes(style.overflowY)
        if (
          textRects.some(
            (rect) =>
              (clipsX && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) ||
              (clipsY && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)),
          )
        ) {
          clipped.push(current.className)
        }
        current = current.parentElement
      }
      return clipped
    })
    expect(clippedBy).toEqual([])
    await expect(container.getByText('No onion, please.', { exact: false })).toBeVisible()
    await expect(container.getByText('Use a separate sauce cup.', { exact: false })).toBeVisible()
    await expect(container.getByText('Serve all dishes together.', { exact: false })).toBeVisible()
    await expect(
      container.getByText('One customer has a peanut allergy.', { exact: false }),
    ).toBeVisible()
    await expect(container.getByRole('img', { name: productName, exact: true })).toBeVisible()
  }

  await expectReadable(ticket)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await ticket.getByRole('button', { name: 'View details', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expectReadable(dialog)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
