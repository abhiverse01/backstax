# BACKSTAX

**A real-time world intelligence dashboard. No backend. No cost. No noise.**

Live seismic events, market data, ISS tracking, earth events, and global news — all in a single HTML file that opens in any browser.

---

## What it does

BACKSTAX pulls from six independent live data sources and renders everything on an interactive world map with side panels for context. It computes a **Global Threat Score** from seismic, environmental, and market signals in real time.

| Layer | Source | Refresh |
|---|---|---|
| Earthquakes M4.5+ | USGS Global Feed | 5 min |
| Natural Events (fire, storm, volcano) | NASA EONET | 15 min |
| ISS Live Position | wheretheiss.at | 10 sec |
| Crypto Markets + Sparklines | CryptoCompare | 1 min |
| World Weather (8 cities) | Open-Meteo | on load |
| News Intel (BBC / Guardian) | RSS via proxy chain | 10 min |
| Global Health Aggregate | disease.sh | 1 hr |

---

## Stack

```
HTML · CSS · Vanilla JS · Leaflet.js
```

One file. Zero build steps. Zero dependencies to install. Zero API keys.

---

## Run it

```bash
# Just open it
open backstax.html

# Or serve locally if you prefer
npx serve .
python3 -m http.server
```

No `.env`. No `npm install`. No config.

---

## Architecture

```
backstax.html
│
├── CSS Variables       → full theming system, light palette
├── 3-column grid       → left panel · map · right panel · ticker
│
├── Map Engine          → Leaflet + CartoDB Positron tiles
│   ├── qLayer          → seismic markers (pulsing, magnitude-scaled)
│   ├── eLayer          → NASA event markers (category-colored)
│   ├── iLayer          → ISS live dot (updates every 10s)
│   └── nLayer          → news geo-pins (deterministic placement)
│
├── Data Engine
│   ├── fetchEarthquakes()   → USGS GeoJSON
│   ├── fetchEarthEvents()   → NASA EONET v3
│   ├── fetchISS()           → wheretheiss.at
│   ├── fetchCrypto()        → CryptoCompare pricemultifull + histoday
│   ├── fetchWeather()       → Open-Meteo current_weather
│   ├── fetchHealth()        → disease.sh aggregate
│   └── fetchNews()          → 4-proxy fallback chain → DOMParser
│
└── Threat Engine
    └── computeThreat()      → weighted score (seismic 45% · events 30% · market 25%)
```

---

## News proxy chain

RSS feeds don't support CORS. BACKSTAX tries four proxies in order, falls back automatically:

```
corsproxy.io  →  allorigins.win/raw  →  allorigins.win/get  →  codetabs.com
```

Parses both RSS `<item>` and Atom `<entry>` formats natively with `DOMParser`. No third-party RSS libraries.

---

## Threat Score

Computed locally from live data. Not a feed — derived signal.

```
Score = (seismic_score × 0.45) + (event_score × 0.30) + (market_score × 0.25)
```

| Range | Status |
|---|---|
| 0 – 19 | LOW |
| 20 – 39 | GUARDED |
| 40 – 59 | ELEVATED |
| 60 – 79 | HIGH |
| 80 – 100 | CRITICAL |

---

## Features

- Toggle each map layer independently
- Click any event → map flies to location
- Sparklines with 7-day real price history (deterministic fallback if rate-limited)
- Live news ticker — pauses on hover
- Dual news source tabs (BBC World / The Guardian)
- Global pulse bars for seismic, event, and market activity
- UTC clock, threat chip in header, city weather with wind
- Developer card (`?` button, bottom-right)

---

## Limitations

- All APIs are public/free tier — occasional rate limits apply
- News proxy availability varies; fallback chain handles it silently
- ISS tracking requires `wheretheiss.at` uptime
- No historical data storage — everything is live and ephemeral

---

## License

MIT — use it, fork it, build on it.

---

*Built by [Abhishek Shah](https://abhishekshah.vercel.app)*  
*[GitHub](https://github.com/abhiverse01) · [LinkedIn](https://linkedin.com/in/theabhishekshah)*
