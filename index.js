import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { getQuoteSnapshot, getCompanyOverview, getTimeSeriesDaily } from "./services/alphaVantage.js";
import { normalizeSymbol, SYMBOL_FORMAT } from "./services/symbols.js";
import { toStockQuote } from "./services/quotes.js";
import apiQuoteRouter from "./routes/apiQuote.js";
import apiNewsRouter from "./routes/apiNews.js";
import { resolvePort } from "./services/config.js";
dotenv.config();

console.log("ALPHA_VANTAGE_API_KEY loaded:", Boolean(process.env.ALPHA_VANTAGE_API_KEY));

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/api/quote", apiQuoteRouter);
app.use("/api/news", apiNewsRouter);
const port = resolvePort(process.env.PORT);

app.get("/", (req, res) =>{
  res.render("index.ejs", { stock: null, company: null, historicalData: [], error: null });
});

// ---- Sprint 7: duplicate-request guard ----
// In-memory guard against rapid duplicate submissions. The frontend disables
// the submit button; this is the backend safety net. An identical normalized
// symbol resubmitted within this window is dropped before any API call.
// In-memory only (no DB) — entries are cheap and get overwritten over time.
const recentSearches = new Map();
const DUPLICATE_WINDOW_MS = 1000;

app.post("/search", async (req, res) => {
    const stockSymbol = normalizeSymbol(req.body?.["stock-symbol"]);

    // 1) Validate BEFORE any API call — bad input costs zero quota.
    if (!stockSymbol) {
        return res.render("index.ejs", {
            stock: null,
            company: null,
            historicalData: [],
            errorTitle: "Missing stock symbol",
            error: "Please enter a stock symbol."
        });
    }

    if (!SYMBOL_FORMAT.test(stockSymbol)) {
        return res.render("index.ejs", {
            stock: null,
            company: null,
            historicalData: [],
            errorTitle: "Invalid stock symbol",
            error: "That doesn't look like a valid stock symbol (letters, numbers, dots or hyphens only)."
        });
    }

    // 2) Dedupe — drop an identical repeat before it hits the API.
    const now = Date.now();
    const lastSearchAt = recentSearches.get(stockSymbol) || 0;
    recentSearches.set(stockSymbol, now);
    // Keep the map bounded: occasionally drop entries whose window has passed.
    if (recentSearches.size > 100) {
        for (const [key, ts] of recentSearches) {
            if (now - ts >= DUPLICATE_WINDOW_MS) recentSearches.delete(key);
        }
    }
    if (now - lastSearchAt < DUPLICATE_WINDOW_MS) {
        return res.render("index.ejs", {
            stock: null,
            company: null,
            historicalData: [],
            errorTitle: "Duplicate search blocked",
            error: `A search for ${stockSymbol} was already submitted. Please wait a moment and try again.`
        });
    }

    try {
        const quoteSnapshot = await getQuoteSnapshot(stockSymbol);

        if (quoteSnapshot?.error) {
            const errorMessage = quoteSnapshot.error.includes("Invalid")
                ? "Invalid stock symbol."
                : quoteSnapshot.error;

            return res.render("index.ejs", {
                stock: null,
                company: null,
                historicalData: [],
                error: errorMessage
            });
        }

        const stock = toStockQuote(quoteSnapshot.data);

        if (!stock) {
            return res.render("index.ejs", {
                stock: null,
                company: null,
                historicalData: [],
                error: "Invalid stock symbol."
            });
        }

        const companyResponse = await getCompanyOverview(stockSymbol);
        let companyInfo = null;
        const apiErrors = [];
        const pushApiError = (message) => {
            if (message && !apiErrors.includes(message)) {
                apiErrors.push(message);
            }
        };

        if (companyResponse?.error) {
            pushApiError(companyResponse.error);
        } else {
            companyInfo = {
                name: companyResponse.Name,
                description: companyResponse.Description,
                sector: companyResponse.Sector,
                industry: companyResponse.Industry,
                marketCap: companyResponse.MarketCapitalization,
                peRatio: companyResponse.PERatio,
                eps: companyResponse.EPS,
                returnOnEquity: companyResponse.ReturnOnEquityTTM,
                profitMargin: companyResponse.ProfitMargin,
                dividendYield: companyResponse.DividendYield
            };
        }

        const historicalResponse = await getTimeSeriesDaily(stockSymbol);
        let historicalData = [];

        if (historicalResponse?.error) {
            pushApiError(historicalResponse.error);
        } else {
            historicalData = historicalResponse;
        }

        res.render("index.ejs", {
            stock,
            company: companyInfo,
            historicalData,
            quoteUpdatedAt: new Date(quoteSnapshot.fetchedAt).toISOString(),
            quoteCached: quoteSnapshot.fromCache,
            error: apiErrors.length ? apiErrors.join(" | ") : null
        });

    } catch (error) {
        // Log only the message — never the whole error object. An axios error
        // carries its request config (which contains the API key).
        console.error("Error fetching stock data:", error instanceof Error ? error.message : error);

        res.render("index.ejs", {
            stock: null,
            company: null,
            historicalData: [],
            error: "Error fetching stock data"
        });
    }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



