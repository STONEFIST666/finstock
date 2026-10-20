import {
  WATCHLIST_KEY,
  MAX_WATCHLIST_ITEMS,
  createWatchlistStorage,
  isWatched,
  removeSymbol,
  toggleSymbol
} from "./watchlist-store.js";

(function () {
  var section = document.getElementById("watchlist");
  if (!section) return;

  var listEl = document.getElementById("watchlist-list");
  var emptyEl = document.getElementById("watchlist-empty");
  var countEl = document.getElementById("watchlist-count");
  var statusEl = document.getElementById("watchlist-status");
  var storage = createWatchlistStorage();
  var symbols = storage.load();

  function announce(message) {
    if (statusEl) statusEl.textContent = message;
  }

  function renderStars() {
    document.querySelectorAll(".watchlist-toggle").forEach(function (button) {
      var symbol = button.getAttribute("data-symbol") || "";
      var watched = isWatched(symbols, symbol);

      button.setAttribute("aria-pressed", String(watched));
      button.classList.toggle("is-watched", watched);

      var label = button.querySelector(".watchlist-toggle__label");
      if (label) label.textContent = watched ? "Watching" : "Watch";

      button.setAttribute(
        "aria-label",
        (watched ? "Remove " : "Add ") + symbol + (watched ? " from watchlist" : " to watchlist")
      );
    });
  }

  function createItem(symbol) {
    var item = document.createElement("li");
    item.className = "watchlist__item";

    var form = document.createElement("form");
    form.method = "POST";
    form.action = "/search";
    form.className = "watchlist__form";

    var input = document.createElement("input");
    input.type = "hidden";
    input.name = "stock-symbol";
    input.value = symbol;

    var openButton = document.createElement("button");
    openButton.type = "submit";
    openButton.className = "watchlist__symbol";
    openButton.textContent = symbol;

    var removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "watchlist__remove";
    removeButton.setAttribute("aria-label", "Remove " + symbol + " from watchlist");
    removeButton.textContent = "\u00d7";
    removeButton.addEventListener("click", function () {
      var result = removeSymbol(symbols, symbol);
      commit(result.list, symbol + " removed from watchlist.");
    });

    form.appendChild(input);
    form.appendChild(openButton);
    item.appendChild(form);
    item.appendChild(removeButton);
    return item;
  }

  function render() {
    if (countEl) countEl.textContent = String(symbols.length);

    if (listEl) {
      listEl.textContent = "";
      symbols.forEach(function (symbol) {
        listEl.appendChild(createItem(symbol));
      });
      listEl.hidden = symbols.length === 0;
    }

    if (emptyEl) emptyEl.hidden = symbols.length > 0;

    renderStars();
  }

  function commit(nextSymbols, message) {
    symbols = nextSymbols;
    storage.save(symbols);
    render();
    if (message) announce(message);
  }

  document.querySelectorAll(".watchlist-toggle").forEach(function (button) {
    button.addEventListener("click", function () {
      var symbol = button.getAttribute("data-symbol") || "";
      var result = toggleSymbol(symbols, symbol);

      if (result.reason === "full") {
        announce("Watchlist is full (" + MAX_WATCHLIST_ITEMS + " symbols). Remove one to add another.");
        return;
      }

      if (result.watched) {
        commit(result.list, symbol + " added to watchlist.");
      } else if (result.removed) {
        commit(result.list, symbol + " removed from watchlist.");
      }
    });
  });

  // Keep tabs in sync when another tab changes the watchlist.
  window.addEventListener("storage", function (event) {
    if (event.key !== WATCHLIST_KEY) return;
    symbols = storage.load();
    render();
  });

  section.hidden = false;
  render();

  if (!storage.available) {
    announce("Watchlist can't be saved because browser storage is unavailable.");
  }
})();
