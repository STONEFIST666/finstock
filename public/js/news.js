(function () {
  var card = document.getElementById("news-card");
  if (!card) return;

  var button = document.getElementById("news-load");
  var listEl = document.getElementById("news-list");
  var emptyEl = document.getElementById("news-empty");
  var statusEl = document.getElementById("news-status");
  var updatedEl = document.getElementById("news-updated-at");
  var labelEl = button ? button.querySelector(".news-card__load-label") : null;
  var symbol = card.getAttribute("data-symbol") || "";
  var loading = false;
  var loaded = false;

  function announce(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function formatDate(iso) {
    if (!iso) return "Date unavailable";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function formatUpdated(iso) {
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Headlines and sentiment for " + symbol;
    return "Updated " + date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function sentimentClass(label) {
    var lower = String(label || "").toLowerCase();
    if (lower.indexOf("bullish") !== -1) return "news-sentiment--positive";
    if (lower.indexOf("bearish") !== -1) return "news-sentiment--negative";
    return "news-sentiment--neutral";
  }

  function createArticle(article) {
    var item = document.createElement("li");
    item.className = "news-item";

    var link = document.createElement("a");
    link.className = "news-item__link";
    link.href = article.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = article.title;
    item.appendChild(link);

    var meta = document.createElement("p");
    meta.className = "news-item__meta";

    var source = document.createElement("span");
    source.className = "news-item__source";
    source.textContent = article.source;
    meta.appendChild(source);

    var time = document.createElement("time");
    time.dateTime = article.publishedAt || "";
    time.textContent = formatDate(article.publishedAt);
    meta.appendChild(time);

    if (article.sentimentLabel) {
      var sentiment = document.createElement("span");
      sentiment.className = "news-sentiment " + sentimentClass(article.sentimentLabel);
      sentiment.textContent = article.sentimentLabel;
      meta.appendChild(sentiment);
    }

    item.appendChild(meta);

    if (article.summary) {
      var summary = document.createElement("p");
      summary.className = "news-item__summary";
      summary.textContent = article.summary;
      item.appendChild(summary);
    }

    return item;
  }

  function renderArticles(articles, meta) {
    if (listEl) {
      listEl.textContent = "";
      articles.forEach(function (article) {
        listEl.appendChild(createArticle(article));
      });
      listEl.hidden = articles.length === 0;
    }

    if (emptyEl) emptyEl.hidden = articles.length > 0;
    if (updatedEl) {
      updatedEl.textContent =
        articles.length === 0
          ? "No recent articles for " + symbol
          : formatUpdated(meta.lastUpdated) + (meta.cached ? " (cached)" : "");
    }
  }

  async function load() {
    if (!button || loading) return;

    loading = true;
    button.disabled = true;
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    if (labelEl) labelEl.textContent = "Loading";
    announce("");

    try {
      var response = await fetch("/api/news/" + encodeURIComponent(symbol), {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load market news.");
      }

      renderArticles(Array.isArray(payload.articles) ? payload.articles : [], payload);
      loaded = true;
    } catch (error) {
      announce(error.message || "Unable to load market news.");
    } finally {
      loading = false;
      button.disabled = false;
      button.classList.remove("is-loading");
      button.removeAttribute("aria-busy");
      if (labelEl) labelEl.textContent = loaded ? "Refresh news" : "Load news";
    }
  }

  if (button) button.addEventListener("click", load);
})();
