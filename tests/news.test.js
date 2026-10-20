import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_NEWS_ARTICLES,
  buildNewsUrl,
  parsePublishedAt,
  toNewsArticles
} from "../services/news.js";

const sampleFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Yahoo! Finance: AAPL News</title>
    <item>
      <title><![CDATA[Apple hits record high]]></title>
      <description>Apple &amp; suppliers rally.</description>
      <link>https://finance.yahoo.com/news/apple-record.html</link>
      <pubDate>Tue, 20 Oct 2026 14:30:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

test("buildNewsUrl encodes the symbol and keeps it ticker-specific", () => {
  const url = new URL(buildNewsUrl(" brk.b "));
  assert.equal(url.origin + url.pathname, "https://feeds.finance.yahoo.com/rss/2.0/headline");
  assert.equal(url.searchParams.get("s"), "BRK.B");
  assert.equal(url.searchParams.get("region"), "US");
  assert.equal(url.searchParams.get("lang"), "en-US");
});

test("parsePublishedAt converts RFC 822 dates to ISO", () => {
  assert.equal(parsePublishedAt("Tue, 20 Oct 2026 14:30:00 +0000"), "2026-10-20T14:30:00.000Z");
});

test("parsePublishedAt rejects malformed values", () => {
  for (const value of [null, "", "not a date", 42]) {
    assert.equal(parsePublishedAt(value), null);
  }
});

test("toNewsArticles maps RSS items into the app shape", () => {
  const articles = toNewsArticles(sampleFeed);

  assert.deepEqual(articles, [
    {
      title: "Apple hits record high",
      url: "https://finance.yahoo.com/news/apple-record.html",
      source: "Yahoo Finance",
      summary: "Apple & suppliers rally.",
      publishedAt: "2026-10-20T14:30:00.000Z"
    }
  ]);
});

test("toNewsArticles caps the list and skips unsafe or empty items", () => {
  const items = Array.from({ length: MAX_NEWS_ARTICLES + 3 }, (_, i) => `
    <item>
      <title>Headline ${i}</title>
      <link>https://example.com/news/${i}</link>
      <pubDate>Tue, 20 Oct 2026 14:30:00 +0000</pubDate>
    </item>`).join("");

  const feed = `<rss><channel>
    <item><title>Unsafe</title><link>javascript:alert(1)</link></item>
    <item><link>https://example.com/missing-title</link></item>
    ${items}
  </channel></rss>`;

  const articles = toNewsArticles(feed);

  assert.equal(articles.length, MAX_NEWS_ARTICLES);
  assert.equal(articles[0].title, "Headline 0");
  assert.ok(articles.every((article) => article.url.startsWith("https://example.com/")));
});

test("toNewsArticles tolerates malformed input", () => {
  assert.deepEqual(toNewsArticles(""), []);
  assert.deepEqual(toNewsArticles("not xml"), []);
  assert.deepEqual(toNewsArticles(null), []);
  assert.deepEqual(toNewsArticles("<rss><channel></channel></rss>"), []);
});
