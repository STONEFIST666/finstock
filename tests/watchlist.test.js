import test from "node:test";
import assert from "node:assert/strict";
import {
  WATCHLIST_KEY,
  MAX_WATCHLIST_ITEMS,
  addSymbol,
  createWatchlistStorage,
  isWatched,
  parseWatchlist,
  removeSymbol,
  sanitizeWatchlist,
  serializeWatchlist,
  toggleSymbol
} from "../public/js/watchlist-store.js";

test("parseWatchlist reads a stored array", () => {
  assert.deepEqual(parseWatchlist('["AAPL","tsla"]'), ["AAPL", "TSLA"]);
});

test("parseWatchlist survives corrupt or unexpected data", () => {
  for (const raw of ["", "not json", "{}", "null", '"AAPL"', "[1, 2]", "[null]"]) {
    assert.deepEqual(parseWatchlist(raw), []);
  }
});

test("sanitizeWatchlist trims, uppercases, dedupes, and caps entries", () => {
  assert.deepEqual(sanitizeWatchlist([" aapl ", "AAPL", "tsla", 42, null]), ["AAPL", "TSLA"]);

  const many = Array.from({ length: MAX_WATCHLIST_ITEMS + 10 }, (_, i) => "S" + i);
  assert.equal(sanitizeWatchlist(many).length, MAX_WATCHLIST_ITEMS);
});

test("serializeWatchlist round-trips through parseWatchlist", () => {
  const list = ["AAPL", "BRK.B"];
  assert.deepEqual(parseWatchlist(serializeWatchlist(list)), list);
});

test("isWatched is case-insensitive and ignores malformed input", () => {
  assert.equal(isWatched(["AAPL"], "aapl"), true);
  assert.equal(isWatched(["AAPL"], "TSLA"), false);
  assert.equal(isWatched(["AAPL"], ""), false);
});

test("addSymbol reports duplicate, invalid, and full states", () => {
  assert.deepEqual(addSymbol([], " aapl ").list, ["AAPL"]);
  assert.equal(addSymbol(["AAPL"], "aapl").reason, "duplicate");
  assert.equal(addSymbol([], "  ").reason, "invalid");

  const full = Array.from({ length: MAX_WATCHLIST_ITEMS }, (_, i) => "S" + i);
  assert.equal(addSymbol(full, "NEW").reason, "full");
});

test("removeSymbol and toggleSymbol keep the list consistent", () => {
  assert.deepEqual(removeSymbol(["AAPL", "TSLA"], "aapl").list, ["TSLA"]);
  assert.equal(removeSymbol(["AAPL"], "MSFT").removed, false);

  const added = toggleSymbol([], "aapl");
  assert.deepEqual(added.list, ["AAPL"]);
  assert.equal(added.watched, true);

  const removed = toggleSymbol(added.list, "AAPL");
  assert.deepEqual(removed.list, []);
  assert.equal(removed.watched, false);
});

test("storage adapter loads, saves, and tolerates unavailable storage", () => {
  const memory = new Map();
  const fake = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, value)
  };

  const store = createWatchlistStorage(fake);
  assert.equal(store.available, true);
  assert.equal(store.save(["aapl", "AAPL", "tsla"]), true);
  assert.equal(memory.get(WATCHLIST_KEY), '["AAPL","TSLA"]');
  assert.deepEqual(store.load(), ["AAPL", "TSLA"]);

  const broken = createWatchlistStorage({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } });
  assert.deepEqual(broken.load(), []);
  assert.equal(broken.save(["AAPL"]), false);

  const missing = createWatchlistStorage(null);
  assert.equal(missing.available, false);
  assert.deepEqual(missing.load(), []);
});
