(function () {
  var button = document.getElementById("quote-refresh");
  if (!button) return;

  var symbol = button.getAttribute("data-symbol") || "";
  var updatedEl = document.getElementById("quote-updated-at");
  var statusEl = document.getElementById("quote-refresh-status");
  var labelEl = button.querySelector(".quote-refresh__label");
  var initialUpdatedAt = button.getAttribute("data-updated-at");
  var initialCached = button.getAttribute("data-cached") === "true";

  function formatCurrency(value) {
    var number = Number(value);
    return Number.isFinite(number) ? "$" + number.toFixed(2) : "N/A";
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatUpdated(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }

  function renderUpdated(iso, cached) {
    if (!updatedEl) return;
    var time = formatUpdated(iso);
    if (!time) return;
    updatedEl.textContent = "Updated " + time + (cached ? " (cached)" : "");
  }

  function renderQuote(quote) {
    var priceEl = document.getElementById("quote-price");
    if (priceEl) {
      priceEl.textContent = formatCurrency(quote.price);
      priceEl.setAttribute("aria-label", "Current price: " + formatCurrency(quote.price));
    }

    var changeEl = document.getElementById("quote-change");
    var change = Number(quote.change);
    if (changeEl && Number.isFinite(change)) {
      var up = change >= 0;
      changeEl.hidden = false;
      changeEl.classList.toggle("stock-card__change--up", up);
      changeEl.classList.toggle("stock-card__change--down", !up);

      var arrowEl = document.getElementById("quote-change-arrow");
      if (arrowEl) arrowEl.textContent = up ? "\u25b2" : "\u25bc";

      setText("quote-change-text", quote.change + " (" + quote.changePercent + ")");
    }

    setText("quote-open", formatCurrency(quote.open));
    setText("quote-high", formatCurrency(quote.high));
    setText("quote-low", formatCurrency(quote.low));
    setText("quote-previous-close", formatCurrency(quote.previousClose));

    var volumeEl = document.getElementById("quote-volume");
    var volume = Number(quote.volume);
    if (volumeEl) {
      volumeEl.textContent = Number.isFinite(volume) ? volume.toLocaleString("en-US") : "N/A";
    }
  }

  function announce(message) {
    if (!statusEl) return;
    statusEl.textContent = message;
  }

  if (updatedEl && initialUpdatedAt) {
    renderUpdated(initialUpdatedAt, initialCached);
  }

  button.addEventListener("click", async function () {
    if (button.disabled) return;

    button.disabled = true;
    button.classList.add("is-loading");
    button.setAttribute("aria-busy", "true");
    if (labelEl) labelEl.textContent = "Refreshing";
    announce("");

    try {
      var response = await fetch("/api/quote/" + encodeURIComponent(symbol), {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        throw new Error(payload.error || "Unable to refresh the quote.");
      }

      renderQuote(payload);
      renderUpdated(payload.lastUpdated, payload.cached);
      announce(payload.cached ? "Quote is up to date (served from cache)." : "Quote refreshed.");
    } catch (error) {
      announce(error.message || "Unable to refresh the quote.");
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.removeAttribute("aria-busy");
      if (labelEl) labelEl.textContent = "Refresh";
    }
  });
})();
