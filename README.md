# FKPC restaurant frontend

Vue application for table ordering, order tracking, kitchen operations, and cashier payments.

## Development

Run `npm install`, copy `.env.example` to `.env`, and set `VITE_API_BASE_URL` to the Laravel API URL. Start the frontend with `npm run dev`. Vite proxies `/api` requests to the configured backend during development.

## Ordering and payment

1. Customers scan their table QR, choose products and options, then select **Place Order** in the cart. They can order more during the same dining session; each order stays separate for kitchen tracking.
2. When ready to pay, customers select **Checkout** from order tracking. This sends a checkout request to the cashier without collecting payment online.
3. The cashier receives cash or confirms a bank payment at the counter, then settles the combined session payment. The customer sees one paid receipt, and the session closes for the next customer.

## Checks

- `npm run lint`: check JavaScript and Vue code.
- `npm run format`: format source files.
- `npm run format:check`: verify formatting without editing files.
- `npm run build`: build production files in `dist`.
- `npm run test:ui`: run isolated desktop and mobile browser checks with mocked API responses.

Browser tests start their own Vite server on port 5175 and do not change the database. On Windows they use installed Microsoft Edge. Set `PLAYWRIGHT_CHANNEL` to use another installed browser, or run `npx playwright install chromium` on systems using Playwright's default Chromium.

Set `UI_BASE_URL` to an already running frontend URL to test that server instead. This avoids starting a second Vite server when process management is restricted.

Live QR scanning requires HTTPS on phones. HTTP connections use photo capture instead. Receipt downloads are A6-format PNG images; phone browsers may save downloads to Files rather than Photos.

The Tables page generates QR images from each table's current API token and the frontend's origin. Display and printing use the same generated image, so stale storage files cannot supply an outdated menu link. **New QR** rotates the token; replace the printed table code after using it.
