import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewPath = path.join(root, "views", "index.ejs");

const baseLocals = {
  stock: null,
  company: null,
  historicalData: [],
  error: null
};

function render(locals) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(viewPath, { ...baseLocals, ...locals }, {}, (error, html) => {
      if (error) reject(error);
      else resolve(html);
    });
  });
}

const stock = {
  symbol: "TEST",
  price: "100.00",
  change: "+1.00",
  changePercent: "+1.00%",
  open: "99.00",
  high: "101.00",
  low: "98.00",
  previousClose: "99.00",
  volume: 1234567
};

test("index renders the empty state", async () => {
  const html = await render({});
  assert.match(html, /No data yet/);
  assert.match(html, /id="search-results"/);
});

test("index renders an error without an errorTitle local", async () => {
  const html = await render({ error: "Invalid stock symbol." });
  assert.match(html, /Unable to fetch stock data/);
  assert.match(html, /Invalid stock symbol\./);
});

test("index renders the stock card and chart with history", async () => {
  const html = await render({
    stock,
    historicalData: [
      { date: "2026-01-02", close: "91.00" },
      { date: "2026-01-05", close: "92.00" }
    ],
    quoteUpdatedAt: "2026-01-05T20:00:00.000Z",
    quoteCached: false
  });

  assert.match(html, /Stock information for TEST/);
  assert.match(html, /Price History/);
  assert.match(html, /data-indicator="sma200"/);
});
