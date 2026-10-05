// Run: node scripts/ui-smoke.cjs
// If Playwright is not installed locally, set PLAYWRIGHT_MODULE to its package path.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.UI_BASE_URL || 'http://127.0.0.1:5173';
const output = path.resolve('artifacts/ui-smoke');
fs.mkdirSync(output, { recursive: true });
const results = [];
const restaurant = { name: 'UI Test Restaurant', currency: 'THB', tax_percentage: 7, service_charge_percentage: 10 };
const product = { id: 1, name: 'Test Noodles', description: 'Fresh noodles', price: 100, available: true, preparation_time: 10 };
const menu = { restaurant, table: { id: 1, table_number: 'A1', capacity: 4 }, categories: [{ id: 1, name: 'Meals', products: [product, { ...product, id: 2, name: 'Sold Out Soup', available: false }] }] };
const order = { id: 1, order_number: 'UI-001', status: 'pending', table: 'A1', total_amount: 117, created_at: new Date().toISOString(), items: [{ id: 1, product_name: product.name, quantity: 1, subtotal: 100 }] };
async function test(name, fn) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`); }
}
async function visible(locator) { await locator.waitFor({ state: 'visible', timeout: 5000 }); }
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow');
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const label = viewport.width === 390 ? 'mobile' : 'desktop';
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      const requests = [];
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/api/v1/**', async route => {
        const request = route.request();
        const endpoint = new URL(request.url()).pathname.replace('/api/v1', '');
        requests.push({ endpoint, method: request.method(), body: request.postDataJSON() });
        let data;
        if (endpoint.startsWith('/menu/')) data = menu;
        else if (endpoint === '/orders' && request.method() === 'POST') data = order;
        else if (endpoint.startsWith('/orders/track/')) data = order;
        else return route.fulfill({ status: 404, json: { message: 'Unexpected mock endpoint' } });
        await route.fulfill({ json: { data } });
      });
      await test(`${label}: login and protected route redirect`, async () => {
        await page.goto(`${baseURL}/dashboard/orders`);
        await visible(page.getByRole('button', { name: 'Sign In', exact: true }));
        assert.match(page.url(), /\/login\?redirect=/);
        await noOverflow(page);
      });
      await test(`${label}: landing and manual table code`, async () => {
        await page.goto(`${baseURL}/order`);
        await page.getByRole('button', { name: 'Scan QR to Start Ordering' }).click();
        await page.getByPlaceholder('Enter table code').fill('table-a');
        await page.getByRole('button', { name: 'Go', exact: true }).click();
        await visible(page.getByRole('heading', { name: restaurant.name }));
        await noOverflow(page);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: `${output}/${label}-menu.png`, fullPage: true });
      });
      await test(`${label}: search, category, unavailable product`, async () => {
        await page.getByPlaceholder('Search dishes').fill('missing dish');
        await visible(page.getByText('No dishes found', { exact: true }));
        await page.getByPlaceholder('Search dishes').fill('');
        await page.getByRole('button', { name: 'Meals', exact: true }).click();
        assert.equal(await page.locator('article').count(), 2);
        assert.equal(await page.locator('article').filter({ hasText: 'Sold Out Soup' }).getByRole('button', { name: 'Add Sold Out Soup to cart', exact: true }).isDisabled(), true);
      });
      await test(`${label}: product details and cart drawer`, async () => {
        await page.getByRole('button', { name: 'View ' + product.name, exact: true }).click();
        await visible(page.getByRole('heading', { name: product.name }));
        await page.getByLabel('Special Note').fill('No onions');
        await page.getByRole('button', { name: /Add to Cart/ }).click();
        await visible(page.getByRole('heading', { name: restaurant.name }));
        await page.getByRole('button', { name: 'Open cart', exact: true }).click();
        await visible(page.getByRole('heading', { name: 'Your Order' }));
        assert.match(await page.locator('aside').innerText(), /No onions/);
        assert.match(await page.locator('aside').innerText(), /117\.00/);
        await noOverflow(page);
        await page.screenshot({ path: `${output}/${label}-cart-drawer.png`, fullPage: true });
      });
      await test(`${label}: drawer closes with Escape`, async () => {
        await page.keyboard.press('Escape');
        await page.locator('aside').waitFor({ state: 'hidden', timeout: 1500 });
      });
      await test(`${label}: checkout validation and successful submission`, async () => {
        if (!(await page.locator('aside').isVisible())) await page.getByRole('button', { name: 'Open cart', exact: true }).click();
        await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
        await page.getByRole('button', { name: 'Confirm Order' }).click();
        await visible(page.getByText('Please enter your name.'));
        assert.equal(requests.filter(r => r.endpoint === '/orders').length, 0);
        await page.getByLabel('Your Name').fill('UI Test Customer');
        await page.screenshot({ path: `${output}/${label}-checkout.png`, fullPage: true });
        await page.getByRole('button', { name: 'Confirm Order' }).click();
        await visible(page.getByText('#UI-001', { exact: true }));
        const placed = requests.find(r => r.endpoint === '/orders');
        assert.equal(placed.body.qr_token, 'table-a');
        assert.equal(placed.body.items[0].notes, 'No onions');
        assert.equal(placed.body.items[0].quantity, 1);
        await noOverflow(page);
        await page.screenshot({ path: `${output}/${label}-tracking.png`, fullPage: true });
      });
      await test(`${label}: cart clears after successful order`, async () => {
        await page.goto(`${baseURL}/order/cart`);
        await visible(page.getByText('Your cart is empty', { exact: true }));
      });
      await test(`${label}: no uncaught browser errors`, async () => assert.deepEqual(errors, []));
      await context.close();
    }
    for (const role of ['admin', 'kitchen', 'cashier']) {
      await test(`staff: ${role} login and role dashboard`, async () => {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          const user = { id: 1, name: 'UI Staff', role };
          await context.route('**/api/v1/**', route => {
            const endpoint = new URL(route.request().url()).pathname;
            if (endpoint.endsWith('/auth/login')) return route.fulfill({ json: { data: { user, token: 'mock-token' } } });
            if (endpoint.endsWith('/auth/me')) return route.fulfill({ json: { data: { user } } });
            if (endpoint.endsWith('/admin/dashboard')) return route.fulfill({ json: { data: { today_revenue: 0, today_orders: 0, pending_orders: 0, preparing_orders: 0, completed_orders: 0, recent_orders: [], popular_menu: [] } } });
            if (endpoint.endsWith('/kitchen/dashboard')) return route.fulfill({ json: { data: { pending: [], confirmed: [], preparing: [], ready: [] } } });
            if (endpoint.endsWith('/cashier/payments')) return route.fulfill({ json: { data: [] } });
            return route.fulfill({ status: 404, json: { message: 'Unexpected mock endpoint' } });
          });
          await page.goto(`${baseURL}/login`);
          await page.getByLabel('Email', { exact: true }).fill('ui@example.test');
          await page.getByLabel('Password', { exact: true }).fill('mock-password');
          await page.getByRole('button', { name: 'Sign In', exact: true }).click();
          await page.waitForURL(`${baseURL}/${role === 'admin' ? 'dashboard' : role}`);
          await visible(role === 'admin' ? page.getByText('Orders Today', { exact: true }) : role === 'cashier' ? page.getByText('No payments found') : page.getByRole('heading', { name: 'Pending', exact: true }));
          await page.screenshot({ path: `${output}/${role}-dashboard.png`, fullPage: true });
        } finally { await context.close(); }
      });
    }
    await test('customer: unavailable API displays error state', async () => {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.route('**/api/v1/**', route => route.abort('connectionrefused'));
        await page.goto(`${baseURL}/order/menu/invalid-ui-test`);
        await visible(page.getByText('Table not found', { exact: true }));
        await visible(page.getByText('Network Error', { exact: true }));
      } finally { await context.close(); }
    });
    await test('startup: corrupted auth storage recovers to login', async () => {
      const context = await browser.newContext();
      try {
        await context.addInitScript(() => localStorage.setItem('auth_user', '{broken'));
        const page = await context.newPage();
        await page.goto(`${baseURL}/login`);
        await visible(page.getByRole('button', { name: 'Sign In', exact: true }));
      } finally { await context.close(); }
    });
  } finally {
    await browser.close();
    fs.writeFileSync(`${output}/results.json`, JSON.stringify({ baseURL, mockedApi: true, results }, null, 2));
  }
  console.log(`\n${results.filter(r => r.status === 'passed').length}/${results.length} passed. Artifacts: ${output}`);
  if (results.some(r => r.status === 'failed')) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
