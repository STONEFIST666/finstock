import test from "node:test";
import assert from "node:assert/strict";
import {
  CHART_RANGE_KEY,
  DEFAULT_CHART_RANGE,
  normalizeChartRange,
  createChartRangeStorage
} from "../public/js/chart-settings.js";

test("normalizeChartRange accepts known ranges case-insensitively", () => {
  assert.equal(normalizeChartRange("1m"), "1M");
  assert.equal(normalizeChartRange(" ALL "), "ALL");
  assert.equal(normalizeChartRange("3M"), "3M");
});

test("normalizeChartRange falls back for invalid or missing values", () => {
  for (const value of ["1Y", "", null, undefined, 42, {}, []]) {
    assert.equal(normalizeChartRange(value), DEFAULT_CHART_RANGE);
  }
});

test("chart range storage saves the normalized choice", () => {
  const memory = new Map();
  const store = createChartRangeStorage({
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, value)
  });

  assert.equal(store.available, true);
  assert.equal(store.save("6m"), true);
  assert.equal(memory.get(CHART_RANGE_KEY), "6M");
  assert.equal(store.load(), "6M");
});

test("chart range storage falls back when stored data is invalid", () => {
  const store = createChartRangeStorage({
    getItem: () => "nonsense",
    setItem: () => {}
  });

  assert.equal(store.load(), DEFAULT_CHART_RANGE);
});

test("chart range storage tolerates broken or missing storage", () => {
  const broken = createChartRangeStorage({
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); }
  });

  assert.equal(broken.load(), DEFAULT_CHART_RANGE);
  assert.equal(broken.save("1M"), false);

  const missing = createChartRangeStorage(null);
  assert.equal(missing.available, false);
  assert.equal(missing.load(), DEFAULT_CHART_RANGE);
  assert.equal(missing.save("1M"), false);
});
