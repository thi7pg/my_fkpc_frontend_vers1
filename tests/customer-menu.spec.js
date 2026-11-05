import { test, expect } from '@playwright/test'

async function mockMenu(page, discount = 20) {
  const products = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    name: index === 0 ? 'Fried Fish Cutlet' : `Pizza ${index}`,
    available: index !== 5,
    price: 5,
    discount_percent: index === 0 ? discount : 0,
    sales_count: 6 - index,
    image: '/food-illustration.svg',
  }))
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      json: {
        data: {
          restaurant: { name: 'Fantasia', currency: 'USD' },
          table: { id: 1, table_number: '001', qr_token: 'test-table' },
          categories: [
            { id: 1, name: 'Cutlet', products: products.slice(0, 1) },
            { id: 2, name: 'Pizza', products: products.slice(1) },
          ],
        },
      },
    }),
  )
  await page.goto('/order/menu/test-table')
  await expect(page.getByRole('heading', { name: 'Popular', exact: true })).toBeVisible()
}

test('customer menu filters popular dishes, reveals all and adds an item', async ({ page }) => {
  await mockMenu(page)
  const menu = page.locator('#menu-foods')
  await expect(menu.locator('article')).toHaveCount(4)
  await expect(page.locator('header')).toContainText('Table 001')
  await page.getByRole('button', { name: 'See All', exact: true }).click()
  await expect(menu.locator('article')).toHaveCount(6)
  await expect(
    page.getByRole('button', { name: 'Add Pizza 5 to cart', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Pizza', exact: true }).click()
  await expect(menu.locator('article')).toHaveCount(5)
  await page.getByRole('searchbox', { name: 'Search dishes' }).fill('Pizza 2')
  await expect(menu.locator('article')).toHaveCount(1)
  await page.getByRole('button', { name: 'Add Pizza 2 to cart', exact: true }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cart_state')))
  expect(saved.items[0].productId).toBe(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('menu has no promotional banner and language picker works on red header', async ({
  page,
}) => {
  await mockMenu(page)
  await expect(page.getByText('Special Menu', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/% OFF/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('menuitemradio').last().click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
