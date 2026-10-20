import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeErrorText } from "../services/alphaVantage.js";

const API_KEY = "TESTKEY123456789";

test("sanitizeErrorText removes every occurrence of the API key", () => {
  process.env.ALPHA_VANTAGE_API_KEY = API_KEY;
  const message = `We detected ${API_KEY} and ${API_KEY} again.`;
  assert.equal(sanitizeErrorText(message), "We detected *** and *** again.");
});

test("sanitizeErrorText leaves messages without the key untouched", () => {
  process.env.ALPHA_VANTAGE_API_KEY = API_KEY;
  assert.equal(sanitizeErrorText("Rate limit reached."), "Rate limit reached.");
});

test("sanitizeErrorText passes non-strings through", () => {
  process.env.ALPHA_VANTAGE_API_KEY = API_KEY;
  assert.equal(sanitizeErrorText(undefined), undefined);
  assert.equal(sanitizeErrorText(null), null);
});

test("sanitizeErrorText is a no-op when no key is configured", () => {
  const previous = process.env.ALPHA_VANTAGE_API_KEY;
  delete process.env.ALPHA_VANTAGE_API_KEY;
  assert.equal(sanitizeErrorText(`key ${API_KEY}`), `key ${API_KEY}`);
  process.env.ALPHA_VANTAGE_API_KEY = previous;
});
