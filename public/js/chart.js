import { computeRSI, computeSMA } from "./indicators.js";
import {
  CHART_RANGE_KEY,
  createChartRangeStorage,
  normalizeChartRange
} from "./chart-settings.js";

(function () {
  var canvas = document.getElementById("price-chart");
  if (!canvas || typeof Chart === "undefined") return;

  var records = (window.FINSTOCK && window.FINSTOCK.historicalData) || [];
  if (!records.length) return;

  // Alpha Vantage sends newest -> oldest. Sort ascending so the timeline
  // reads oldest -> newest left to right.
  var parsed = records
    .slice()
    .sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    })
    .map(function (record) {
      var ts = new Date(record.date + "T00:00:00");
      return { date: record.date, close: Number(record.close), ts: ts };
    })
    .filter(function (record) {
      return !Number.isNaN(record.ts.getTime()) && Number.isFinite(record.close);
    });

  if (!parsed.length) return;

  var closes = parsed.map(function (record) {
    return record.close;
  });

  // Indicators are computed once over the full history, then sliced by the
  // range controls. That means a 1M view can still show a 200-day average.
  var sma20 = computeSMA(closes, 20);
  var sma50 = computeSMA(closes, 50);
  var sma200 = computeSMA(closes, 200);
  var rsi14 = computeRSI(closes, 14);

  parsed.forEach(function (record, index) {
    record.sma20 = sma20[index];
    record.sma50 = sma50[index];
    record.sma200 = sma200[index];
    record.rsi = rsi14[index];
  });

  var currentRecords = parsed;
  var rangeStorage = createChartRangeStorage();
  var ctx = canvas.getContext("2d");

  var datasets = [
    {
      key: "close",
      label: "Close",
      data: closes,
      borderColor: "#2563eb",
      // Scriptable option: Chart.js re-runs this on every render/resize, so
      // the fill gradient always matches the current canvas height.
      backgroundColor: function (context) {
        var instance = context.chart;
        var area = instance.chartArea || {};
        var gradient = instance.ctx.createLinearGradient(0, area.top || 0, 0, area.bottom || instance.height);
        gradient.addColorStop(0, "rgba(37, 99, 235, 0.22)");
        gradient.addColorStop(1, "rgba(37, 99, 235, 0)");
        return gradient;
      },
      fill: true,
      borderWidth: 2,
      tension: 0.15,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: "#2563eb",
      pointHoverBorderColor: "#ffffff",
      pointHoverBorderWidth: 2
    },
    {
      key: "sma20",
      label: "SMA 20",
      data: sma20,
      borderColor: "#f59e0b",
      borderWidth: 1.5,
      tension: 0.15,
      pointRadius: 0,
      pointHoverRadius: 3,
      fill: false,
      hidden: true
    },
    {
      key: "sma50",
      label: "SMA 50",
      data: sma50,
      borderColor: "#10b981",
      borderWidth: 1.5,
      tension: 0.15,
      pointRadius: 0,
      pointHoverRadius: 3,
      fill: false,
      hidden: true
    },
    {
      key: "sma200",
      label: "SMA 200",
      data: sma200,
      borderColor: "#ef4444",
      borderWidth: 1.5,
      tension: 0.15,
      pointRadius: 0,
      pointHoverRadius: 3,
      fill: false,
      hidden: true
    }
  ];

  var datasetIndex = {};
  datasets.forEach(function (dataset, index) {
    datasetIndex[dataset.key] = index;
  });

  var chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: parsed.map(function (record) {
        return record.date;
      }),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#e2e8f0",
          bodyColor: "#ffffff",
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: function (items) {
              return items.length ? items[0].label : "";
            },
            label: function (item) {
              var value = Number(item.parsed.y);
              if (!Number.isFinite(value)) return "";
              return item.dataset.label + ": $" + value.toFixed(2);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: "#e2e8f0" },
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            maxTicksLimit: 8,
            maxRotation: 0,
            autoSkip: true
          }
        },
        y: {
          grid: { color: "#f1f5f9" },
          border: { display: false },
          ticks: {
            color: "#64748b",
            font: { size: 11 },
            callback: function (value) {
              return "$" + Number(value).toFixed(0);
            }
          }
        }
      }
    }
  });

  // ===== RSI chart (separate 0-100 scale) =====
  var rsiContainer = document.getElementById("rsi-container");
  var rsiCanvas = document.getElementById("rsi-chart");
  var rsiChart = null;

  function rsiData(recordsToPlot) {
    return {
      labels: recordsToPlot.map(function (record) {
        return record.date;
      }),
      datasets: [
        {
          label: "RSI (14)",
          data: recordsToPlot.map(function (record) {
            return record.rsi;
          }),
          borderColor: "#6366f1",
          borderWidth: 2,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false
        },
        {
          label: "Overbought (70)",
          data: recordsToPlot.map(function () {
            return 70;
          }),
          borderColor: "rgba(239, 68, 68, 0.45)",
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        },
        {
          label: "Oversold (30)",
          data: recordsToPlot.map(function () {
            return 30;
          }),
          borderColor: "rgba(16, 185, 129, 0.45)",
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    };
  }

  function ensureRsiChart() {
    if (rsiChart || !rsiCanvas) return rsiChart;

    rsiChart = new Chart(rsiCanvas.getContext("2d"), {
      type: "line",
      data: rsiData(currentRecords),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#e2e8f0",
            bodyColor: "#ffffff",
            padding: 8,
            cornerRadius: 8,
            displayColors: false,
            filter: function (item) {
              return item.dataset.label === "RSI (14)" && item.parsed.y !== null;
            },
            callbacks: {
              title: function (items) {
                return items.length ? items[0].label : "";
              },
              label: function (item) {
                return "RSI 14: " + Number(item.parsed.y).toFixed(1);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: "#e2e8f0" },
            ticks: { display: false }
          },
          y: {
            min: 0,
            max: 100,
            grid: { color: "#f1f5f9" },
            border: { display: false },
            ticks: {
              color: "#64748b",
              font: { size: 10 },
              stepSize: 25
            }
          }
        }
      }
    });

    return rsiChart;
  }

  function updateRsiChart(recordsToPlot) {
    if (!rsiChart) return;

    rsiChart.data = rsiData(recordsToPlot);
    rsiChart.update();
  }

  // ===== Indicator toggles =====
  var REQUIRED_HISTORY = { sma20: 20, sma50: 50, sma200: 200, rsi: 15 };

  function toggleIndicator(key, button) {
    var enabled = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(enabled));
    button.classList.toggle("is-active", enabled);

    if (key === "rsi") {
      if (rsiContainer) rsiContainer.hidden = !enabled;
      if (enabled) {
        ensureRsiChart();
        updateRsiChart(currentRecords);
        if (rsiChart) rsiChart.resize();
      }
      return;
    }

    var index = datasetIndex[key];
    if (typeof index === "number") {
      chart.setDatasetVisibility(index, enabled);
      chart.update();
    }
  }

  document.querySelectorAll(".indicator-toggle").forEach(function (button) {
    var key = button.getAttribute("data-indicator");
    var required = REQUIRED_HISTORY[key] || 0;

    if (parsed.length < required) {
      button.disabled = true;
      button.title = "Not enough price history for this indicator.";
      return;
    }

    button.addEventListener("click", function () {
      toggleIndicator(key, button);
    });
  });

  // ===== Time-range controls (pure client-side filtering) =====
  // Months to look back per range; null means no cutoff (ALL).
  var RANGE_MONTHS = { "1M": 1, "3M": 3, "6M": 6, "ALL": null };

  // Shift a date by N months, clamping the day to the target month's
  // length (e.g. May 31 minus 1 month -> Apr 30, not May 1).
  function shiftMonths(date, delta) {
    var shifted = new Date(date.getTime());
    var day = shifted.getDate();
    shifted.setDate(1);
    shifted.setMonth(shifted.getMonth() + delta);
    var lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
    shifted.setDate(Math.min(day, lastDay));
    return shifted;
  }

  function applyRange(key) {
    key = normalizeChartRange(key);
    rangeStorage.save(key);

    var months = RANGE_MONTHS[key];
    var filtered = parsed;

    if (months !== null && parsed.length) {
      // parsed is ascending, so the newest record is last.
      var latest = parsed[parsed.length - 1].ts;
      var cutoff = shiftMonths(latest, -months);
      cutoff.setHours(0, 0, 0, 0);

      filtered = parsed.filter(function (record) {
        return record.ts >= cutoff;
      });

      // Graceful fallback: if the cutoff would leave zero records, show
      // everything we have rather than an empty chart.
      if (!filtered.length) filtered = parsed;
    }

    currentRecords = filtered;

    chart.data.labels = filtered.map(function (record) {
      return record.date;
    });

    ["close", "sma20", "sma50", "sma200"].forEach(function (datasetKey) {
      chart.data.datasets[datasetIndex[datasetKey]].data = filtered.map(function (record) {
        return record[datasetKey];
      });
    });

    chart.update();
    updateRsiChart(filtered);

    var subtitle = document.getElementById("chart-range-subtitle");
    if (subtitle) {
      subtitle.textContent =
        filtered[0].date + " \u2192 " + filtered[filtered.length - 1].date +
        " \u00b7 " + filtered.length + " trading days";
    }

    document.querySelectorAll(".chart-range").forEach(function (button) {
      var active = button.getAttribute("data-range") === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  document.querySelectorAll(".chart-range").forEach(function (button) {
    button.addEventListener("click", function () {
      applyRange(button.getAttribute("data-range"));
    });
  });

  // Keep the saved range in sync if another tab changes it.
  window.addEventListener("storage", function (event) {
    if (event.key !== CHART_RANGE_KEY) return;
    applyRange(event.newValue);
  });

  applyRange(rangeStorage.load());
})();
