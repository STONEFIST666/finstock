import test from "node:test";
import assert from "node:assert/strict";
import { createTtlCache } from "../services/cache.js";

function createClock(start = 0) {
  let value = start;
  return {
    now: () => value,
    advance: (ms) => { value += ms; }
  };
}

test("returns a stored entry while it is fresh", () => {
  const clock = createClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });

  assert.equal(cache.get("AAPL"), null);
  const stored = cache.set("AAPL", { price: "10" });
  assert.equal(stored.fetchedAt, 0);

  const entry = cache.get("AAPL");
  assert.deepEqual(entry.value, { price: "10" });
  assert.equal(entry.stale, false);
  assert.equal(entry.age, 0);
});

test("expires entries once the TTL passes", () => {
  const clock = createClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });
  cache.set("AAPL", 1);

  clock.advance(999);
  assert.ok(cache.get("AAPL"));

  clock.advance(1);
  assert.equal(cache.get("AAPL"), null);
});

test("can serve stale entries explicitly", () => {
  const clock = createClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });
  cache.set("AAPL", 1);
  clock.advance(5000);

  const stale = cache.get("AAPL", { allowStale: true });
  assert.equal(stale.value, 1);
  assert.equal(stale.stale, true);
  assert.equal(stale.age, 5000);
});

test("overwriting refreshes the timestamp", () => {
  const clock = createClock();
  const cache = createTtlCache({ ttlMs: 1000, now: clock.now });
  cache.set("AAPL", 1);
  clock.advance(800);
  cache.set("AAPL", 2);

  const entry = cache.get("AAPL");
  assert.equal(entry.value, 2);
  assert.equal(entry.age, 0);
});

test("evicts the least recently stored entries beyond the limit", () => {
  const clock = createClock();
  const cache = createTtlCache({ ttlMs: 10000, maxEntries: 2, now: clock.now });

  cache.set("A", 1);
  cache.set("B", 2);
  cache.set("C", 3);

  assert.equal(cache.size, 2);
  assert.equal(cache.get("A"), null);
  assert.ok(cache.get("B"));
  assert.ok(cache.get("C"));

  cache.set("B", 20);
  cache.set("D", 4);
  assert.equal(cache.get("C"), null);
  assert.ok(cache.get("B"));
  assert.ok(cache.get("D"));
});

test("validates its configuration", () => {
  assert.throws(() => createTtlCache({ ttlMs: -1 }), TypeError);
  assert.throws(() => createTtlCache({ ttlMs: 1000, maxEntries: 0 }), TypeError);
});
