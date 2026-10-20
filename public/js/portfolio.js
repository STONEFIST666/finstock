import {
  PORTFOLIO_KEY,
  PORTFOLIO_PRICES_KEY,
  addPosition,
  parsePortfolio,
  parsePriceCache,
  portfolioTotals,
  positionMetrics,
  removePosition,
  serializePortfolio,
  serializePriceCache,
  updatePosition
} from "./portfolio-store.js";

(function () {
  var section = document.getElementById("portfolio");
  if (!section) return;

  var form = document.getElementById("portfolio-form");
  var symbolInput = document.getElementById("portfolio-symbol");
  var sharesInput = document.getElementById("portfolio-shares");
  var costInput = document.getElementById("portfolio-cost");
  var submitLabel = document.getElementById("portfolio-submit-label");
  var cancelButton = document.getElementById("portfolio-cancel");
  var feedbackEl = document.getElementById("portfolio-feedback");
  var statusEl = document.getElementById("portfolio-status");
  var bodyEl = document.getElementById("portfolio-body");
  var tableWrap = document.getElementById("portfolio-table-wrap");
  var summaryEl = document.getElementById("portfolio-summary");
  var emptyEl = document.getElementById("portfolio-empty");
  var updatedEl = document.getElementById("portfolio-updated-at");
  var refreshButton = document.getElementById("portfolio-refresh");
  var refreshLabel = refreshButton ? refreshButton.querySelector(".portfolio__refresh-label") : null;
  var valueEl = document.getElementById("portfolio-value");
  var costEl = document.getElementById("portfolio-cost-total");
  var pnlEl = document.getElementById("portfolio-pnl");
  var returnEl = document.getElementById("portfolio-return");

  var storageAvailable = (function () {
    try {
      var key = "__finstock_storage_test__";
      localStorage.setItem(key, "1");
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  })();

  function readStorage(key, parse) {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return parse(null);
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  var positions = readStorage(PORTFOLIO_KEY, parsePortfolio);
  var prices = readStorage(PORTFOLIO_PRICES_KEY, parsePriceCache);
  var editingSymbol = null;
  var fetching = false;

  function persistPositions() {
    writeStorage(PORTFOLIO_KEY, serializePortfolio(positions));
  }

  function persistPrices() {
    writeStorage(PORTFOLIO_PRICES_KEY, serializePriceCache(prices));
  }

  function formatCurrency(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "\u2014";
    return number.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatSignedCurrency(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "\u2014";
    return (number >= 0 ? "+" : "-") + formatCurrency(Math.abs(number));
  }

  function formatNumber(value, maxDigits) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "\u2014";
    return number.toLocaleString("en-US", { maximumFractionDigits: maxDigits || 6 });
  }

  function formatPercent(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "\u2014";
    return (number >= 0 ? "+" : "") + number.toFixed(2) + "%";
  }

  function formatDateTime(timestamp) {
    var date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function applySignClass(element, value) {
    if (!element) return;
    element.classList.toggle("is-positive", value > 0);
    element.classList.toggle("is-negative", value < 0);
  }

  function showFeedback(message) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message;
    feedbackEl.hidden = !message;
  }

  function announce(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function reasonMessage(reason) {
    switch (reason) {
      case "invalid-symbol":
        return "Enter a valid symbol (letters, numbers, dots or hyphens, up to 10 characters).";
      case "invalid-shares":
        return "Shares must be greater than zero.";
      case "invalid-cost":
        return "Average cost cannot be negative.";
      case "full":
        return "The portfolio is limited to 50 positions.";
      case "not-found":
        return "That position no longer exists.";
      default:
        return "Unable to save that position.";
    }
  }

  function describePrices(totals) {
    if (!totals.pricedCount) {
      return "Refresh prices to calculate value and P&L.";
    }

    var latest = 0;
    positions.forEach(function (position) {
      var entry = prices[position.symbol];
      if (entry && entry.fetchedAt > latest) latest = entry.fetchedAt;
    });

    var text = latest ? "Prices updated " + formatDateTime(latest) : "Prices loaded";
    if (totals.unpricedCount > 0) {
      text += " \u00b7 " + totals.unpricedCount + " position" + (totals.unpricedCount === 1 ? "" : "s") + " without a price";
    }
    return text;
  }

  function createActionButton(label, modifier, ariaLabel, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "portfolio-action" + (modifier ? " " + modifier : "");
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    button.addEventListener("click", onClick);
    return button;
  }

  function createRow(position) {
    var row = document.createElement("tr");
    var entry = prices[position.symbol];
    var metrics = positionMetrics(position, entry?.price);

    var symbolCell = document.createElement("td");
    var symbol = document.createElement("span");
    symbol.className = "portfolio-table__symbol";
    symbol.textContent = position.symbol;
    symbolCell.appendChild(symbol);
    row.appendChild(symbolCell);

    var sharesCell = document.createElement("td");
    sharesCell.textContent = formatNumber(position.shares);
    row.appendChild(sharesCell);

    var costCell = document.createElement("td");
    costCell.textContent = formatCurrency(position.avgCost);
    row.appendChild(costCell);

    var priceCell = document.createElement("td");
    priceCell.textContent = entry ? formatCurrency(entry.price) : "\u2014";
    row.appendChild(priceCell);

    var valueCell = document.createElement("td");
    valueCell.textContent = metrics ? formatCurrency(metrics.marketValue) : "\u2014";
    row.appendChild(valueCell);

    var pnlCell = document.createElement("td");
    pnlCell.className = "portfolio-table__pnl";
    if (metrics) {
      pnlCell.textContent =
        formatSignedCurrency(metrics.pnl) +
        (metrics.pnlPercent === null ? "" : " (" + formatPercent(metrics.pnlPercent) + ")");
      applySignClass(pnlCell, metrics.pnl);
    } else {
      pnlCell.textContent = "\u2014";
    }
    row.appendChild(pnlCell);

    var actionsCell = document.createElement("td");
    var actions = document.createElement("div");
    actions.className = "portfolio-table__actions";
    actions.appendChild(
      createActionButton("Edit", "", "Edit " + position.symbol + " position", function () {
        startEdit(position.symbol);
      })
    );
    actions.appendChild(
      createActionButton("Remove", "portfolio-action--danger", "Remove " + position.symbol + " position", function () {
        remove(position.symbol);
      })
    );
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);

    return row;
  }

  function render() {
    section.hidden = false;
    if (refreshButton) refreshButton.disabled = positions.length === 0 || fetching;

    if (bodyEl) bodyEl.textContent = "";

    if (!positions.length) {
      if (summaryEl) summaryEl.hidden = true;
      if (tableWrap) tableWrap.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      if (updatedEl) updatedEl.textContent = "Track cost basis and unrealized P&L";
      return;
    }

    if (summaryEl) summaryEl.hidden = false;
    if (tableWrap) tableWrap.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    positions.forEach(function (position) {
      if (bodyEl) bodyEl.appendChild(createRow(position));
    });

    var totals = portfolioTotals(positions, prices);

    if (valueEl) valueEl.textContent = totals.pricedCount ? formatCurrency(totals.marketValue) : "\u2014";
    if (costEl) costEl.textContent = formatCurrency(totals.costBasis);
    if (pnlEl) {
      pnlEl.textContent = totals.pricedCount ? formatSignedCurrency(totals.pnl) : "\u2014";
      applySignClass(pnlEl, totals.pricedCount ? totals.pnl : 0);
    }
    if (returnEl) {
      returnEl.textContent = totals.pnlPercent === null ? "\u2014" : formatPercent(totals.pnlPercent);
      applySignClass(returnEl, totals.pnlPercent === null ? 0 : totals.pnlPercent);
    }
    if (updatedEl) updatedEl.textContent = describePrices(totals);
  }

  function resetForm() {
    if (form) form.reset();
    editingSymbol = null;
    if (symbolInput) symbolInput.disabled = false;
    if (submitLabel) submitLabel.textContent = "Add position";
    if (cancelButton) cancelButton.hidden = true;
    showFeedback("");
  }

  function startEdit(symbol) {
    var position = positions.find(function (entry) {
      return entry.symbol === symbol;
    });
    if (!position) return;

    editingSymbol = symbol;
    if (symbolInput) {
      symbolInput.value = symbol;
      symbolInput.disabled = true;
    }
    if (sharesInput) sharesInput.value = String(position.shares);
    if (costInput) costInput.value = String(position.avgCost);
    if (submitLabel) submitLabel.textContent = "Save changes";
    if (cancelButton) cancelButton.hidden = false;
    showFeedback("");
    announce("Editing " + symbol + " position.");
    if (sharesInput) {
      sharesInput.focus();
      sharesInput.select();
    }
  }

  function remove(symbol) {
    var result = removePosition(positions, symbol);
    if (!result.removed) return;

    positions = result.list;
    persistPositions();
    render();

    if (editingSymbol === symbol) resetForm();
    announce("Removed " + symbol + " from the portfolio.");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!symbolInput || !sharesInput || !costInput) return;

    var input = {
      symbol: editingSymbol || symbolInput.value,
      shares: sharesInput.value,
      avgCost: costInput.value
    };

    if (editingSymbol) {
      var edited = editingSymbol;
      var update = updatePosition(positions, edited, input);
      if (!update.updated) {
        showFeedback(reasonMessage(update.reason));
        return;
      }

      positions = update.list;
      persistPositions();
      render();
      resetForm();
      announce("Updated " + edited + " position.");
      return;
    }

    var result = addPosition(positions, input);
    if (!result.added && !result.updated) {
      showFeedback(reasonMessage(result.reason));
      return;
    }

    positions = result.list;
    persistPositions();
    render();
    resetForm();

    var symbol = result.position.symbol;
    if (result.updated) {
      announce("Merged the new shares into your existing " + symbol + " position.");
    } else {
      announce("Added " + symbol + " to the portfolio.");
    }

    refreshPrices([symbol]);
  }

  function applyQuote(symbol, quote) {
    var price = Number(quote?.price);
    if (!Number.isFinite(price) || price <= 0) return false;

    var fetchedAt = Date.parse(quote?.lastUpdated);
    prices[symbol] = {
      price,
      fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Date.now()
    };
    return true;
  }

  async function refreshPrices(symbols) {
    var unique = Array.from(
      new Set((symbols || positions.map(function (position) { return position.symbol; })).filter(Boolean))
    );

    if (!unique.length || fetching) return;

    fetching = true;
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.classList.add("is-loading");
      refreshButton.setAttribute("aria-busy", "true");
    }
    if (refreshLabel) refreshLabel.textContent = "Refreshing";
    announce("Refreshing " + (unique.length === 1 ? "price" : "prices") + "\u2026");

    var failures = 0;

    for (var i = 0; i < unique.length; i++) {
      var symbol = unique[i];
      try {
        var response = await fetch("/api/quote/" + encodeURIComponent(symbol), {
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        var payload = await response.json().catch(function () {
          return {};
        });

        if (!response.ok) throw new Error(payload.error || "Quote unavailable.");
        if (!applyQuote(symbol, payload)) throw new Error("Quote missing a usable price.");

        render();
      } catch (error) {
        failures += 1;
        console.warn("Price refresh failed for " + symbol + ": " + (error.message || "unknown error"));
      }
      persistPrices();
    }

    fetching = false;
    if (refreshButton) {
      refreshButton.disabled = positions.length === 0;
      refreshButton.classList.remove("is-loading");
      refreshButton.removeAttribute("aria-busy");
    }
    if (refreshLabel) refreshLabel.textContent = "Refresh prices";

    render();

    if (failures === 0) {
      announce(unique.length === 1 ? "Price updated." : "Prices updated.");
    } else {
      announce(failures + " of " + unique.length + " prices could not be updated.");
    }
  }

  if (form) form.addEventListener("submit", handleSubmit);
  if (cancelButton) cancelButton.addEventListener("click", resetForm);
  if (refreshButton) {
    refreshButton.addEventListener("click", function () {
      refreshPrices();
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key === PORTFOLIO_KEY) {
      positions = readStorage(PORTFOLIO_KEY, parsePortfolio);
      if (editingSymbol && !positions.some(function (position) { return position.symbol === editingSymbol; })) {
        resetForm();
      }
      render();
    } else if (event.key === PORTFOLIO_PRICES_KEY) {
      prices = readStorage(PORTFOLIO_PRICES_KEY, parsePriceCache);
      render();
    }
  });

  section.hidden = false;
  render();

  if (!storageAvailable) {
    announce("Portfolio can't be saved because browser storage is unavailable.");
  } else {
    var missing = positions
      .map(function (position) { return position.symbol; })
      .filter(function (symbol) { return !prices[symbol]; });

    if (missing.length) refreshPrices(missing);
  }
})();
