
/* ============================================================
   DELTA CRYPTO SCANNER V5
   PROFESSIONAL FRONTEND — MATCHES NEW index.html
   ============================================================ */

"use strict";

/* -------------------- HELPERS -------------------- */

const $ = id => document.getElementById(id);

const API = {
    status: "/api/status",
    settings: "/api/settings",
    telegram: "/api/telegram",
    telegramToggle: "/api/telegram/toggle",
    websocket: "/ws"
};

let latestData = null;
let activeFilter = "ALL";
let searchText = "";
let socket = null;
let reconnectTimer = null;
let reconnectDelay = 3000;
let telegramEnabled = false;
let telegramConfigured = false;
let telegramBusy = false;
let settingsBusy = false;

const DEFAULTS = {
    wave_tf: "15m",
    tide_tf: "1h",

    wave_ema: [9, 20, 50],
    tide_ema: [9, 20, 50],
    tide_filter_ema: [9, 20],

    rsi_period: 14,
    rsi_buy: 50,
    rsi_sell: 50,

    macd_fast: 12,
    macd_slow: 26,
    macd_signal: 9,

    stoch_period: 14,
    stoch_k: 3,
    stoch_d: 3,

    adx_period: 14,
    adx_threshold: 20,
    di_filter_enabled: true,

    supertrend_period: 10,
    supertrend_multiplier: 3,

    bb_period: 20,
    bb_deviation: 2,

    volume_sma: 20,
    volume_multiplier: 1,

    obv_threshold: 1,

    atr_period: 14,
    atr_multiplier: 1.5,

    min_rr: 2,
    buy_score: 75,
    sell_score: 25,
    min_signal_confirmations: 7,

    sr_lookback: 80,
    sr_pivot: 3,
    sl_buffer_pct: 0.15,
    min_volume_ratio: 1
};

/* -------------------- SETTINGS FIELD MAP -------------------- */

const FIELD_MAP = {
    waveEma1: ["wave_ema", 0],
    waveEma2: ["wave_ema", 1],
    waveEma3: ["wave_ema", 2],

    tideEma1: ["tide_ema", 0],
    tideEma2: ["tide_ema", 1],
    tideEma3: ["tide_ema", 2],

    adxPeriod: "adx_period",
    adxThreshold: "adx_threshold",
    diFilter: "di_filter_enabled",

    rsiPeriod: "rsi_period",
    rsiBuy: "rsi_buy",
    rsiSell: "rsi_sell",

    macdFast: "macd_fast",
    macdSlow: "macd_slow",
    macdSignal: "macd_signal",

    stochK: "stoch_period",
    stochD: "stoch_d",
    stochSmooth: "stoch_k",

    supertrendPeriod: "supertrend_period",
    supertrendMultiplier: "supertrend_multiplier",

    bbPeriod: "bb_period",
    bbDeviation: "bb_deviation",

    volumePeriod: "volume_sma",
    volumeMultiplier: "volume_multiplier",

    obvThreshold: "obv_threshold",

    atrPeriod: "atr_period",
    atrMultiplier: "atr_multiplier",

    riskReward: "min_rr",
    buyScore: "buy_score",
    sellScore: "sell_score",
    minConfirmations: "min_signal_confirmations"
};

function setMessage(message, error = false) {
    const el = $("saveMessage");

    if (!el) {
        console.log(message);
        return;
    }

    el.textContent = message;
    el.style.color = error ? "#dc2626" : "#15803d";
}

function numberValue(id, fallback = 0) {
    const el = $(id);
    if (!el || el.value === "") return fallback;

    const value = Number(el.value);
    return Number.isFinite(value) ? value : fallback;
}

function safeNumber(value, digits = 6) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    const number = Number(value);
    if (!Number.isFinite(number)) return "—";

    return number.toLocaleString(undefined, {
        maximumFractionDigits: digits
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "—";
}

/* -------------------- SETTINGS LOAD -------------------- */

function fillSettings(settings = {}) {
    const s = { ...DEFAULTS, ...settings };

    Object.entries(FIELD_MAP).forEach(([id, mapping]) => {
        const input = $(id);
        if (!input) return;

        let value;

        if (Array.isArray(mapping)) {
            value = s[mapping[0]]?.[mapping[1]];
        } else {
            value = s[mapping];
        }

        if (value !== undefined && value !== null) {
            input.value = value;
        }
    });

    if ($("diFilter")) {
        $("diFilter").value =
            String(s.di_filter_enabled !== false);
    }
}

function collectSettings() {
    const s = {
        ...DEFAULTS,

        wave_tf: latestData?.settings?.wave_tf || DEFAULTS.wave_tf,
        tide_tf: latestData?.settings?.tide_tf || DEFAULTS.tide_tf,

        wave_ema: [
            numberValue("waveEma1", 9),
            numberValue("waveEma2", 20),
            numberValue("waveEma3", 50)
        ],

        tide_ema: [
            numberValue("tideEma1", 9),
            numberValue("tideEma2", 20),
            numberValue("tideEma3", 50)
        ],

        adx_period: numberValue("adxPeriod", 14),
        adx_threshold: numberValue("adxThreshold", 20),
        di_filter_enabled: $("diFilter")?.value === "true",

        rsi_period: numberValue("rsiPeriod", 14),
        rsi_buy: numberValue("rsiBuy", 50),
        rsi_sell: numberValue("rsiSell", 50),

        macd_fast: numberValue("macdFast", 12),
        macd_slow: numberValue("macdSlow", 26),
        macd_signal: numberValue("macdSignal", 9),

        stoch_period: numberValue("stochK", 14),
        stoch_d: numberValue("stochD", 3),
        stoch_k: numberValue("stochSmooth", 3),

        supertrend_period: numberValue("supertrendPeriod", 10),
        supertrend_multiplier: numberValue("supertrendMultiplier", 3),

        bb_period: numberValue("bbPeriod", 20),
        bb_deviation: numberValue("bbDeviation", 2),

        volume_sma: numberValue("volumePeriod", 20),
        volume_multiplier: numberValue("volumeMultiplier", 1),

        obv_threshold: numberValue("obvThreshold", 1),

        atr_period: numberValue("atrPeriod", 14),
        atr_multiplier: numberValue("atrMultiplier", 1.5),

        min_rr: numberValue("riskReward", 2),
        buy_score: numberValue("buyScore", 75),
        sell_score: numberValue("sellScore", 25),
        min_signal_confirmations: numberValue("minConfirmations", 7)
    };

    return s;
}

/* -------------------- SETTINGS VALIDATION -------------------- */

function validateSettings(s) {
    const positiveFields = [
        ["ADX Period", s.adx_period],
        ["RSI Period", s.rsi_period],
        ["MACD Fast", s.macd_fast],
        ["MACD Slow", s.macd_slow],
        ["MACD Signal", s.macd_signal],
        ["Stochastic Period", s.stoch_period],
        ["Stochastic K", s.stoch_k],
        ["Stochastic D", s.stoch_d],
        ["Supertrend Period", s.supertrend_period],
        ["Bollinger Period", s.bb_period],
        ["ATR Period", s.atr_period],
        ["Volume Period", s.volume_sma]
    ];

    for (const [name, value] of positiveFields) {
        if (!Number.isFinite(value) || value <= 0) {
            return `${name} must be greater than 0.`;
        }
    }

    if (s.macd_fast >= s.macd_slow) {
        return "MACD Fast must be smaller than MACD Slow.";
    }

    if (s.min_rr <= 0) {
        return "Risk / Reward must be greater than 0.";
    }

    if (s.buy_score < 0 || s.buy_score > 100 ||
        s.sell_score < 0 || s.sell_score > 100) {
        return "BUY and SELL scores must be between 0 and 100.";
    }

    if (s.adx_threshold < 0) {
        return "ADX threshold cannot be negative.";
    }

    return null;
}

/* -------------------- SAVE SETTINGS -------------------- */

async function saveSettings() {
    if (settingsBusy) return;

    const button = $("saveSettings");
    const settings = collectSettings();
    const error = validateSettings(settings);

    if (error) {
        setMessage(error, true);
        return;
    }

    settingsBusy = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
    }

    try {
        const response = await fetch(API.settings, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(settings)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.detail || result.error || `HTTP ${response.status}`);
        }

        if (result.settings) {
            fillSettings(result.settings);
        }

        setMessage("Settings saved successfully. Scanner rescan requested.");

        await loadStatus();

    } catch (error) {
        console.error("Settings save failed:", error);
        setMessage(`Save failed: ${error.message}`, true);
    } finally {
        settingsBusy = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Save Settings & Rescan";
        }
    }
}

/* -------------------- RESET SETTINGS -------------------- */

function resetSettings() {
    fillSettings(DEFAULTS);
    setMessage("Default settings restored. Press Save Settings & Rescan to apply.");
}

/* -------------------- CONFIG PANEL -------------------- */

function setupConfigPanel() {
    const panel = $("settingsPanel");

    $("configButton")?.addEventListener("click", () => {
        if (!panel) return;

        panel.hidden = false;
        $("configButton").textContent = "⚙ Configured";
    });

    $("closeConfig")?.addEventListener("click", () => {
        if (!panel) return;

        panel.hidden = true;
        $("configButton").textContent = "⚙ Configure";
    });

    $("saveSettings")?.addEventListener("click", saveSettings);
    $("resetSettings")?.addEventListener("click", resetSettings);
}

/* -------------------- SIGNAL HELPERS -------------------- */

function getSignal(market) {
    const signal = market?.indicators?.signal || "NEUTRAL";
    const normalized = String(signal).toUpperCase();

    return ["BUY", "SELL", "NEUTRAL"].includes(normalized)
        ? normalized
        : "NEUTRAL";
}

function signalHTML(signal) {
    const cls = signal === "BUY"
        ? "signal-buy"
        : signal === "SELL"
            ? "signal-sell"
            : "signal-neutral";

    const icon = signal === "BUY"
        ? "▲"
        : signal === "SELL"
            ? "▼"
            : "•";

    return `<span class="signal-badge ${cls}">${icon} ${signal}</span>`;
}

function changeHTML(value) {
    const n = Number(value);

    if (!Number.isFinite(n)) return "—";

    if (n > 0) {
        return `<span class="positive">▲ ${safeNumber(n, 2)}%</span>`;
    }

    if (n < 0) {
        return `<span class="negative">▼ ${safeNumber(Math.abs(n), 2)}%</span>`;
    }

    return `<span class="neutral-value">0.00%</span>`;
}

function scoreHTML(value) {
    const score = Number(value);

    if (!Number.isFinite(score)) return "—";

    const cls = score >= 70
        ? "score-high"
        : score <= 30
            ? "score-low"
            : "score-mid";

    return `<span class="score ${cls}">${safeNumber(score, 0)}</span>`;
}

function indicatorHTML(value, bullish = null) {
    if (value === null || value === undefined) return "—";

    if (bullish === null) {
        return safeNumber(value, 5);
    }

    return `<span class="${bullish ? "indicator-buy" : "indicator-sell"}">${safeNumber(value, 5)}</span>`;
}

function supertrendHTML(indicators) {
    const value = indicators?.supertrend ?? indicators?.wave?.supertrend;
    const direction = indicators?.supertrend_direction ??
        indicators?.wave?.supertrend_direction;

    if (direction === "BUY" || direction === "BULL" || direction === true) {
        return `<span class="indicator-buy">▲ BULL</span>`;
    }

    if (direction === "SELL" || direction === "BEAR" || direction === false) {
        return `<span class="indicator-sell">▼ BEAR</span>`;
    }

    if (value !== undefined && value !== null) {
        return safeNumber(value, 5);
    }

    return "—";
}

/* -------------------- MARKET FILTERS -------------------- */

function getFilteredMarkets(markets) {
    return markets.filter(market => {
        const symbol = String(market.symbol || "").toUpperCase();
        const signal = getSignal(market);

        const matchesSearch =
            !searchText || symbol.includes(searchText);

        const matchesFilter =
            activeFilter === "ALL" || signal === activeFilter;

        return matchesSearch && matchesFilter;
    });
}

function setupFilters() {
    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter || "ALL";

            document.querySelectorAll("[data-filter]").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            renderLatest();
        });
    });

    $("coinSearch")?.addEventListener("input", event => {
        searchText = event.target.value.trim().toUpperCase();
        renderLatest();
    });
}

/* -------------------- MARKET TABLE -------------------- */

function renderMarkets(markets) {
    const body = $("scannerBody");
    if (!body) return;

    const filtered = getFilteredMarkets(markets);

    if (!filtered.length) {
        body.innerHTML = `
            <tr>
                <td colspan="21" class="empty-state">
                    ${markets.length
                        ? "No markets match your search or filter."
                        : "Waiting for scanner data..."}
                </td>
            </tr>
        `;
        return;
    }

    filtered.sort((a, b) => {
        const scoreA = Number(a.indicators?.score ?? -1);
        const scoreB = Number(b.indicators?.score ?? -1);
        return scoreB - scoreA;
    });

    body.innerHTML = filtered.map((market, index) => {
        const x = market.indicators || {};
        const wave = x.wave || {};
        const plan = x.plan || {};

        const signal = getSignal(market);

        const macd = wave.macd;
        const macdSignal = wave.macd_signal;

        const macdBull = macd != null && macdSignal != null
            ? Number(macd) >= Number(macdSignal)
            : null;

        const stochBull = wave.stoch_k != null && wave.stoch_d != null
            ? Number(wave.stoch_k) >= Number(wave.stoch_d)
            : null;

        const entry = plan.entry;
        const stopLoss = plan.sl;
        const target = plan.tp1 ?? plan.target;

        return `
            <tr>
                <td>${index + 1}</td>

                <td>
                    <strong class="coin-name">
                        ${escapeHTML(market.symbol || "—")}
                    </strong>
                </td>

                <td><strong>${safeNumber(market.price, 8)}</strong></td>

                <td>${changeHTML(market.change)}</td>

                <td>${safeNumber(market.volume, 0)}</td>

                <td>${safeNumber(market.volume_rank, 0)}</td>

                <td>${safeNumber(market.oi, 0)}</td>

                <td>${escapeHTML(latestData?.settings?.wave_tf || "15m")}</td>

                <td>${escapeHTML(latestData?.settings?.tide_tf || "1h")}</td>

                <td>${safeNumber(x.tide9, 8)}</td>

                <td>${safeNumber(x.tide20, 8)}</td>

                <td>${indicatorHTML(wave.rsi, Number(wave.rsi) >= 50)}</td>

                <td>${x.adx_enabled === false ? "OFF" : safeNumber(wave.adx, 2)}</td>

                <td>${indicatorHTML(macd, macdBull)}</td>

                <td>${wave.stoch_k == null || wave.stoch_d == null
                    ? "—"
                    : indicatorHTML(
                        `${safeNumber(wave.stoch_k, 1)} / ${safeNumber(wave.stoch_d, 1)}`,
                        stochBull
                    )}</td>

                <td>${supertrendHTML(x)}</td>

                <td>${scoreHTML(x.score)}</td>

                <td>${signalHTML(signal)}</td>

                <td>${signal === "NEUTRAL" ? "—" : safeNumber(entry, 8)}</td>

                <td>${signal === "NEUTRAL" ? "—" : safeNumber(stopLoss, 8)}</td>

                <td>${signal === "NEUTRAL" ? "—" : safeNumber(target, 8)}</td>
            </tr>
        `;
    }).join("");
}

/* -------------------- STATUS COUNTS -------------------- */

function updateStats(data) {
    const markets = Array.isArray(data.markets) ? data.markets : [];

    let buy = 0;
    let sell = 0;
    let neutral = 0;

    markets.forEach(market => {
        const signal = getSignal(market);

        if (signal === "BUY") buy++;
        else if (signal === "SELL") sell++;
        else neutral++;
    });

    setText("marketCount", data.status?.coins ?? markets.length);
    setText("buyCount", buy);
    setText("sellCount", sell);
    setText("neutralCount", neutral);

    const lastScan = data.status?.last_scan;

    setText(
        "lastScan",
        lastScan
            ? new Date(lastScan * 1000).toLocaleTimeString()
            : "--"
    );

    const connection = document.querySelector(".connection");
    if (connection) {
        const connected = !!data.status?.ws_connected;

        connection.innerHTML = `
            <span class="status-dot ${connected ? "connected" : ""}"></span>
            ${connected ? "Delta Exchange Connected" : "Connecting to Delta Exchange"}
        `;
    }
}

/* -------------------- MAIN RENDER -------------------- */

function render(data) {
    if (!data || typeof data !== "object") return;

    latestData = data;

    updateStats(data);

    if (data.settings) {
        // Refresh settings only on initial load or server-side changes.
        // Avoid overwriting fields while the user is editing them.
        if (!$("settingsPanel")?.matches(":focus-within")) {
            fillSettings(data.settings);
        }
    }

    renderMarkets(Array.isArray(data.markets) ? data.markets : []);
}

function renderLatest() {
    if (!latestData) return;

    renderMarkets(
        Array.isArray(latestData.markets)
            ? latestData.markets
            : []
    );
}

/* -------------------- REST STATUS -------------------- */

async function loadStatus() {
    try {
        const response = await fetch(API.status, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        render(data);

        return data;
    } catch (error) {
        console.error("Status API error:", error);
        return null;
    }
}

/* -------------------- TELEGRAM -------------------- */

function updateTelegramUI() {
    const status = $("telegramStatus");
    const start = $("telegramStart");
    const stop = $("telegramStop");

    if (status) {
        status.textContent = !telegramConfigured
            ? "NOT CONFIGURED"
            : telegramEnabled
                ? "RUNNING"
                : "STOPPED";

        status.classList.toggle("on", telegramEnabled && telegramConfigured);
        status.classList.toggle("off", !telegramEnabled || !telegramConfigured);
    }

    if (start) {
        start.disabled = telegramBusy || !telegramConfigured || telegramEnabled;
    }

    if (stop) {
        stop.disabled = telegramBusy || !telegramConfigured || !telegramEnabled;
    }
}

async function loadTelegramStatus() {
    try {
        const response = await fetch(API.telegram, {
            cache: "no-store"
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        telegramEnabled = !!data.enabled;
        telegramConfigured = !!data.configured;

    } catch (error) {
        console.error("Telegram status error:", error);
        telegramEnabled = false;
        telegramConfigured = false;
    }

    updateTelegramUI();
}

async function setTelegram(enabled) {
    if (telegramBusy || !telegramConfigured) return;

    telegramBusy = true;
    updateTelegramUI();

    try {
        const response = await fetch(API.telegramToggle, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ enabled })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.ok === false) {
            throw new Error(data.error || data.detail || `HTTP ${response.status}`);
        }

        telegramEnabled = !!data.enabled;
        telegramConfigured = data.configured !== false;

    } catch (error) {
        console.error("Telegram toggle error:", error);
        alert(`Telegram update failed: ${error.message}`);
    } finally {
        telegramBusy = false;
        updateTelegramUI();
    }
}

function setupTelegram() {
    $("telegramStart")?.addEventListener("click", () => {
        setTelegram(true);
    });

    $("telegramStop")?.addEventListener("click", () => {
        setTelegram(false);
    });
}

/* -------------------- WEBSOCKET PATCH MERGE -------------------- */

function mergeDelta(delta) {
    if (!latestData) return;

    if (delta.status) {
        latestData.status = {
            ...(latestData.status || {}),
            ...delta.status
        };
    }

    if (delta.settings) {
        latestData.settings = {
            ...(latestData.settings || {}),
            ...delta.settings
        };
    }

    if (!Array.isArray(latestData.markets)) {
        latestData.markets = [];
    }

    const map = new Map(
        latestData.markets.map(market => [
            String(market.symbol),
            market
        ])
    );

    if (Array.isArray(delta.markets)) {
        delta.markets.forEach(patch => {
            const symbol = String(patch.symbol || "");
            if (!symbol) return;

            const existing = map.get(symbol);

            if (!existing) {
                latestData.markets.push(patch);
                map.set(symbol, patch);
                return;
            }

            Object.assign(existing, patch);
        });
    }

    if (Array.isArray(delta.removed)) {
        const removed = new Set(delta.removed.map(String));

        latestData.markets = latestData.markets.filter(
            market => !removed.has(String(market.symbol))
        );
    }

    render(latestData);
}

/* -------------------- WEBSOCKET CONNECTION -------------------- */

function connectWebSocket() {
    if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
         socket.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}${API.websocket}`;

    try {
        socket = new WebSocket(url);

        socket.onopen = () => {
            console.log("V5 WebSocket connected");
            reconnectDelay = 3000;

            const connection = document.querySelector(".connection");
            if (connection) {
                connection.innerHTML = `
                    <span class="status-dot connected"></span>
                    Delta Exchange Connected
                `;
            }
        };

        socket.onmessage = event => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "delta") {
                    mergeDelta(data);
                } else {
                    render(data);
                }
            } catch (error) {
                console.error("WebSocket message error:", error);
            }
        };

        socket.onerror = error => {
            console.error("WebSocket error:", error);
        };

        socket.onclose = () => {
            const connection = document.querySelector(".connection");

            if (connection) {
                connection.innerHTML = `
                    <span class="status-dot"></span>
                    Reconnecting...
                `;
            }

            if (reconnectTimer) clearTimeout(reconnectTimer);

            reconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, reconnectDelay);

            reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
        };

    } catch (error) {
        console.error("WebSocket connection failed:", error);

        reconnectTimer = setTimeout(
            connectWebSocket,
            reconnectDelay
        );
    }
}

/* -------------------- INITIALIZATION -------------------- */

async function initialize() {
    setupConfigPanel();
    setupFilters();
    setupTelegram();

    fillSettings(DEFAULTS);

    await loadStatus();
    await loadTelegramStatus();

    connectWebSocket();

    console.log("Delta Crypto Scanner V5 frontend initialized.");
}

document.addEventListener("DOMContentLoaded", initialize);

/* -------------------- GLOBAL FUNCTIONS -------------------- */

window.saveSettings = saveSettings;
window.resetSettings = resetSettings;
window.setTelegram = setTelegram;
