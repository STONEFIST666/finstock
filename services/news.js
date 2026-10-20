import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { createTtlCache } from "./cache.js";

export const MAX_NEWS_ARTICLES = 5;
export const NEWS_SOURCE = "Yahoo Finance";

const NEWS_BASE_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline";
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;

// News is fetched only when the user asks for it. A 30-minute window keeps
// repeated clicks and page revisits cheap. The RSS feed itself needs no API key.
const newsCache = createTtlCache({ ttlMs: NEWS_CACHE_TTL_MS, maxEntries: 30 });

export function buildNewsUrl(symbol) {
  const params = new URLSearchParams({
    s: String(symbol || "").trim().toUpperCase(),
    region: "US",
    lang: "en-US"
  });
  return `${NEWS_BASE_URL}?${params.toString()}`;
}

export function parsePublishedAt(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function safeHttpUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function stripHtml(value) {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function toNewsArticles(xml, { limit = MAX_NEWS_ARTICLES } = {}) {
  if (typeof xml !== "string" || !xml.trim()) return [];

  let parsed;
  try {
    parsed = new XMLParser({ ignoreAttributes: true, trimValues: true }).parse(xml);
  } catch {
    return [];
  }

  const channel = parsed?.rss?.channel;
  if (!channel) return [];

  const articles = [];

  for (const item of asArray(channel.item)) {
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    if (!title) continue;

    // Never surface a link we would not want to open ourselves.
    const url = safeHttpUrl(item.link);
    if (!url) continue;

    articles.push({
      title,
      url,
      source: NEWS_SOURCE,
      summary: stripHtml(item.description),
      publishedAt: parsePublishedAt(item.pubDate)
    });

    if (articles.length >= limit) break;
  }

  return articles;
}

export async function getNewsSnapshot(stockSymbol) {
  const symbol = String(stockSymbol || "").trim().toUpperCase();

  const cached = newsCache.get(symbol);
  if (cached) {
    console.log("NEWS feed cache hit:", symbol);
    return { data: cached.value, fetchedAt: cached.fetchedAt, fromCache: true };
  }

  const serveStaleOrFail = (reason) => {
    const stale = newsCache.get(symbol, { allowStale: true });
    if (stale) {
      console.warn("NEWS feed serving stale cached data after:", reason);
      return { data: stale.value, fetchedAt: stale.fetchedAt, fromCache: true };
    }
    return { error: reason };
  };

  let response;
  try {
    response = await axios.get(buildNewsUrl(symbol), {
      timeout: 15000,
      responseType: "text",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinStock/1.0)" }
    });
  } catch (error) {
    console.error("NEWS feed request failed:", error.message);
    return serveStaleOrFail(`News feed request failed: ${error.message}`);
  }

  if (typeof response.data !== "string") {
    return serveStaleOrFail("Unexpected news feed response.");
  }

  const articles = toNewsArticles(response.data);
  const entry = newsCache.set(symbol, articles);
  console.log("NEWS feed cached:", symbol, "articles:", articles.length);
  return { data: entry.value, fetchedAt: entry.fetchedAt, fromCache: false };
}
