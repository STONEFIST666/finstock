// Normalize a raw symbol: trim surrounding whitespace and uppercase, so
// "  aapl  " becomes "AAPL".
export const normalizeSymbol = (raw) => String(raw ?? "").trim().toUpperCase();

// Deliberately permissive: dots (BRK.B), hyphens and ^ (indices) are allowed
// so real symbols are never rejected, while obviously-invalid input is stopped
// before it wastes an Alpha Vantage request.
export const SYMBOL_FORMAT = /^[A-Z0-9.\-^]{1,10}$/;

export const isValidSymbol = (symbol) => SYMBOL_FORMAT.test(normalizeSymbol(symbol));
