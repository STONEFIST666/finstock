import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSymbol, isValidSymbol } from "../services/symbols.js";

test("normalizeSymbol trims and uppercases", () => {
  assert.equal(normalizeSymbol("  aapl  "), "AAPL");
  assert.equal(normalizeSymbol("brk.b"), "BRK.B");
});

test("normalizeSymbol handles nullish input", () => {
  assert.equal(normalizeSymbol(null), "");
  assert.equal(normalizeSymbol(undefined), "");
  assert.equal(normalizeSymbol("   "), "");
});

test("isValidSymbol accepts real-world symbol shapes", () => {
  for (const symbol of ["AAPL", "BRK.B", "RDS-A", "^GSPC", "3M"]) {
    assert.equal(isValidSymbol(symbol), true, symbol);
  }
});

test("isValidSymbol rejects malformed input without an API call", () => {
  for (const symbol of ["", "   ", "TOOYLONGSYM", "AA PL", "AAPL;DROP", "ABC/DEF"]) {
    assert.equal(isValidSymbol(symbol), false, symbol);
  }
});

test("isValidSymbol normalizes before validating", () => {
  assert.equal(isValidSymbol("  tsla "), true);
});
