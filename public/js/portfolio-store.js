export const PORTFOLIO_KEY = "finstock.portfolio.v1";
export const PORTFOLIO_PRICES_KEY = "finstock.portfolio.prices.v1";
export const MAX_POSITIONS = 50;
export const PRICE_MAX_AGE_MS = 5 * 60 * 1000;

const SYMBOL_FORMAT = /^[A-Z0-9.\-^]{1,10}$/;

const normalizeSymbol = (raw) => String(raw ?? "").trim().toUpperCase();

function mergePositions(first, second) {
  const shares = first.shares + second.shares;
  const avgCost = (first.shares * first.avgCost + second.shares * second.avgCost) / shares;
  return { symbol: first.symbol, shares, avgCost };
}

export function sanitizePositions(value) {
  if (!Array.isArray(value)) return [];

  const bySymbol = new Map();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;

    const symbol = normalizeSymbol(entry.symbol);
    const shares = Number(entry.shares);
    const avgCost = Number(entry.avgCost);

    if (!SYMBOL_FORMAT.test(symbol)) continue;
    if (!Number.isFinite(shares) || shares <= 0) continue;
    if (!Number.isFinite(avgCost) || avgCost < 0) continue;

    const position = { symbol, shares, avgCost };
    const existing = bySymbol.get(symbol);
    bySymbol.set(symbol, existing ? mergePositions(existing, position) : position);
  }

  return Array.from(bySymbol.values()).slice(0, MAX_POSITIONS);
}

export function parsePortfolio(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return sanitizePositions(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function serializePortfolio(list) {
  return JSON.stringify(sanitizePositions(list));
}

export function addPosition(list, input) {
  const current = sanitizePositions(list);
  const symbol = normalizeSymbol(input?.symbol);
  const shares = Number(input?.shares);
  const avgCost = Number(input?.avgCost);

  if (!SYMBOL_FORMAT.test(symbol)) {
    return { list: current, added: false, updated: false, reason: "invalid-symbol" };
  }
  if (!Number.isFinite(shares) || shares <= 0) {
    return { list: current, added: false, updated: false, reason: "invalid-shares" };
  }
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    return { list: current, added: false, updated: false, reason: "invalid-cost" };
  }

  const index = current.findIndex((position) => position.symbol === symbol);

  if (index !== -1) {
    const merged = mergePositions(current[index], { symbol, shares, avgCost });
    const next = current.slice();
    next[index] = merged;
    return { list: next, added: false, updated: true, position: merged };
  }

  if (current.length >= MAX_POSITIONS) {
    return { list: current, added: false, updated: false, reason: "full" };
  }

  const position = { symbol, shares, avgCost };
  return { list: [...current, position], added: true, updated: false, position };
}

export function updatePosition(list, symbol, changes) {
  const current = sanitizePositions(list);
  const target = normalizeSymbol(symbol);
  const index = current.findIndex((position) => position.symbol === target);

  if (index === -1) {
    return { list: current, updated: false, reason: "not-found" };
  }

  const shares = Number(changes?.shares);
  const avgCost = Number(changes?.avgCost);

  if (!Number.isFinite(shares) || shares <= 0) {
    return { list: current, updated: false, reason: "invalid-shares" };
  }
  if (!Number.isFinite(avgCost) || avgCost < 0) {
    return { list: current, updated: false, reason: "invalid-cost" };
  }

  const next = current.slice();
  next[index] = { symbol: target, shares, avgCost };
  return { list: next, updated: true, position: next[index] };
}

export function removePosition(list, symbol) {
  const current = sanitizePositions(list);
  const target = normalizeSymbol(symbol);
  const next = current.filter((position) => position.symbol !== target);

  return { list: next, removed: next.length !== current.length };
}

export function positionMetrics(position, price) {
  const shares = Number(position?.shares);
  const avgCost = Number(position?.avgCost);
  const currentPrice = Number(price);

  if (!Number.isFinite(shares) || shares <= 0) return null;
  if (!Number.isFinite(avgCost) || avgCost < 0) return null;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;

  const costBasis = shares * avgCost;
  const marketValue = shares * currentPrice;
  const pnl = marketValue - costBasis;

  return {
    costBasis,
    marketValue,
    pnl,
    pnlPercent: costBasis > 0 ? (pnl / costBasis) * 100 : null
  };
}

export function portfolioTotals(positions, prices) {
  let marketValue = 0;
  let costBasis = 0;
  let pricedCount = 0;
  let unpricedCount = 0;

  for (const position of positions) {
    const metrics = positionMetrics(position, prices?.[position.symbol]?.price);
    if (!metrics) {
      unpricedCount += 1;
      continue;
    }
    marketValue += metrics.marketValue;
    costBasis += metrics.costBasis;
    pricedCount += 1;
  }

  const pnl = marketValue - costBasis;

  return {
    marketValue,
    costBasis,
    pnl,
    pnlPercent: costBasis > 0 ? (pnl / costBasis) * 100 : null,
    pricedCount,
    unpricedCount,
    totalCount: positions.length
  };
}

export function parsePriceCache(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result = {};

    for (const [key, entry] of Object.entries(parsed)) {
      const symbol = normalizeSymbol(key);
      const price = Number(entry?.price);
      const fetchedAt = Number(entry?.fetchedAt);

      if (!SYMBOL_FORMAT.test(symbol)) continue;
      if (!Number.isFinite(price) || price <= 0) continue;
      if (!Number.isFinite(fetchedAt)) continue;

      result[symbol] = { price, fetchedAt };
    }

    return result;
  } catch {
    return {};
  }
}

export function serializePriceCache(prices) {
  return JSON.stringify(prices || {});
}

export function isPriceFresh(entry, now = Date.now(), maxAgeMs = PRICE_MAX_AGE_MS) {
  return Boolean(entry) && Number.isFinite(entry.fetchedAt) && now - entry.fetchedAt < maxAgeMs;
}
