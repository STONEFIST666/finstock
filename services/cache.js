export function createTtlCache({ ttlMs, maxEntries = 50, now = Date.now }) {
  if (!Number.isFinite(ttlMs) || ttlMs < 0) {
    throw new TypeError("ttlMs must be a non-negative number");
  }
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError("maxEntries must be a positive integer");
  }

  const entries = new Map();

  function evictOldest() {
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      entries.delete(oldestKey);
    }
  }

  return {
    get(key, { allowStale = false } = {}) {
      const entry = entries.get(key);
      if (!entry) return null;

      const age = now() - entry.fetchedAt;
      const stale = age >= ttlMs;
      if (stale && !allowStale) return null;

      return { value: entry.value, fetchedAt: entry.fetchedAt, age, stale };
    },

    set(key, value) {
      const fetchedAt = now();
      // Re-insert so Map insertion order always means "least recently stored".
      entries.delete(key);
      entries.set(key, { value, fetchedAt });
      evictOldest();
      return { value, fetchedAt, age: 0, stale: false };
    },

    delete(key) {
      return entries.delete(key);
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    }
  };
}
