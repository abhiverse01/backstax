# 🌍 BACKSTAX

[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-blue?logo=github)](https://abhiverse01.github.io/backstax/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)  
[![PWA](https://img.shields.io/badge/PWA-Enabled-yellowgreen)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

> **Real-time world intelligence dashboard**  
> Live seismic events, market signals, ISS tracking, environmental events, and global news — all **in a single HTML file**. Browser-native. Zero backend. Zero cost.


## 🚀 Live Demo

[https://abhiverse01.github.io/backstax/](https://abhiverse01.github.io/backstax/)

![BACKSTAX Demo](https://user-images.githubusercontent.com/000000/placeholder-demo.gif "Live demo placeholder")  
*Interactive map with real-time updates*


## 🧠 What BACKSTAX Does

- Aggregates **multiple live global data sources**
- Displays events on a **dynamic Leaflet map**
- Computes **Global Threat Score**
- Runs entirely in-browser, offline-capable via Service Worker


## 🔥 Core Intelligence Layers

| Layer | Source | Refresh |
|-------|--------|--------|
| 🌍 Earthquakes (M4.5+) | USGS | 5 min |
| 🔥 Natural Events | NASA EONET | 15 min |
| 🛰️ ISS Live Tracking | wheretheiss.at | 10 sec |
| 💰 Crypto Markets + Sparklines | CryptoCompare | 1 min |
| 🌦️ Weather (8 global cities) | Open-Meteo | On load |
| 📰 News Intel | BBC / Guardian via proxy chain | 10 min |
| 🧬 Global Health | disease.sh | 1 hr |


## 🧮 Threat Intelligence Engine

Computed **locally** from live data:

```text
Threat Score = (Seismic × 0.45) + (Events × 0.30) + (Market × 0.25)
````

| Score  | Status      |
| ------ | ----------- |
| 0–19   | 🟢 LOW      |
| 20–39  | 🟡 GUARDED  |
| 40–59  | 🟠 ELEVATED |
| 60–79  | 🔴 HIGH     |
| 80–100 | ⚫ CRITICAL  |

> Derived, not a feed. Pure signal.


## 🗺️ System Architecture

```text
index.html
│
├── 🎨 UI Layer
│   ├── CSS Variables → full theming
│   ├── 3-column grid → left panel · map · right panel
│   ├── Toast & Offline Detection
│
├── 🗺️ Map Engine (Leaflet.js)
│   ├── qLayer → seismic markers
│   ├── eLayer → event markers
│   ├── iLayer → ISS tracker
│   └── nLayer → news geo-pins
│
├── 📡 Data Engine
│   ├── fetchEarthquakes()
│   ├── fetchEarthEvents()
│   ├── fetchISS()
│   ├── fetchCrypto()
│   ├── fetchWeather()
│   ├── fetchHealth()
│   └── fetchNews() → proxy chain
│
├── 🧠 Threat Engine → computeThreat()
│
└── ⚡ Service Worker
    ├── Offline caching
    ├── Asset pre-cache
    ├── Network fallback
    └── Update notifications
```

![Architecture Diagram](https://user-images.githubusercontent.com/000000/placeholder-architecture.png "System Architecture Diagram")


## 🧩 Tech Stack

```text
HTML · CSS · Vanilla JavaScript · Leaflet.js
```

* No frameworks
* No build steps
* No API keys


## ⚙️ Run Locally

```bash
# Open in browser
open index.html

# Or serve locally
npx serve .
python3 -m http.server
```


## 🌐 News Proxy System (CORS Bypass)

BACKSTAX uses a **4-step fallback chain**:

```text
corsproxy.io → allorigins.win/raw → allorigins.win/get → codetabs.com
```

* Handles RSS & Atom feeds natively
* Automatic silent fallback
* No third-party RSS libraries


## ⚡ PWA & Offline

* Service Worker pre-caches static assets
* Offline fallback for navigation & data
* Auto-update detection (with optional user confirmation)
* Instant activation via `skipWaiting`

## 🎯 Features

* Layer toggling
* Event click → fly to location
* Crypto sparklines & 7-day history
* Live news ticker (hover pause)
* Dual news source tabs (BBC / Guardian)
* Global activity pulses
* UTC clock & threat chip
* Weather panels (8 cities)
* Developer info card (`?` button)
* Full offline support

## ⚠️ Limitations

* Free/public API tiers → occasional rate limits
* Proxy availability may vary
* ISS tracking depends on external uptime
* Stateless: no historical storage


## 🖌️ Design Philosophy

> Minimal system. Maximum intelligence.

* Browser-native → no server needed
* Single-file → extreme portability
* Stateless → real-time signals
* Lightweight → zero dependency, fast load


## 👨‍💻 Developer

**Abhishek Shah**
📧 [abhishek.aimarine@gmail.com](mailto:abhishek.aimarine@gmail.com)
🔗 [LinkedIn](https://linkedin.com/in/theabhishekshah)
🔗 [Portfolio](https://abhishekshah.vercel.app)
🔗 [GitHub](https://github.com/abhiverse01)


## 📜 License

MIT — free to use, modify, and build upon.

## ⭐ Extra Visuals (optional)

![Map Layers](https://user-images.githubusercontent.com/000000/placeholder-maplayers.gif "Map Layer Toggle Demo")
![Threat Score](https://user-images.githubusercontent.com/000000/placeholder-threat.gif "Threat Score Pulse Demo")


## 💡 Contribution Guide

1. Fork the repository
2. Open `index.html` locally
3. Improve UI, add layers, optimise performance
4. Submit PR with clear description & screenshots

> BACKSTAX is not just a dashboard — it’s a **browser-native global intelligence system**.
> Every signal. Every event. One map. One file. Zero hassle.
