// Run with Playwright installed, or set PLAYWRIGHT_MODULE to its package path.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:5173';
const output = 'artifacts/ui-languages';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const { translations } = await import('../src/i18n/translations.js');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const code of ['en', 'km', 'ko']) {
      const expected = key => translations[code][key] || key;
      const context = await browser.newContext({ viewport: { width: 375, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { name: 'Admin', role: 'admin' };
      const product = { id: 1, name: 'Cheese Pizza', price: 8, available: true, image: '/food-illustration.svg' };
      const menu = { restaurant: { name: 'Fantasia', currency: 'USD' }, table: { table_number: 'A05' }, categories: [{ id: 1, name: 'Pizza', products: [product] }] };
      await context.route('**/api/v1/**', route => {
        const endpoint = new URL(route.request().url()).pathname;
        let data;
        if (endpoint.endsWith('/auth/login')) data = { user, token: 'mock-token' };
        else if (endpoint.endsWith('/auth/me')) data = { user };
        else if (endpoint.includes('/menu/')) data = menu;
        else if (endpoint.endsWith('/admin/settings')) data = { name: 'Fantasia', logo: '/restaurant-logo.jpg', currency: 'USD' };
        else if (endpoint.endsWith('/admin/dashboard')) data = { today_revenue: 0, today_orders: 0, pending_orders: 0, preparing_orders: 0, completed_orders: 0, recent_orders: [], popular_menu: [] };
        else if (endpoint.endsWith('/orders') && route.request().method() === 'POST') data = { order_number: 'LANG-001' };
        else if (endpoint.includes('/orders/track/')) data = { order_number: 'LANG-001', table: 'A05', status: 'preparing', total_amount: 8, items: [{ id: 1, product_name: product.name, quantity: 1, subtotal: 8 }], created_at: new Date().toISOString() };
        else data = [];
        return route.fulfill({ json: { data } });
      });
      async function noOverflow() {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${code} horizontal overflow at ${page.url()}`);
      }
      await page.goto(`${base}/login`);
      await page.locator('.language-selector select').selectOption(code);
      await page.getByRole('heading', { name: expected('Welcome back'), exact: true }).waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), code);
      await noOverflow();
      await page.reload();
      await page.getByRole('heading', { name: expected('Welcome back'), exact: true }).waitFor();
      assert.equal(await page.locator('.language-selector select').inputValue(), code);
      await page.screenshot({ path: `${output}/${code}-login.png`, fullPage: true });
      results.push(`${code}: login translation and persistence`);

      await page.goto(`${base}/order/menu/test-table`);
      await page.getByRole('heading', { name: 'Fantasia', exact: true }).waitFor();
      await page.getByRole('heading', { name: expected('Our menu'), exact: true }).waitFor();
      await noOverflow();
      await page.screenshot({ path: `${output}/${code}-menu.png`, fullPage: true });
      await page.getByRole('button', { name: expected('View {name}').replace('{name}', product.name), exact: true }).click();
      await page.getByRole('button', { name: expected('Add to Cart'), exact: true }).click();
      await page.waitForURL('**/menu/test-table');
      await page.goto(`${base}/order/checkout`);
      await page.getByRole('heading', { name: expected('Checkout'), exact: true }).waitFor();
      await page.getByLabel(expected('Your Name'), { exact: true }).fill('Test Guest');
      await noOverflow();
      await page.getByRole('button', { name: expected('Confirm Order'), exact: true }).click();
      await page.getByText('#LANG-001', { exact: true }).waitFor();
      await page.getByRole('heading', { name: expected('Preparing'), exact: true }).waitFor();
      await noOverflow();
      results.push(`${code}: menu, product, checkout, tracking and unchanged product name`);

      await page.goto(`${base}/login`);
      console.log(`Checking ${code} staff login at ${page.url()}`);
      await page.getByRole('button', { name: expected('Sign In'), exact: true }).waitFor();
      const username = page.getByLabel(expected('Username'), { exact: true });
      if (await username.count()) await username.fill('test-admin');
      else await page.getByLabel(expected('Email'), { exact: true }).fill('test@example.test');
      await page.getByLabel(expected('Password'), { exact: true }).fill('mock-password');
      await page.getByRole('button', { name: expected('Sign In'), exact: true }).click();
      await page.waitForURL('**/dashboard');
      await page.getByText(expected('Orders Today'), { exact: true }).waitFor();
      await page.goto(`${base}/dashboard/settings`);
      await page.getByRole('button', { name: expected('Save Settings'), exact: true }).waitFor();
      await noOverflow();
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('link', { name: expected('Tables'), exact: true }).waitFor();
      await page.screenshot({ path: `${output}/${code}-settings.png`, fullPage: true });
      assert.deepEqual(errors, []);
      results.push(`${code}: staff navigation, settings, desktop and mobile without browser errors`);
      await context.close();
    }
    // Switching back must restore the original English interface without reload.
    const page = await browser.newPage();
    await page.goto(`${base}/login`);
    for (const code of ['km', 'ko', 'en']) {
      await page.locator('.language-selector select').selectOption(code);
      await page.getByRole('heading', { name: translations[code]['Welcome back'] || 'Welcome back', exact: true }).waitFor();
    }
    results.push('Live language switching restores English');
    fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(`PASS ${results.length} multilingual flow checks`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
