export const CHART_RANGE_KEY = "finstock.chartRange.v1";
export const DEFAULT_CHART_RANGE = "ALL";
export const CHART_RANGES = ["1M", "3M", "6M", "ALL"];

export function normalizeChartRange(value) {
  const range = String(value ?? "").trim().toUpperCase();
  return CHART_RANGES.includes(range) ? range : DEFAULT_CHART_RANGE;
}

export function createChartRangeStorage(storage) {
  const target = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);

  return {
    available: Boolean(target),
    load() {
      if (!target) return DEFAULT_CHART_RANGE;
      try {
        return normalizeChartRange(target.getItem(CHART_RANGE_KEY));
      } catch {
        return DEFAULT_CHART_RANGE;
      }
    },
    save(range) {
      if (!target) return false;
      try {
        target.setItem(CHART_RANGE_KEY, normalizeChartRange(range));
        return true;
      } catch {
        return false;
      }
    }
  };
}
