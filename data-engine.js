'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · DATA ENGINE v4
   ─────────────────────────────────────────────────────────────────────────
   Responsibilities:
   • All external API fetch logic (no DOM, no map, no UI)
   • Session cache with per-source TTL
   • Data normalization & transformation
   • Refresh interval management
   • Event bus for UI ↔ Engine decoupling
   ─────────────────────────────────────────────────────────────────────────
   Pattern: Engine fires CustomEvents on window.
   UI/Map subscribe and re-render only their slice.
═══════════════════════════════════════════════════════════════════════════ */

/* ─── EVENT BUS ──────────────────────────────────────────────────────────
   Dispatched events (all prefixed bx:):
     bx:quakes        — { features: [] }
     bx:events        — { events: [] }
     bx:crypto        — { coins: {BTC:{...}, ETH:{...}, ...} }
     bx:weather       — { cities: [{name,lat,lon,temp,wind,code}] }
     bx:news          — { bbc: [], guardian: [], pins: [] }
     bx:iss           — { lat, lng, alt, vel }
     bx:geopolitical  — { score, zones, pins }
     bx:pulse         — { seismic, events, market, geopolitical }
     bx:ticker        — { items: string[] }
     bx:loader        — { signal: true }
─────────────────────────────────────────────────────────────────────────── */
function emit(name, detail) {
  window.dispatchEvent(new CustomEvent('bx:' + name, { detail }));
}

/* ─── SESSION CACHE ─────────────────────────────────────────────────────── */
const Cache = {
  set(key, data, ttl = 300_000) {
    try { sessionStorage.setItem('bx4:' + key, JSON.stringify({ e: Date.now() + ttl, d: data })); } catch (_) {}
  },
  get(key) {
    try {
      const item = JSON.parse(sessionStorage.getItem('bx4:' + key) || 'null');
      if (item && item.e > Date.now()) return item.d;
      sessionStorage.removeItem('bx4:' + key);
    } catch (_) {}
    return null;
  },
};

/* ─── SHARED STATE ──────────────────────────────────────────────────────── */
const State = {
  quakes: [],
  events: [],
  newsBBC: [],
  newsGuardian: [],
  newsPins: [],        // resolved geo-pins for ALL news items
  cryptoRaw: null,
  issPos: null,
  seismicScore: 0,
  eventScore: 0,
  marketScore: 0,
  geopoliticalScore: 0,
};

/* ─── PULSE AGGREGATOR ──────────────────────────────────────────────────── */
function emitPulse() {
  emit('pulse', {
    seismic:      State.seismicScore,
    events:       State.eventScore,
    market:       State.marketScore,
    geopolitical: State.geopoliticalScore,
  });
}

/* ═══ 1. EARTHQUAKES — USGS LIVE FEED ══════════════════════════════════════ */
async function fetchEarthquakes() {
  const cached = Cache.get('quakes');
  if (cached) { _applyQuakes(cached); emit('loader', { signal: true }); }

  try {
    const r = await _timed('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson');
    const d = await r.json();
    const features = d.features || [];
    Cache.set('quakes', features, 300_000);
    _applyQuakes(features);
    emit('loader', { signal: true });
  } catch (e) {
    console.warn('[USGS]', e.message);
    emit('loader', { signal: true });
  }
}

function _applyQuakes(features) {
  State.quakes = features;
  const cnt   = features.length;
  const m5cnt = features.filter(f => (f.properties.mag || 0) >= 5).length;
  State.seismicScore = Math.min(100, m5cnt * 7 + (cnt > 50 ? 15 : 0));
  emit('quakes', { features, count: cnt, m5count: m5cnt, score: State.seismicScore });
  emitPulse();
}

/* ═══ 2. EARTH EVENTS — NASA EONET ═════════════════════════════════════════ */
async function fetchEarthEvents() {
  const cached = Cache.get('events');
  if (cached) { _applyEvents(cached); emit('loader', { signal: true }); }

  try {
    const r = await _timed('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=40');
    const d = await r.json();
    const events = d.events || [];
    Cache.set('events', events, 900_000);
    _applyEvents(events);
    emit('loader', { signal: true });
  } catch (e) {
    console.warn('[EONET]', e.message);
    emit('loader', { signal: true });
  }
}

function _applyEvents(events) {
  State.events = events;
  State.eventScore = Math.min(100, events.length * 2.8);
  emit('events', { events, count: events.length, score: State.eventScore });
  emitPulse();
}

/* ═══ 3. CRYPTO — CRYPTOCOMPARE ═════════════════════════════════════════════ */
const COIN_DEFS = [
  { fsym: 'BTC', name: 'Bitcoin',   color: '#ea580c', icon: '₿', iconBg: '#fff7ed' },
  { fsym: 'ETH', name: 'Ethereum',  color: '#7c3aed', icon: 'Ξ', iconBg: '#f5f3ff' },
  { fsym: 'SOL', name: 'Solana',    color: '#059669', icon: '◎', iconBg: '#ecfdf5' },
  { fsym: 'BNB', name: 'BNB Chain', color: '#d97706', icon: '◈', iconBg: '#fffbeb' },
  { fsym: 'XRP', name: 'Ripple',    color: '#0284c7', icon: '✕', iconBg: '#f0f9ff' },
];

async function fetchCrypto() {
  const cached = Cache.get('crypto');
  if (cached) { _applyCrypto(cached); emit('loader', { signal: true }); }

  try {
    const syms = COIN_DEFS.map(c => c.fsym).join(',');
    const r = await _timed(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${syms}&tsyms=USD`);
    const raw = await r.json();
    if (!raw.RAW) throw new Error('Bad shape');
    Cache.set('crypto', raw.RAW, 60_000);
    _applyCrypto(raw.RAW);

    // Parallel sparkline fetches
    await Promise.allSettled(COIN_DEFS.map(async coin => {
      try {
        const hr = await _timed(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${coin.fsym}&tsym=USD&limit=7`);
        const hd = await hr.json();
        const closes = (hd.Data?.Data || []).map(d => d.close).filter(Boolean);
        if (closes.length > 2) {
          emit('cryptoSparkline', { fsym: coin.fsym, closes });
        }
      } catch (_) {}
    }));

    emit('loader', { signal: true });
  } catch (e) {
    console.warn('[Crypto]', e.message);
    emit('loader', { signal: true });
  }
}

function _applyCrypto(rawData) {
  State.cryptoRaw = rawData;
  const coins = {};
  let totalAbs = 0, valid = 0;

  COIN_DEFS.forEach(def => {
    const d = rawData?.[def.fsym]?.USD;
    if (!d) return;
    const price = d.PRICE || 0;
    const changePct = d.CHANGEPCT24HOUR || 0;
    const volume = d.VOLUME24HOURTO || 0;
    totalAbs += Math.abs(changePct);
    valid++;
    coins[def.fsym] = { ...def, price, changePct, volume, high: d.HIGH24HOUR, low: d.LOW24HOUR };
  });

  if (valid > 0) {
    const avgAbs = totalAbs / valid;
    State.marketScore = Math.min(100, avgAbs * 9);
    emit('crypto', { coins, avgVolatility: avgAbs, score: State.marketScore });
    emitPulse();
  }
}

/* ═══ 4. WEATHER — OPEN-METEO ══════════════════════════════════════════════ */
const CITY_DEFS = [
  { name: 'New York',  lat: 40.71,  lon: -74.01 },
  { name: 'London',    lat: 51.51,  lon:  -0.13 },
  { name: 'Tokyo',     lat: 35.68,  lon: 139.69 },
  { name: 'Dubai',     lat: 25.20,  lon:  55.27 },
  { name: 'Mumbai',    lat: 19.08,  lon:  72.88 },
  { name: 'Moscow',    lat: 55.75,  lon:  37.62 },
  { name: 'Sydney',    lat: -33.87, lon: 151.21 },
  { name: 'São Paulo', lat: -23.55, lon: -46.63 },
];

async function fetchWeather() {
  const cached = Cache.get('weather');
  if (cached) { emit('weather', { cities: cached }); emit('loader', { signal: true }); }

  try {
    const results = await Promise.allSettled(
      CITY_DEFS.map(c =>
        _timed(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current_weather=true&forecast_days=1`)
          .then(r => r.json())
      )
    );
    const cities = results.map((res, i) => {
      const def = CITY_DEFS[i];
      if (res.status !== 'fulfilled' || !res.value?.current_weather) return { ...def, error: true };
      const cw = res.value.current_weather;
      return { ...def, temp: cw.temperature, wind: cw.windspeed, code: cw.weathercode };
    });
    Cache.set('weather', cities, 1_800_000);
    emit('weather', { cities });
    emit('loader', { signal: true });
  } catch (e) {
    console.warn('[Weather]', e.message);
    emit('loader', { signal: true });
  }
}

/* ═══ 5. ISS POSITION — WHERETHEISS.AT ════════════════════════════════════ */
async function fetchISS() {
  try {
    const r = await _timed('https://api.wheretheiss.at/v1/satellites/25544');
    const d = await r.json();
    const pos = {
      lat: parseFloat(d.latitude),
      lng: parseFloat(d.longitude),
      alt: parseFloat(d.altitude).toFixed(0),
      vel: parseInt(d.velocity).toLocaleString(),
      ts: Date.now(),
    };
    State.issPos = pos;
    emit('iss', pos);
  } catch (e) {
    console.warn('[ISS]', e.message);
  }
}

/* ═══ 6. NEWS — 4-PROXY CHAIN RSS ══════════════════════════════════════════
   Sources: BBC World, The Guardian
   Proxy chain: corsproxy → allorigins/raw → allorigins/get → codetabs
   After successful parse: resolve ALL items to geo-pins via GeoIntelligence
═══════════════════════════════════════════════════════════════════════════ */
const NEWS_SOURCES = {
  bbc:      { url: 'https://feeds.bbci.co.uk/news/world/rss.xml',  label: 'BBC WORLD', color: '#dc2626' },
  guardian: { url: 'https://www.theguardian.com/world/rss',         label: 'GUARDIAN',  color: '#059669' },
};

function _proxyChain(feedUrl) {
  const enc = encodeURIComponent(feedUrl);
  return [
    { url: `https://corsproxy.io/?${enc}`,               mode: 'raw' },
    { url: `https://api.allorigins.win/raw?url=${enc}`,  mode: 'raw' },
    { url: `https://api.allorigins.win/get?url=${enc}`,  mode: 'json' },
    { url: `https://api.codetabs.com/v1/proxy?quest=${enc}`, mode: 'raw' },
  ];
}

function _parseRSS(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  if (xml.querySelector('parsererror')) throw new Error('XML parse error');
  const nodes = [...xml.querySelectorAll('item, entry')];
  if (!nodes.length) throw new Error('No items found');
  return nodes.map(el => {
    const gt = tag => (el.querySelector(tag)?.textContent || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const linkEl = el.querySelector('link');
    const link = linkEl?.textContent?.trim() || linkEl?.getAttribute('href') || gt('guid') || '';
    const description = gt('description') || gt('summary') || '';
    return {
      title: gt('title'),
      link,
      pubDate: gt('pubDate') || gt('updated') || gt('published') || new Date().toISOString(),
      description: description.replace(/<[^>]+>/g, '').slice(0, 200),
    };
  }).filter(i => i.title && i.title.length > 3);
}

async function _fetchRSS(key) {
  const src = NEWS_SOURCES[key];
  const chain = _proxyChain(src.url);
  for (const proxy of chain) {
    try {
      const r = await _timed(proxy.url, 20_000);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let xmlText;
      if (proxy.mode === 'json') {
        const j = await r.json();
        if (!j.contents?.trim()) throw new Error('Empty JSON');
        xmlText = j.contents;
      } else {
        xmlText = await r.text();
        if (!xmlText?.trim()) throw new Error('Empty raw');
      }
      const items = _parseRSS(xmlText);
      if (!items.length) throw new Error('Zero items after parse');
      return items;
    } catch (e) {
      console.info(`[RSS][${key}][${proxy.url.slice(0, 30)}…] ${e.message}`);
    }
  }
  throw new Error('All proxies failed for ' + key);
}

async function fetchNews() {
  // Serve cache immediately
  const cached = Cache.get('news');
  if (cached) {
    State.newsBBC = cached.bbc || [];
    State.newsGuardian = cached.guardian || [];
    _resolveAndEmitNews();
    emit('loader', { signal: true });
  }

  const [r1, r2] = await Promise.allSettled([
    _fetchRSS('bbc').catch(e => { console.info('[BBC]', e.message); return []; }),
    _fetchRSS('guardian').catch(e => { console.info('[Guardian]', e.message); return []; }),
  ]);

  let updated = false;
  if (r1.status === 'fulfilled' && r1.value.length) { State.newsBBC = r1.value; updated = true; }
  if (r2.status === 'fulfilled' && r2.value.length) { State.newsGuardian = r2.value; updated = true; }

  if (updated) {
    Cache.set('news', { bbc: State.newsBBC, guardian: State.newsGuardian }, 600_000);
    _resolveAndEmitNews();
  } else if (!cached) {
    emit('news', { bbc: [], guardian: [], pins: [], error: true });
  }
  emit('loader', { signal: true });
}

/* ── Resolve ALL news items to geo-pins and emit ── */
function _resolveAndEmitNews() {
  const allItems = [
    ...State.newsBBC.map(i => ({ ...i, source: 'bbc' })),
    ...State.newsGuardian.map(i => ({ ...i, source: 'guardian' })),
  ];

  // Resolve every item — skip only if truly no geo match
  const pins = [];
  const seen = new Set(); // dedupe very close pins
  allItems.forEach((item, idx) => {
    const geo = window.GeoIntelligence?.resolveNewsGeo(item.title, item.description);
    if (!geo) return;
    // Dedupe: snap to grid 1°x1° to avoid pile-ups, but keep if different crisis type
    const gridKey = `${Math.round(geo.lat)},${Math.round(geo.lng)},${geo.crisisType}`;
    if (seen.has(gridKey)) {
      // Slight jitter to show overlap
      geo.lat += (Math.random() - 0.5) * 0.6;
      geo.lng += (Math.random() - 0.5) * 0.6;
    }
    seen.add(gridKey);
    pins.push({ ...item, ...geo, pinIdx: idx });
  });

  State.newsPins = pins;

  // Geopolitical score
  State.geopoliticalScore = window.GeoIntelligence?.computeGeopoliticalScore(pins) || 0;

  emit('news', {
    bbc: State.newsBBC,
    guardian: State.newsGuardian,
    pins,
    total: allItems.length,
    pinCount: pins.length,
  });

  emit('geopolitical', {
    score: State.geopoliticalScore,
    zones: window.GeoIntelligence?.getConflictZones() || [],
    pins,
  });

  emitPulse();
  _buildAndEmitTicker(allItems);
}

/* ─── TICKER BUILDER ─────────────────────────────────────────────────────── */
function _buildAndEmitTicker(items) {
  if (!items.length) {
    emit('ticker', { items: _fallbackTickerItems() });
    return;
  }
  const tickerItems = items.map(i => i.title).filter(Boolean);
  emit('ticker', { items: tickerItems });
}

function _fallbackTickerItems() {
  return [
    'BACKSTAX WORLD MONITOR — ALL SYSTEMS OPERATIONAL',
    'LIVE SEISMIC TRACKING · USGS GLOBAL NETWORK',
    'NASA EONET — MONITORING OPEN EARTH EVENTS',
    'ISS POSITION UPDATING EVERY 10 SECONDS',
    'CRYPTO MARKETS VIA CRYPTOCOMPARE · 60s REFRESH',
    'WEATHER INTELLIGENCE — 8 GLOBAL CITIES',
    'GEOPOLITICAL INTELLIGENCE — LIVE CONFLICT TRACKING',
    '20+ ACTIVE CONFLICT ZONES MONITORED CONTINUOUSLY',
  ];
}

/* ─── NETWORK UTILITY ────────────────────────────────────────────────────── */
async function _timed(url, ms = 12_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/* ─── BOOT & REFRESH SCHEDULE ────────────────────────────────────────────── */
function boot() {
  // All fetches fire immediately in parallel
  Promise.allSettled([
    fetchEarthquakes(),
    fetchEarthEvents(),
    fetchCrypto(),
    fetchWeather(),
    fetchNews(),
    fetchISS(),
  ]);

  // Refresh intervals
  setInterval(fetchISS,           10_000);
  setInterval(fetchCrypto,        60_000);
  setInterval(fetchEarthquakes,  300_000);
  setInterval(fetchNews,         600_000);
  setInterval(fetchEarthEvents,  900_000);
  setInterval(fetchWeather,    1_800_000);
}

/* ─── PUBLIC API ─────────────────────────────────────────────────────────── */
window.DataEngine = {
  boot,
  fetchEarthquakes,
  fetchEarthEvents,
  fetchCrypto,
  fetchWeather,
  fetchNews,
  fetchISS,
  getState: () => ({ ...State }),
  COIN_DEFS,
  CITY_DEFS,
};
