# Banking

A Next.js app using Prisma 7 and Neon Postgres.

## Project structure

The project follows the reference repository's root-level layout:

- `app/` — Next.js App Router pages, layouts, and styles
- `lib/` — shared server-side utilities, including the Prisma client
- `prisma/` — Prisma schema and migrations
- `generated/prisma/` — generated Prisma Client (ignored by Git; regenerate with `npm run db:generate`)

## Requirements

- Node.js 20.19 or newer
- npm
- A Neon Postgres project

## Setup

1. If `.env` does not already exist, copy `.env.example` to `.env`. Keep your real
   connection strings in `.env`, not in `.env.example`.
2. In the Neon Console, open **Connect** and copy the PostgreSQL connection strings:
   - Put the pooled connection string in `DATABASE_URL` for app queries.
   - Put the direct, unpooled connection string in `DATABASE_URL_UNPOOLED` for Prisma migrations.
3. Install dependencies and generate the Prisma client:

   ```powershell
   npm install
   npm run db:generate
   ```

4. Apply the Prisma schema to the database:

   ```powershell
   npm run db:migrate -- --name init
   ```

5. (Optional) Add the product catalog plus five demo users and their buy/sell trades:

   ```powershell
   npm run db:seed
   ```

   The seed is safe to rerun: it updates these demo records without deleting
   other users or trades. Use it only with a development or demo database.

6. Start the app:

   ```powershell
   npm run dev
   ```

Open <http://localhost:3000>.

Prisma uses the SQL connection strings from Neon **Connect**; the pooled URL is
for application requests and the direct URL is for migrations.

## Mock admin dashboard

The home page is the mock **Bank app preview**. It shows account and portfolio
summaries, product filters and details, range-selectable portfolio/product
charts, hovered price and timestamp, and order history. Product price charts
show the selected user's latest buy and sell for that asset when there is an
open holding; the markers reveal saved order prices and timestamps. Chart axes
use the server-provided period high and low. Browse investments searches the
stored catalog and Yahoo Finance; supported results can be added to the catalog
and opened with Yahoo-backed market history. Yahoo Finance's search and chart
endpoints are unofficial, require no API key, and may be rate-limited. Market
history is cached for about 15 minutes. The page uses same-server
`/api/admin/bank` routes rather than calling the client application's `/v1`
routes directly from the browser. Its `GET /api/admin/bank/product-search?q=...`
searches Yahoo Finance, and `POST /api/admin/bank/product-search` with
`{"symbol":"AAPL"}` adds a supported listing to the mock catalog and loads its
recent market history. Supported listing types are stocks, funds/ETFs, bonds,
and crypto.
This prototype does not authenticate visitors and must not be used with real
customer data or exposed as a production admin portal.

## Mock investment API

### Versioned bank API

The `/v1` API implements the bank contract for a separate client app. Requests
that read or change a user's account, portfolio, or orders must send:

```http
X-User-Id: customer-123
```

This header identifies the mock account; it is **not authentication**. Anyone
who knows a user ID can access that user's mock data. Call the API only from
your server, populate the ID from your authenticated session, and never let an
LLM choose it. Public product and area endpoints do not need the header.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/account` | Create or return the user's mock cash account |
| `DELETE` | `/v1/account` | Prototype reset: delete the user's account, holdings and orders (`204`) |
| `GET` | `/v1/portfolio` | Current holdings, valuations, totals, and P/L |
| `GET` | `/v1/portfolio/history?range=1M` | Server-calculated portfolio chart |
| `GET` | `/v1/products` | Search/filter/sort the product catalog and current prices |
| `GET` | `/v1/products/{symbol}` | Product details and calculated risk/return metrics |
| `GET` | `/v1/products/{symbol}/history?range=1M` | Server-calculated product price chart |
| `GET` | `/v1/areas` | Product areas and counts |
| `POST` | `/v1/orders` | Place an immediate market buy or sell |
| `GET` | `/v1/orders` | List the user's orders |
| `GET` | `/v1/orders/{orderId}` | Read an order belonging to the user |
| `DELETE` | `/v1/orders/{orderId}` | Cancel a pending order |

Holdings and orders carry an optional `accountRef` (the client's planning
account ID; stored as `""` and returned as `null` when unassigned).
`POST /v1/orders` accepts it, and `GET /v1/portfolio`, `/v1/portfolio/history`
and `/v1/orders` accept `?accountRef=` to filter. Cash stays shared per user,
holdings are keyed by `(userId, accountRef, symbol)`, and a sell can only use
holdings under the same `accountRef`. Order quantities have at most 6 decimals
(amount orders round down). Cash settlement rounds `quantity × price` **up** to
cents for buys and **down** for sells. This prevents repeated fractional trades
from creating cash through cent rounding. Buy cost basis includes the actual
cash debit. A sub-cent sell may close a dust position for zero proceeds.
For an `amount` order, the bank first rounds the amount down to cents, divides
by price, and rounds quantity down to 6 decimals; a buy debit never exceeds
that budget. Amounts below one cent cannot produce a fill. Clients must show
the settlement rule before confirmation and treat the returned `total` as
the amount actually debited or credited.

Ranges are `1D`, `1W`, `1M`, `3M`, `1Y`, and `ALL` (default `1M`). The server
chooses an interval and downsamples chart data. It computes portfolio/product
metrics and chart summaries; clients should only display those values.
Portfolio history omits points with unpriced open holdings, so different
market opening times cannot make a holding look worthless. Earlier complete
valuations remain available before a later-listed product is bought.

The seeded catalog is USD-denominated. A first access to an unknown user creates
a mock account with USD 50,000. Market prices and history are refreshed lazily
from Yahoo Finance and stored in the database; Yahoo's chart endpoint is
unofficial, requires no API key, and may be rate-limited. Prices are cached for
about 15 minutes. Catalog responses include `unavailableSymbols`; products with
no usable quote at the selected server time are omitted without hiding usable
products. New Yahoo imports validate market data before atomically publishing
the product and its snapshot. Historical performance is not a guarantee of future results.
Product descriptions and risk notes are not financial advice. The client must
show an explicit human confirmation before it submits an order.

The admin preview is not authenticated and accepts a mock user ID. The
`/api/admin/bank` adapter exists only to power this local mock preview; do not
deploy it as an admin or customer-facing endpoint.

Example buy request:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/v1/orders" `
  -Method Post `
  -Headers @{ "X-User-Id" = "customer-123" } `
  -ContentType "application/json" `
  -Body '{"symbol":"VTI","side":"buy","type":"market","quantity":2,"idempotencyKey":"buy-vti-request-0001"}'
```

Successful new orders return HTTP `201`; repeating the same idempotency key for
the same user returns the original order rather than filling twice. Errors use
`{ "error": { "code": "...", "message": "..." } }`.
Conflicting trades are retried up to three times after the initial attempt.
If contention persists, `/v1/orders` returns HTTP `503` with `ACCOUNT_BUSY`;
retry the same request with its original idempotency key.

Before using `/v1`, apply committed migrations and seed the product catalog and
demo portfolios:

```powershell
npm run db:deploy
npm run db:seed
```

### Legacy mock investment routes

These existing routes remain available for compatibility with the earlier
prototype:

- `GET /options` — list available instruments with stable `option_id` values.
- `GET /user/{id}` — return user details, investment summary, holdings, and recent transactions. A user is known after a transaction is recorded or if a matching `User` row exists.
- `GET /user/{id}/options` — list the user's currently owned instruments and net quantities.
- `POST /transaction/buy` — record a simulated buy.
- `POST /transaction/sell` — record a simulated sell; selling more than the current owned quantity is rejected.

Buy and sell requests require JSON with `option_id`, `user_id`, and a positive
`quantity` (up to 1,000,000). The `option_id` must come from `GET /options`.
Each transaction stores a mock unit price and a server-generated timestamp.
Successful transactions return HTTP `201`.
Legacy sells check ownership in a serializable transaction and retry conflicts,
so concurrent sells cannot each spend the same owned units. Persistent
contention returns HTTP `503`.

```json
{
  "option_id": "stock-aapl",
  "user_id": "customer-123",
  "quantity": 2
}
```

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/transaction/buy" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"option_id":"stock-aapl","user_id":"customer-123","quantity":2}'
```

## Commands

- `npm run dev` — start the development server
- `npm run build` / `npm start` — build and run the production app
- `npm run lint` / `npm run typecheck` — validate code
- `npm test` — run isolated backend and preview regressions without a database or network
- `npm run db:generate` — generate Prisma Client
- `npm run db:migrate` — create and apply a development migration
- `npm run db:deploy` — apply committed migrations
- `npm run db:seed` — add or update demo users and investment trades
- `npm run db:studio` — open Prisma Studio

## Server time

The bank runs on its own clock, stored in the `ServerClock` table (no row = the real clock). Change it from the
clock panel on the admin page, `PUT /api/admin/clock` with `{ "serverTime": "2026-03-02T15:00:00Z", "frozen": false }`
(`serverTime: null` returns to the real clock), and read it from `GET /v1/time`.

Market data is a stored snapshot (`PriceBar`, downloaded from Yahoo Finance on first use and refreshed every 15 minutes
when the server time is ahead of the snapshot). Quotes, price charts, order fills, portfolio values, and the legacy
`/options` and `/user/[id]` endpoints read the latest bar at or before the server time. Orders are stamped with the
server time, so P/L and holding periods run from the buy time to the server time. Run `npm run db:deploy` to apply the migration.
