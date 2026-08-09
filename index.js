import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { getGlobalQuote, getCompanyOverview, getTimeSeriesDaily } from "./services/alphaVantage.js";
dotenv.config();

console.log("ALPHA_VANTAGE_API_KEY loaded:", Boolean(process.env.ALPHA_VANTAGE_API_KEY));
console.log("ALPHA_VANTAGE_API_KEY length:", process.env.ALPHA_VANTAGE_API_KEY?.length);

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
const port = 3000;

app.get("/", (req, res) =>{
  res.render("index.ejs", { stock: null, company: null, historicalData: [], error: null });
});

// ---- Sprint 7: input normalization + duplicate-request guard ----
// Normalize a raw symbol: trim surrounding whitespace and uppercase, so
// "  aapl  " becomes "AAPL". Runs on every request before any API call.
const normalizeSymbol = (raw) => String(raw ?? "").trim().toUpperCase();

// Light format check — deliberately permissive (dots for share classes like
// BRK.B, hyphens and ^ for some index symbols) so real symbols are never
// rejected, while obviously-invalid input is stopped before it wastes an
// Alpha Vantage request.
const SYMBOL_FORMAT = /^[A-Z0-9.\-^]{1,10}$/;

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
        const quoteResponse = await getGlobalQuote(stockSymbol);

        if (quoteResponse?.error) {
            const errorMessage = quoteResponse.error.includes("Invalid")
                ? "Invalid stock symbol."
                : quoteResponse.error;

            return res.render("index.ejs", {
                stock: null,
                company: null,
                historicalData: [],
                error: errorMessage
            });
        }

        const quote = quoteResponse["Global Quote"];

        if (!quote || !quote["01. symbol"]) {
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

        const stock = {
            symbol: quote["01. symbol"],
            open: quote["02. open"],
            high: quote["03. high"],
            low: quote["04. low"],
            price: quote["05. price"],
            volume: quote["06. volume"],
            previousClose: quote["08. previous close"],
            change: quote["09. change"],
            changePercent: quote["10. change percent"],
            latestTradingDay: quote["07. latest trading day"]
        };

        res.render("index.ejs", {
            stock,
            company: companyInfo,
            historicalData,
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



