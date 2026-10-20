export function toStockQuote(responseData) {
  const quote = responseData?.["Global Quote"];
  if (!quote || !quote["01. symbol"]) return null;

  return {
    symbol: quote["01. symbol"],
    open: quote["02. open"],
    high: quote["03. high"],
    low: quote["04. low"],
    price: quote["05. price"],
    volume: quote["06. volume"],
    latestTradingDay: quote["07. latest trading day"],
    previousClose: quote["08. previous close"],
    change: quote["09. change"],
    changePercent: quote["10. change percent"]
  };
}
