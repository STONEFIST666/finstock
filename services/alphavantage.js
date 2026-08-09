

import axios from "axios";
let nextAllowedRequestTime = 0;
const ALPHA_VANTAGE_MIN_INTERVAL_MS = 1200;

// ---- Company Overview cache ----
// OVERVIEW data (name, description, sector, financial ratios) changes rarely —
// at most quarterly for most companies. Caching it for 12 hours stops repeated
// searches from burning the free tier's tiny daily quota (~25 requests/day).
const overviewCache = new Map();                    // symbol -> { data, fetchedAt }
const OVERVIEW_CACHE_TTL_MS = 12 * 60 * 60 * 1000;  // 12 hours
const OVERVIEW_RETRY_DELAY_MS = 3000;               // wait before one retry on rate limit

async function throttleAlphaVantage() {
    const now = Date.now();

    // Reserve our slot BEFORE any `await`. This has to be synchronous so that
    // even two requests that arrive at the same moment each get their own
    // spaced-out slot, instead of both passing the check and firing together
    // (which is what trips Alpha Vantage's free-tier rate limiter).
    const mySlot = Math.max(now, nextAllowedRequestTime);
    nextAllowedRequestTime = mySlot + ALPHA_VANTAGE_MIN_INTERVAL_MS;

    const waitTime = mySlot - now;
    if (waitTime > 0) {
        console.log(`Waiting ${waitTime}ms to respect Alpha Vantage rate limit`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
}

function normalizeErrorText(text) {
    if (typeof text !== "string") {
        return text;
    }

    const trimmed = text.trim();
    const halfLength = Math.floor(trimmed.length / 2);
    if (trimmed.length % 2 === 0) {
        const firstHalf = trimmed.slice(0, halfLength);
        const secondHalf = trimmed.slice(halfLength);
        if (firstHalf === secondHalf) {
            return firstHalf;
        }
    }

    return trimmed;
}

// Alpha Vantage echoes the API key back inside some error messages (e.g. the
// daily rate-limit text: "We have detected your API key as ..."). Never let
// the raw key reach the console, logs, or the rendered page.
function sanitizeErrorText(text) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (typeof text !== "string" || !apiKey) {
        return text;
    }
    return text.split(apiKey).join("***");
}

// Detect every rate-limit wording variant Alpha Vantage has used, so they all
// map to one friendly message (which never contains the API key).
function isRateLimitMessage(text) {
    const lower = String(text).toLowerCase();
    return (
        lower.includes("free api requests more sparingly") ||
        lower.includes("requests per day") ||
        lower.includes("rate limit") ||
        lower.includes("per minute")
    );
}

function extractApiError(responseData) {
    if (!responseData || typeof responseData !== "object") {
        return "Unexpected API response.";
    }

    if (responseData.Note) {
        const normalized = normalizeErrorText(responseData.Note);
        if (isRateLimitMessage(normalized)) {
            return "Alpha Vantage rate limit reached. Please wait and try again.";
        }
        return sanitizeErrorText(normalized);
    }

    if (responseData.Information) {
        const normalized = normalizeErrorText(responseData.Information);
        if (isRateLimitMessage(normalized)) {
            return "Alpha Vantage rate limit reached. Please wait and try again.";
        }
        return sanitizeErrorText(normalized);
    }

    if (responseData["Error Message"]) {
        return sanitizeErrorText(normalizeErrorText(responseData["Error Message"]));
    }

    if (Object.keys(responseData).length === 0) {
        return "Unexpected empty response from Alpha Vantage.";
    }

    return null;
}

export async function getGlobalQuote(stockSymbol) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const params = {
        function: "GLOBAL_QUOTE",
        symbol: stockSymbol,
        apikey: apiKey
    };

    console.log("GLOBAL_QUOTE params:", {
        function: params.function,
        symbol: params.symbol,
        apikeyPresent: Boolean(params.apikey),
        apikeyLength: params.apikey?.length
    });

    await throttleAlphaVantage();

    let response;
    try {
        response = await axios.get("https://www.alphavantage.co/query", { params, timeout: 15000 });
    } catch (error) {
        // Log only error.message — never the whole error object. An axios error
        // carries its request `config`, which contains the API key.
        console.error("GLOBAL_QUOTE request failed:", error.message);
        return { error: `Alpha Vantage request failed: ${error.message}` };
    }
    console.log("GLOBAL_QUOTE response status:", response.status);

    const apiError = extractApiError(response.data);
    if (apiError) {
        console.warn("GLOBAL_QUOTE API warning/error:", apiError);
        return { error: apiError };
    }

    if (!response.data || !response.data["Global Quote"]) {
        return { error: "Missing Global Quote data from Alpha Vantage." };
    }

    return response.data;
}

export async function getCompanyOverview(stockSymbol) {
    const symbol = String(stockSymbol || "").toUpperCase().trim();

    // 1) Fresh cache hit → return the stored data instantly, zero API calls.
    const cached = overviewCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < OVERVIEW_CACHE_TTL_MS) {
        console.log("OVERVIEW cache hit:", symbol);
        return cached.data;
    }

    // If a fresh fetch fails, fall back to any older copy so the Company
    // Overview card keeps appearing instead of vanishing (stale-on-error).
    const serveStaleOrFail = (reason) => {
        if (cached) {
            console.warn("OVERVIEW serving stale cached data after:", reason);
            return cached.data;
        }
        return { error: reason };
    };

    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const params = {
        function: "OVERVIEW",
        symbol,
        apikey: apiKey
    };

    console.log("OVERVIEW params:", {
        function: params.function,
        symbol: params.symbol,
        apikeyPresent: Boolean(params.apikey),
        apikeyLength: params.apikey?.length
    });

    // Up to 2 attempts: if the free tier rate-limits us, wait a few seconds and
    // try once more — short-lived rate-limit windows often clear quickly.
    for (let attempt = 1; attempt <= 2; attempt++) {
        await throttleAlphaVantage();

        let response;
        try {
            response = await axios.get("https://www.alphavantage.co/query", { params, timeout: 15000 });
        } catch (error) {
            console.error("OVERVIEW request failed:", error.message);
            return serveStaleOrFail(`Alpha Vantage request failed: ${error.message}`);
        }
        console.log("OVERVIEW response status:", response.status);

        const apiError = extractApiError(response.data);
        if (apiError) {
            const isRateLimit =
                apiError.toLowerCase().includes("rate limit") ||
                apiError.toLowerCase().includes("per minute");
            console.warn(`OVERVIEW API warning/error (attempt ${attempt}/2):`, apiError);
            if (isRateLimit && attempt < 2) {
                console.log(`OVERVIEW rate-limited — retrying in ${OVERVIEW_RETRY_DELAY_MS / 1000}s...`);
                await new Promise((resolve) => setTimeout(resolve, OVERVIEW_RETRY_DELAY_MS));
                continue;
            }
            return serveStaleOrFail(apiError);
        }

        if (!response.data || Object.keys(response.data).length === 0) {
            return serveStaleOrFail("Missing company overview data from Alpha Vantage.");
        }

        // 2) Success → refresh the cache so later searches skip the API entirely.
        overviewCache.set(symbol, { data: response.data, fetchedAt: Date.now() });
        console.log("OVERVIEW cached:", symbol);
        return response.data;
    }

    // Defensive — the loop always returns above; this just guarantees the
    // function never silently returns undefined.
    return { error: "Unexpected OVERVIEW failure." };
}

export async function getTimeSeriesDaily(stockSymbol) {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    const params = {
        function: "TIME_SERIES_DAILY",
        symbol: stockSymbol,
        apikey: apiKey
    };

    await throttleAlphaVantage();

    let response;
    try {
        response = await axios.get("https://www.alphavantage.co/query", { params, timeout: 15000 });
    } catch (error) {
        console.error("TIME_SERIES_DAILY request failed:", error.message);
        return { error: `Alpha Vantage request failed: ${error.message}` };
    }
    console.log("TIME_SERIES_DAILY response status:", response.status);

    const apiError = extractApiError(response.data);
    if (apiError) {
        console.warn("TIME_SERIES_DAILY API warning/error:", apiError);
        return { error: apiError };
    }

    const timeSeries = response.data["Time Series (Daily)"];
    if (!timeSeries || typeof timeSeries !== "object") {
        return { error: "Missing daily time series data from Alpha Vantage." };
    }

    const historicalData = Object.entries(timeSeries)
        .map(([date, data]) => ({
            date,
            open: Number(data["1. open"]),
            high: Number(data["2. high"]),
            low: Number(data["3. low"]),
            close: Number(data["4. close"]),
            volume: Number(data["5. volume"])
        }))
        // Drop any malformed record so a NaN value can never corrupt the future chart.
        .filter((record) => Number.isFinite(record.close));

    console.log("TIME_SERIES_DAILY historicalData length:", historicalData.length);
    return historicalData;
}