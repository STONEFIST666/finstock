# FinStock

FinStock is a stock market analysis platform built with Express and EJS. Search any ticker to see a live quote, a daily price-history chart, and company fundamentals in one responsive page.

## Features

- Live stock quotes (price, open, high, low, previous close, volume, daily change)
- Company overview (description, sector, industry, market cap, P/E, EPS, ROE, margin, dividend yield)
- Interactive price-history chart (Chart.js) with 1M / 3M / 6M / ALL ranges filtered entirely in the browser
- Technical indicators computed client-side: SMA 20/50/200 overlays and an RSI 14 panel with 30/70 guide lines
- Clickable popular-symbol chips, a remembered chart range, and a loading skeleton while a search is in flight
- Keyboard-friendly controls, skip navigation, visible focus states, and reduced-motion support
- Watchlist stored in the browser (localStorage): star toggle on the stock card, one-click re-search, remove controls, and cross-tab sync
- In-place quote refresh backed by `GET /api/quote/:symbol`, with cached responses and a last-updated timestamp
- Market news from Yahoo Finance RSS (`GET /api/news/:symbol`), loaded on demand and cached for 30 minutes with no extra API key
- Portfolio tracker in `localStorage`: positions, cost basis, market value, unrealized P&L, totals, inline editing, and on-demand price refreshes
- Search with normalization (`  aapl ` → `AAPL`), permissive symbol validation, loading state, and duplicate-submit protection
- Friendly error states for invalid symbols, rate limits, network failures, and missing data
- Responsive, accessible UI

## Tech stack

- Node.js + Express 5
- EJS templates
- Axios
- fast-xml-parser (Yahoo Finance RSS)
- Chart.js 4 (vendored at `public/vendor/chart.umd.js`, no CDN at runtime)
- Alpha Vantage API (quotes, fundamentals, history)

## Getting started

Prerequisites: Node.js 18+ and a free [Alpha Vantage](https://www.alphavantage.co/support/#api-key) API key.

```bash
npm install
copy .env.example .env    # macOS/Linux: cp .env.example .env
# add your key to .env
npm start
```

Open http://localhost:3000.

```env
ALPHA_VANTAGE_API_KEY=your_api_key_here
# Optional; defaults to 3000. Hosting platforms usually set this for you.
PORT=3000
```

The key is read from `.env` locally or from the environment in production. `.env` is gitignored — never commit it.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the server on `PORT` (default `3000`) |
| `npm run dev` | Start with file watching (`node --watch`) |
| `npm test` | Run the test suite (`node --test`) |

## Deployment

Configure `ALPHA_VANTAGE_API_KEY` as a secret in the hosting dashboard and let the platform set `PORT`. `npm start` is the production command; Node 18+ is required. Invalid `PORT` values fall back to `3000`.

- There is no database or login. Watchlists and portfolios live in each visitor's `localStorage`.
- Caches are in-process, so they reset on restart and are not shared between multiple instances.
- Keep `.env` out of git. Use the host's environment/secret manager instead.

## Project structure

```
index.js                 Express app, search route, validation, duplicate guard
routes/apiQuote.js       GET /api/quote/:symbol JSON endpoint
routes/apiNews.js        GET /api/news/:symbol JSON endpoint
services/alphaVantage.js Alpha Vantage client, throttling, caching, errors
services/news.js         Yahoo Finance RSS fetch, parse, and 30-minute cache
services/cache.js        Small TTL cache with size limits and stale reads
services/quotes.js       Maps Alpha Vantage quotes to the app shape
services/symbols.js      Symbol normalization and validation
services/config.js       PORT parsing with a safe default
views/index.ejs          Single-page UI, chart, range controls, client scripts
public/style.css         Styles, focus states, skeleton, reduced-motion rules
public/js/               Watchlist, portfolio, chart, quote refresh, and client logic
public/vendor/           Vendored Chart.js build
tests/                   Unit tests (node:test)
```

## How it works

1. `POST /search` normalizes and validates the symbol before any API request.
2. The service fetches the global quote, company overview, and daily time series through one throttled client (1.2s spacing).
3. Company overview and daily history are cached for 12 hours, quotes for 60 seconds, and a single overview retry is made on rate-limit responses. History falls back to a stale copy if a refresh fails.
4. Historical data is serialized into the page and drawn by Chart.js; range buttons filter the loaded data in memory, so switching ranges costs no API calls.
5. The quote card can refresh in place through `GET /api/quote/:symbol`, which reuses the same quote cache and returns `lastUpdated` plus a `cached` flag.
6. The watchlist lives entirely in `localStorage` (`finstock.watchlist.v1`, capped at 20 symbols). Opening a saved symbol submits the existing `/search` form, so no extra endpoints or API calls are introduced.
7. Market news is fetched only when the user presses **Load news**. The server reads the ticker-specific Yahoo Finance RSS feed, keeps the five newest valid articles, and caches them for 30 minutes. This path does not use Alpha Vantage or its quota.
8. The portfolio is stored in `localStorage` (`finstock.portfolio.v1`, capped at 50 positions) with a separate quote cache (`finstock.portfolio.prices.v1`). Adding a position fetches its price; **Refresh prices** reuses `/api/quote/:symbol` for every holding. Missing prices are fetched once on load, but otherwise prices only update on request, so the page does not quietly spend quota.
9. Technical indicators are computed in the browser from the already-loaded history: SMA 20/50/200 overlays and a separate RSI 14 panel. Toggles only show indicators the available history can support, and switching ranges costs no API calls.
10. The chart range is remembered in `localStorage` (`finstock.chartRange.v1`) and restored on the next search. Choosing a popular chip reuses the same validated search form, and the main results are replaced by an accessible loading skeleton until the page responds.

> Alpha Vantage's `NEWS_SENTIMENT` endpoint is premium-only on the current plan, which is why news uses RSS instead.

## API quota notes

The Alpha Vantage free tier allows roughly 25 requests per day. One uncached search uses up to three requests (quote, overview, history); repeat searches within the cache windows use fewer or none. Invalid input is rejected before any request is made, refreshes within 60 seconds hit the quote cache, and the in-memory duplicate-search guard drops repeated identical submissions within one second. News uses Yahoo Finance RSS, so it costs no Alpha Vantage quota. Portfolio refreshes use one quote request per holding, deduplicated by the 60-second server cache. Caches are per-process and reset when the server restarts.

## Roadmap

- Expanded test coverage and deployment hardening

## License

ISC
