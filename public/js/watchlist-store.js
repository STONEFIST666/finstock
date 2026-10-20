export const WATCHLIST_KEY = "finstock.watchlist.v1";
export const MAX_WATCHLIST_ITEMS = 20;

const normalize = (raw) => String(raw ?? "").trim().toUpperCase();

export function sanitizeWatchlist(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const result = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const symbol = normalize(entry);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    result.push(symbol);
    if (result.length >= MAX_WATCHLIST_ITEMS) break;
  }

  return result;
}

export function parseWatchlist(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    return sanitizeWatchlist(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function serializeWatchlist(list) {
  return JSON.stringify(sanitizeWatchlist(list));
}

export function isWatched(list, symbol) {
  const target = normalize(symbol);
  return Boolean(target) && sanitizeWatchlist(list).includes(target);
}

export function addSymbol(list, symbol) {
  const current = sanitizeWatchlist(list);
  const target = normalize(symbol);

  if (!target) return { list: current, added: false, reason: "invalid" };
  if (current.includes(target)) return { list: current, added: false, reason: "duplicate" };
  if (current.length >= MAX_WATCHLIST_ITEMS) {
    return { list: current, added: false, reason: "full" };
  }

  return { list: [...current, target], added: true, reason: null };
}

export function removeSymbol(list, symbol) {
  const current = sanitizeWatchlist(list);
  const target = normalize(symbol);

  if (!target) return { list: current, removed: false };

  const next = current.filter((entry) => entry !== target);
  return { list: next, removed: next.length !== current.length };
}

export function toggleSymbol(list, symbol) {
  if (isWatched(list, symbol)) {
    const result = removeSymbol(list, symbol);
    return { list: result.list, watched: false, removed: result.removed, reason: null };
  }

  const result = addSymbol(list, symbol);
  return { list: result.list, watched: result.added, removed: false, reason: result.reason };
}

export function createWatchlistStorage(storage) {
  const target = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);

  return {
    available: Boolean(target),
    load() {
      if (!target) return [];
      try {
        return parseWatchlist(target.getItem(WATCHLIST_KEY));
      } catch {
        return [];
      }
    },
    save(list) {
      if (!target) return false;
      try {
        target.setItem(WATCHLIST_KEY, serializeWatchlist(list));
        return true;
      } catch {
        return false;
      }
    }
  };
}
