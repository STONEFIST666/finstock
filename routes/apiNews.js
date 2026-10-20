import { Router } from "express";
import { normalizeSymbol, SYMBOL_FORMAT } from "../services/symbols.js";
import { getNewsSnapshot } from "../services/news.js";

const router = Router();

router.get("/:symbol", async (req, res) => {
  res.set("Cache-Control", "no-store");

  const symbol = normalizeSymbol(req.params.symbol);

  if (!SYMBOL_FORMAT.test(symbol)) {
    return res.status(400).json({ error: "Invalid stock symbol." });
  }

  try {
    const snapshot = await getNewsSnapshot(symbol);

    if (snapshot.error) {
      const status = /rate limit/i.test(snapshot.error)
        ? 429
        : /invalid/i.test(snapshot.error)
          ? 400
          : 502;
      return res.status(status).json({ error: snapshot.error });
    }

    return res.json({
      symbol,
      articles: snapshot.data,
      lastUpdated: new Date(snapshot.fetchedAt).toISOString(),
      cached: snapshot.fromCache
    });
  } catch (error) {
    console.error("News API error:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Error fetching market news." });
  }
});

export default router;
