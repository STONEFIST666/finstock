import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PORT, resolvePort } from "../services/config.js";

test("resolvePort accepts valid port values", () => {
  assert.equal(resolvePort("3000"), 3000);
  assert.equal(resolvePort(8080), 8080);
  assert.equal(resolvePort(" 65535 "), 65535);
  assert.equal(resolvePort("1"), 1);
});

test("resolvePort falls back for missing or malformed values", () => {
  for (const value of [null, undefined, "", "abc", "3000.5", "0", "-1", "65536", "1e3"]) {
    assert.equal(resolvePort(value), DEFAULT_PORT);
  }
});
