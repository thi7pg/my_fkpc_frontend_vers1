# FKPC restaurant frontend

Vue application for table ordering, order tracking, kitchen operations, and cashier payments.

## Development

Run `npm install`, copy `.env.example` to `.env`, and set `VITE_API_BASE_URL` to the Laravel API URL. Start the frontend with `npm run dev`. Vite proxies `/api` requests to the configured backend during development.

The ACLEDA QR flow currently uses the backend's test-payment endpoints. It does not verify a real bank transfer. Cashiers can separately confirm received cash or bank payments.

## Checks

- `npm run lint`: check JavaScript and Vue code.
- `npm run format`: format source files.
- `npm run format:check`: verify formatting without editing files.
- `npm run build`: build production files in `dist`.
- `npm run test:ui`: run isolated desktop and mobile browser checks with mocked API responses.

Browser tests start their own Vite server on port 5175 and do not change the database. On Windows they use installed Microsoft Edge. Set `PLAYWRIGHT_CHANNEL` to use another installed browser, or run `npx playwright install chromium` on systems using Playwright's default Chromium.

Set `UI_BASE_URL` to an already running frontend URL to test that server instead. This avoids starting a second Vite server when process management is restricted.

Live QR scanning requires HTTPS on phones. HTTP connections use photo capture instead. Receipt downloads are A6-format PNG images; phone browsers may save downloads to Files rather than Photos.
