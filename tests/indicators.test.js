import test from "node:test";
import assert from "node:assert/strict";
import { computeRSI, computeSMA } from "../public/js/indicators.js";

test("computeSMA warms up with nulls and then averages the window", () => {
  assert.deepEqual(computeSMA([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test("computeSMA handles a period longer than the series", () => {
  assert.deepEqual(computeSMA([1, 2, 3], 5), [null, null, null]);
});

test("computeSMA rejects invalid periods without throwing", () => {
  assert.deepEqual(computeSMA([1, 2, 3], 0), [null, null, null]);
  assert.deepEqual(computeSMA([1, 2, 3], 1.5), [null, null, null]);
});

test("computeRSI returns nulls until the first full period", () => {
  const values = Array.from({ length: 20 }, (_, i) => i + 1);
  const rsi = computeRSI(values, 14);

  assert.equal(rsi.length, values.length);
  assert.ok(rsi.slice(0, 14).every((value) => value === null));
  assert.equal(rsi[14], 100);
});

test("computeRSI is 0 for a strictly falling series", () => {
  const values = Array.from({ length: 20 }, (_, i) => 20 - i);
  const rsi = computeRSI(values, 14);
  assert.equal(rsi[14], 0);
});

test("computeRSI is neutral for a flat series", () => {
  const rsi = computeRSI(new Array(20).fill(100), 14);
  assert.equal(rsi[14], 50);
});

test("computeRSI stays inside 0-100 and preserves series length", () => {
  const values = [];
  for (let i = 0; i < 60; i++) values.push(100 + Math.sin(i / 3) * 10 + i * 0.5);

  const rsi = computeRSI(values, 14);
  assert.equal(rsi.length, values.length);
  assert.ok(rsi.slice(14).every((value) => value >= 0 && value <= 100));
});

test("computeRSI tolerates short or invalid input", () => {
  assert.deepEqual(computeRSI([1, 2, 3], 14), [null, null, null]);
  assert.deepEqual(computeRSI([1, 2, 3], 0), [null, null, null]);
});
