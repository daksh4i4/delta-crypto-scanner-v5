# Delta Crypto Scanner V5

A new V5 project based on the supplied scanner source.

## V5 updates
- Product name/version changed to Delta Crypto Scanner V5 across the app and deployment config.
- Added Wilder-smoothed ADX with +DI/-DI directional confirmation. Default ADX period: 14; default minimum ADX: 20.
- Set an indicator parameter to `0` to disable its condition group. For example, ADX threshold `0` removes ADX from gating, scoring and confirmation count. Zero EMA periods disable the corresponding Wave/Tide EMA group; zero RSI, MACD, Stochastic, Volume or S/R parameters disable those conditions.
- Added an on-demand **Configure Indicators** button and ADX settings.
- Changed dashboard styling to a clean white/light professional theme.
- Telegram control has explicit **START ALERTS / STOP ALERTS** actions.
- Telegram sends only on a fresh actionable state transition (NEUTRAL -> BUY/SELL or BUY <-> SELL); repeated same-direction scans are suppressed.

## Render deployment
1. Push this folder to a NEW GitHub repository.
2. Create a new Render Web Service from that repository.
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in Render environment variables.
4. Deploy.

No live trading orders are placed. Signals are technical analysis outputs, not guaranteed recommendations. Backtest and paper trade before risking capital.


## V5.1 UI fixes and local testing
- Fixed the frontend script URL to be relative (`app.js`), so the UI JavaScript loads when previewing the extracted folder.
- Added complete light-theme overrides for the scanner table, including its scroll container, sticky columns, headers and rows.
- The Indicator Settings toggle is visible and the form is prefilled with defaults (including ADX 14 / threshold 20) before the first API response.
- `0` values are retained in the settings form and sent to the backend when Save & Rescan is used.

### Important: do not use `file:///.../index.html` for live scanning
Opening `index.html` directly from File Explorer only previews the static page. It cannot connect to the Delta API through this app's backend routes, WebSocket, or persist settings. Run the FastAPI backend instead:

```bash
cd delta-crypto-scanner-v5
pip install -r requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000` in Chrome. For hosted use, deploy the project to Render as described above.
