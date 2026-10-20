import test from "node:test";
import assert from "node:assert/strict";
import { toStockQuote } from "../services/quotes.js";

const apiPayload = {
  "Global Quote": {
    "01. symbol": "AAPL",
    "02. open": "170.0000",
    "03. high": "175.5000",
    "04. low": "169.1000",
    "05. price": "174.2000",
    "06. volume": "51234567",
    "07. latest trading day": "2026-10-19",
    "08. previous close": "170.5000",
    "09. change": "3.7000",
    "10. change percent": "2.1701%"
  }
};

test("maps an Alpha Vantage global quote into the app shape", () => {
  assert.deepEqual(toStockQuote(apiPayload), {
    symbol: "AAPL",
    open: "170.0000",
    high: "175.5000",
    low: "169.1000",
    price: "174.2000",
    volume: "51234567",
    latestTradingDay: "2026-10-19",
    previousClose: "170.5000",
    change: "3.7000",
    changePercent: "2.1701%"
  });
});

test("returns null for empty or malformed payloads", () => {
  assert.equal(toStockQuote(null), null);
  assert.equal(toStockQuote({}), null);
  assert.equal(toStockQuote({ "Global Quote": {} }), null);
  assert.equal(toStockQuote({ "Global Quote": { "05. price": "1.00" } }), null);
});
