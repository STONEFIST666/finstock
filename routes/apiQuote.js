import { Router } from "express";
import { normalizeSymbol, SYMBOL_FORMAT } from "../services/symbols.js";
import { getQuoteSnapshot } from "../services/alphaVantage.js";
import { toStockQuote } from "../services/quotes.js";

const router = Router();

router.get("/:symbol", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const symbol = normalizeSymbol(req.params.symbol);

  if (!SYMBOL_FORMAT.test(symbol)) {
    return res.status(400).json({ error: "Invalid stock symbol." });
  }

  try {
    const snapshot = await getQuoteSnapshot(symbol);

    if (snapshot.error) {
      const status = /rate limit/i.test(snapshot.error)
        ? 429
        : /invalid/i.test(snapshot.error)
          ? 400
          : 502;
      return res.status(status).json({ error: snapshot.error });
    }

    const quote = toStockQuote(snapshot.data);
    if (!quote) {
      return res.status(404).json({ error: "No quote data available for that symbol." });
    }

    return res.json({
      ...quote,
      lastUpdated: new Date(snapshot.fetchedAt).toISOString(),
      cached: snapshot.fromCache
    });
  } catch (error) {
    console.error("Quote API error:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Error fetching stock data." });
  }
});

export default router;
