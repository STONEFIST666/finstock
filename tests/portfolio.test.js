import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_POSITIONS,
  PRICE_MAX_AGE_MS,
  addPosition,
  isPriceFresh,
  parsePortfolio,
  parsePriceCache,
  portfolioTotals,
  positionMetrics,
  removePosition,
  sanitizePositions,
  serializePortfolio,
  updatePosition
} from "../public/js/portfolio-store.js";

test("parsePortfolio survives corrupt data and sanitizes positions", () => {
  assert.deepEqual(parsePortfolio("not json"), []);
  assert.deepEqual(parsePortfolio("null"), []);
  assert.deepEqual(parsePortfolio('{"symbol":"AAPL"}'), []);

  assert.deepEqual(
    parsePortfolio('["AAPL", {"symbol":" aapl ","shares":"10","avgCost":"150"}]'),
    [{ symbol: "AAPL", shares: 10, avgCost: 150 }]
  );
});

test("sanitizePositions drops invalid rows and merges duplicates", () => {
  const result = sanitizePositions([
    { symbol: "AAPL", shares: 10, avgCost: 100 },
    { symbol: "aapl", shares: 10, avgCost: 200 },
    { symbol: "", shares: 1, avgCost: 1 },
    { symbol: "TSLA", shares: 0, avgCost: 1 },
    { symbol: "MSFT", shares: 2, avgCost: -1 },
    null
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].symbol, "AAPL");
  assert.equal(result[0].shares, 20);
  assert.equal(result[0].avgCost, 150);
});

test("serializePortfolio round-trips through parsePortfolio", () => {
  const positions = [{ symbol: "AAPL", shares: 3, avgCost: 120.5 }];
  assert.deepEqual(parsePortfolio(serializePortfolio(positions)), positions);
});

test("addPosition validates input and merges an existing symbol", () => {
  assert.equal(addPosition([], { symbol: "", shares: 1, avgCost: 1 }).reason, "invalid-symbol");
  assert.equal(addPosition([], { symbol: "AAPL", shares: 0, avgCost: 1 }).reason, "invalid-shares");
  assert.equal(addPosition([], { symbol: "AAPL", shares: 1, avgCost: -1 }).reason, "invalid-cost");

  const first = addPosition([], { symbol: "aapl", shares: 10, avgCost: 100 });
  assert.equal(first.added, true);
  assert.deepEqual(first.list, [{ symbol: "AAPL", shares: 10, avgCost: 100 }]);

  const merged = addPosition(first.list, { symbol: "AAPL", shares: 10, avgCost: 200 });
  assert.equal(merged.updated, true);
  assert.deepEqual(merged.list, [{ symbol: "AAPL", shares: 20, avgCost: 150 }]);
});

test("addPosition enforces the position cap", () => {
  const full = Array.from({ length: MAX_POSITIONS }, (_, i) => ({
    symbol: "S" + i,
    shares: 1,
    avgCost: 1
  }));
  assert.equal(addPosition(full, { symbol: "NEW", shares: 1, avgCost: 1 }).reason, "full");
});

test("updatePosition edits shares and cost without touching other rows", () => {
  const list = [
    { symbol: "AAPL", shares: 10, avgCost: 100 },
    { symbol: "TSLA", shares: 2, avgCost: 300 }
  ];

  const result = updatePosition(list, "aapl", { shares: 5, avgCost: 120 });
  assert.equal(result.updated, true);
  assert.deepEqual(result.list, [
    { symbol: "AAPL", shares: 5, avgCost: 120 },
    { symbol: "TSLA", shares: 2, avgCost: 300 }
  ]);

  assert.equal(updatePosition(list, "MSFT", { shares: 1, avgCost: 1 }).reason, "not-found");
  assert.equal(updatePosition(list, "AAPL", { shares: 0, avgCost: 1 }).reason, "invalid-shares");
});

test("removePosition removes only the requested symbol", () => {
  const result = removePosition(
    [{ symbol: "AAPL", shares: 1, avgCost: 1 }, { symbol: "TSLA", shares: 1, avgCost: 1 }],
    "aapl"
  );
  assert.equal(result.removed, true);
  assert.deepEqual(result.list, [{ symbol: "TSLA", shares: 1, avgCost: 1 }]);
  assert.equal(removePosition(result.list, "AAPL").removed, false);
});

test("positionMetrics calculates value, cost, and return", () => {
  const metrics = positionMetrics({ symbol: "AAPL", shares: 10, avgCost: 100 }, 150);
  assert.deepEqual(metrics, {
    costBasis: 1000,
    marketValue: 1500,
    pnl: 500,
    pnlPercent: 50
  });

  assert.equal(positionMetrics({ symbol: "AAPL", shares: 10, avgCost: 100 }, null), null);
  assert.equal(positionMetrics({ symbol: "AAPL", shares: 0, avgCost: 100 }, 150), null);
});

test("portfolioTotals aggregates priced positions and counts the rest", () => {
  const positions = [
    { symbol: "AAPL", shares: 10, avgCost: 100 },
    { symbol: "TSLA", shares: 2, avgCost: 300 },
    { symbol: "MSFT", shares: 1, avgCost: 50 }
  ];
  const prices = {
    AAPL: { price: 150, fetchedAt: 1 },
    TSLA: { price: 200, fetchedAt: 1 }
  };

  const totals = portfolioTotals(positions, prices);
  assert.equal(totals.marketValue, 1900);
  assert.equal(totals.costBasis, 1600);
  assert.equal(totals.pnl, 300);
  assert.equal(totals.pnlPercent, 18.75);
  assert.equal(totals.pricedCount, 2);
  assert.equal(totals.unpricedCount, 1);
  assert.equal(totals.totalCount, 3);
});

test("price cache parsing drops malformed entries", () => {
  assert.deepEqual(parsePriceCache("nope"), {});
  assert.deepEqual(parsePriceCache('["AAPL"]'), {});
  assert.deepEqual(
    parsePriceCache('{"aapl":{"price":"150.5","fetchedAt":"1000"},"bad":{"price":-1,"fetchedAt":1}}'),
    { AAPL: { price: 150.5, fetchedAt: 1000 } }
  );
});

test("isPriceFresh respects the max age", () => {
  const entry = { price: 10, fetchedAt: 1000 };
  assert.equal(isPriceFresh(entry, 1000 + PRICE_MAX_AGE_MS - 1), true);
  assert.equal(isPriceFresh(entry, 1000 + PRICE_MAX_AGE_MS), false);
  assert.equal(isPriceFresh(null), false);
});
