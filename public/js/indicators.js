export function computeSMA(values, period) {
  const result = new Array(values.length).fill(null);

  if (!Number.isInteger(period) || period <= 0) return result;

  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    if (!Number.isFinite(value)) continue;

    sum += value;
    if (i >= period) sum -= Number(values[i - period]);

    if (i >= period - 1) result[i] = sum / period;
  }

  return result;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function computeRSI(values, period = 14) {
  const result = new Array(values.length).fill(null);

  if (!Number.isInteger(period) || period <= 0) return result;
  if (values.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const delta = Number(values[i]) - Number(values[i - 1]);
    if (!Number.isFinite(delta)) return result;
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const delta = Number(values[i]) - Number(values[i - 1]);
    if (!Number.isFinite(delta)) continue;

    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;

    // Wilder's smoothing: the previous average carries most of the weight.
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    result[i] = rsiFromAverages(avgGain, avgLoss);
  }

  return result;
}
