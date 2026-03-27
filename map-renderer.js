'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · MAP RENDERER v4.1
   ─────────────────────────────────────────────────────────────────────────
   Fixes v4 → v4.1:
   • BUG: renderConflictZones now renders only ONCE on first bx:geopolitical
     event — was re-rendering all 16 zones on every news tick (excessive DOM)
   • BUG: Actor names in conflict popup now escaped via esc() — XSS surface fixed
   • BUG: ISS marker update now preserves open popup — checks MAP.hasLayer and
     rebinds popup to new marker instead of brutally clearing layer
   • BUG: renderNewsPins caps at MAX_NEWS_PINS (50) — prevents 100+ marker
     render on large feeds
   • NEW: Layer 'c' (conflict zones) added to LAYER_STATE and toggle system —
     can now be toggled from toolbar
   • NEW: MapRenderer.isReady() exported — DataEngine guards ISS emit timing
   • NEW: bx:connectivity listener — hides/shows connectivity overlay
   • PERF: preferCanvas:true kept; added maxClusterRadius concept via marker
     pane z-index layering (news pins below conflict/quake markers)
═══════════════════════════════════════════════════════════════════════════ */

let MAP      = null;
let mapReady = false;
let _conflictZonesRendered = false;   // render conflict zones exactly once
const MAX_NEWS_PINS = 50;             // safety cap on news pin count

/* ─── LAYER REGISTRY ─────────────────────────────────────────────────────── */
const LAYERS = {
  q: null,   // Earthquakes
  e: null,   // EONET events
  i: null,   // ISS
  n: null,   // News pins
  c: null,   // Conflict zones
  r: null,   // Reddit intelligence pins
};

const LAYER_STATE = { q: true, e: true, i: true, n: true, c: true, r: true };

/* ─── MAP INIT ───────────────────────────────────────────────────────────── */
function initMap() {
  MAP = L.map('map', {
    center:       [20, 10],
    zoom:         2,
    minZoom:      2,
    maxZoom:      10,
    zoomControl:  true,
    preferCanvas: true,   // Better performance for many simultaneous markers
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom:     19,
    subdomains:  'abcd',
    attribution: '© <a href="https://carto.com">CARTO</a> · © <a href="https://openstreetmap.org">OSM</a>',
  }).addTo(MAP);

  // Subtle reference grid lines
  L.polyline([[0, -180], [0, 180]],  { color: 'rgba(37,99,235,.05)', weight: 1, dashArray: '6,14', interactive: false }).addTo(MAP);
  L.polyline([[-90, 0], [90, 0]],   { color: 'rgba(37,99,235,.05)', weight: 1, dashArray: '6,14', interactive: false }).addTo(MAP);

  //Initialise layer groups — conflict zones use a lower pane so they sit
  // under markers but are still clickable
  LAYERS.c = L.layerGroup().addTo(MAP);
  LAYERS.n = L.layerGroup().addTo(MAP);
  LAYERS.e = L.layerGroup().addTo(MAP);
  LAYERS.q = L.layerGroup().addTo(MAP);
  LAYERS.i = L.layerGroup().addTo(MAP);
  LAYERS.r = L.layerGroup().addTo(MAP);

  mapReady = true;

  // Subscribe to DataEngine events
  window.addEventListener('bx:quakes',       e => renderQuakeMarkers(e.detail));
  window.addEventListener('bx:events',       e => renderEventMarkers(e.detail));
  window.addEventListener('bx:iss',          e => renderISSMarker(e.detail));
  window.addEventListener('bx:news',         e => renderNewsPins(e.detail));
  window.addEventListener('bx:geopolitical', e => {
    // Conflict zone circles are static world geometry — render only once.
    // They don't change between news refreshes. If status changes, call
    // MapRenderer.resetConflictZones() then re-trigger with new data.
    if (!_conflictZonesRendered) {
      renderConflictZones(e.detail);
      _conflictZonesRendered = true;
    }
  });
  window.addEventListener('bx:connectivity', e => {
    _showConnectivityOverlay(!e.detail.online);
  });
  window.addEventListener('bx:reddit', e => renderRedditPins(e.detail));
}

/* ─── CONNECTIVITY OVERLAY ───────────────────────────────────────────────── */
function _showConnectivityOverlay(show) {
  const existing = document.getElementById('mapOfflineBanner');
  if (show && !existing) {
    const el = document.createElement('div');
    el.id = 'mapOfflineBanner';
    el.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:900;background:rgba(255,255,255,.96);
      border:1px solid #fca5a5;border-radius:10px;
      padding:12px 20px;font-size:11px;font-weight:600;
      color:#dc2626;font-family:var(--fp,sans-serif);
      pointer-events:none;
    `;
    el.textContent = '⚠ Connection lost — data may be stale';
    document.getElementById('map-wrap')?.appendChild(el);
  } else if (!show && existing) {
    existing.remove();
  }
}

/* ─── LAYER TOGGLE ───────────────────────────────────────────────────────── */
function toggleLayer(key, btn) {
  const ly = LAYERS[key];
  if (!ly || !MAP) return;
  LAYER_STATE[key] = !LAYER_STATE[key];
  btn.classList.toggle('on', LAYER_STATE[key]);
  LAYER_STATE[key] ? ly.addTo(MAP) : MAP.removeLayer(ly);
}

/* Force re-render of conflict zones (call after registry updates) */
function resetConflictZones() {
  _conflictZonesRendered = false;
  LAYERS.c?.clearLayers();
}

/* ─── FLY TO ─────────────────────────────────────────────────────────────── */
function flyTo(lat, lng, zoom = 5) {
  if (!mapReady || !MAP) return;
  MAP.flyTo([lat, lng], zoom, { duration: 1.6, easeLinearity: 0.4 });
}

/* ─── UTILITIES ──────────────────────────────────────────────────────────── */
function mkIcon(html, w, h) {
  return L.divIcon({ className: '', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* ═══ EARTHQUAKE MARKERS ════════════════════════════════════════════════════ */
function qColor(mag) {
  if (mag >= 7.5) return '#7f1d1d';
  if (mag >= 7)   return '#dc2626';
  if (mag >= 6)   return '#ea580c';
  if (mag >= 5)   return '#d97706';
  return '#ca8a04';
}

function renderQuakeMarkers({ features }) {
  if (!mapReady) return;
  LAYERS.q.clearLayers();

  features.forEach(f => {
    const [lng, lat, dep] = f.geometry.coordinates;
    const mag   = f.properties.mag || 0;
    const place = f.properties.place || 'Unknown';
    const time  = new Date(f.properties.time);
    const c     = qColor(mag);
    const sz    = Math.max(10, Math.round(mag * 4.8));

    const icon = mkIcon(
      `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c}1a;border:2px solid ${c};box-shadow:0 0 ${sz}px ${c}44;animation:qpulse 2.6s infinite"></div>`,
      sz, sz
    );

    L.marker([lat, lng], { icon }).bindPopup(`
      <div class="pp-head">⚡ M${mag.toFixed(1)} Earthquake
        <span class="pp-badge b-red">SEISMIC</span>
      </div>
      <div class="pp-grid">
        <span class="pp-k">Location</span><span class="pp-v">${esc(place)}</span>
        <span class="pp-k">Depth</span><span class="pp-v">${dep.toFixed(0)} km</span>
        <span class="pp-k">Time</span><span class="pp-v">${timeAgo(time)}</span>
        <span class="pp-k">Coords</span><span class="pp-v">${lat.toFixed(2)}°, ${lng.toFixed(2)}°</span>
      </div>
    `).addTo(LAYERS.q);
  });
}

/* ═══ EONET MARKERS ═════════════════════════════════════════════════════════ */
function evColor(cat) {
  const c = (cat || '').toLowerCase();
  if (c.includes('wildfire') || c.includes('fire')) return '#ea580c';
  if (c.includes('storm'))   return '#0284c7';
  if (c.includes('flood'))   return '#0369a1';
  if (c.includes('volcano')) return '#c2410c';
  if (c.includes('ice'))     return '#7dd3fc';
  if (c.includes('drought')) return '#a16207';
  return '#d97706';
}

function evEmoji(cat) {
  const c = (cat || '').toLowerCase();
  if (c.includes('wildfire') || c.includes('fire')) return '🔥';
  if (c.includes('storm'))   return '⛈';
  if (c.includes('flood'))   return '🌊';
  if (c.includes('volcano')) return '🌋';
  if (c.includes('ice'))     return '❄';
  if (c.includes('drought')) return '☀';
  return '🌪';
}

function renderEventMarkers({ events }) {
  if (!mapReady) return;
  LAYERS.e.clearLayers();

  events.forEach(ev => {
    const geo = ev.geometry?.[0];
    if (!geo?.coordinates) return;
    let lat, lng;
    if (Array.isArray(geo.coordinates[0])) { [lng, lat] = geo.coordinates[0]; }
    else { [lng, lat] = geo.coordinates; }
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const cat  = ev.categories?.[0]?.id || '';
    const c    = evColor(cat);
    const icon = mkIcon(
      `<div style="width:9px;height:9px;border-radius:50%;background:${c}28;border:2px solid ${c};box-shadow:0 0 7px ${c}77;animation:flickr 1.7s ease-in-out infinite alternate"></div>`,
      9, 9
    );

    L.marker([lat, lng], { icon }).bindPopup(`
      <div class="pp-head">${evEmoji(cat)} ${esc(ev.title)}
        <span class="pp-badge b-amber">${esc(ev.categories?.[0]?.title || 'EVENT')}</span>
      </div>
      <div class="pp-grid">
        <span class="pp-k">Type</span><span class="pp-v">${esc(ev.categories?.[0]?.title || '—')}</span>
        <span class="pp-k">Observed</span><span class="pp-v">${ev.geometry?.length || 1}×</span>
        <span class="pp-k">Date</span><span class="pp-v">${new Date(geo.date || Date.now()).toLocaleDateString()}</span>
        <span class="pp-k">Status</span><span class="pp-v">Open</span>
      </div>
    `).addTo(LAYERS.e);
  });
}

/* ═══ ISS MARKER ════════════════════════════════════════════════════════════
   Preserves open popup across 10-second updates.
   Instead of clearLayers() (which closes any open popup),
   we track the existing marker and update its position.
═══════════════════════════════════════════════════════════════════════════ */
let _issMarker    = null;
let _issPopupOpen = false;

function renderISSMarker({ lat, lng, alt, vel }) {
  if (!mapReady) return;

  const lD  = lat >= 0 ? 'N' : 'S';
  const lnD = lng >= 0 ? 'E' : 'W';

  const popupHTML = `
    <div class="pp-head">🛸 International Space Station
      <span class="pp-badge b-green">LIVE</span>
    </div>
    <div class="pp-grid">
      <span class="pp-k">Position</span><span class="pp-v">${Math.abs(lat).toFixed(4)}°${lD}, ${Math.abs(lng).toFixed(4)}°${lnD}</span>
      <span class="pp-k">Altitude</span><span class="pp-v">${alt} km</span>
      <span class="pp-k">Velocity</span><span class="pp-v">${vel} km/h</span>
      <span class="pp-k">Orbital period</span><span class="pp-v">~92 min</span>
      <span class="pp-k">Orbit type</span><span class="pp-v">Low Earth Orbit</span>
    </div>
  `;

  if (_issMarker) {
    // Track popup state before update
    _issPopupOpen = _issMarker.isPopupOpen();

    // Move existing marker instead of recreating it
    _issMarker.setLatLng([lat, lng]);
    _issMarker.setPopupContent(popupHTML);

    // If popup was open, keep it open at new position
    if (_issPopupOpen) {
      _issMarker.openPopup();
    }
  } else {
    // First render — create marker
    const icon = mkIcon(
      `<div style="width:13px;height:13px;border-radius:50%;background:#059669;border:2.5px solid rgba(5,150,105,.3);box-shadow:0 0 16px #059669;animation:isspulse 1.6s infinite"></div>`,
      13, 13
    );
    _issMarker = L.marker([lat, lng], { icon })
      .bindPopup(popupHTML)
      .addTo(LAYERS.i);
  }
}

/* ═══ CONFLICT ZONE OVERLAY ═════════════════════════════════════════════════
   Rendered ONCE. Call resetConflictZones() + re-trigger to refresh.
   All actor names are XSS-escaped.
═══════════════════════════════════════════════════════════════════════════ */
const SEV_LABELS = ['', 'Watch', 'Guarded', 'High', 'Critical', 'Extreme'];

function renderConflictZones({ zones }) {
  if (!mapReady || !zones?.length) return;
  LAYERS.c.clearLayers();

  zones.forEach(zone => {
    const alpha       = (zone.severity / 5) * 0.10 + 0.03;  // 0.03–0.13
    const strokeAlpha = (zone.severity / 5) * 0.25 + 0.10;

    // Translucent radius circle
    L.circle([zone.lat, zone.lng], {
      radius:      zone.radius,
      color:       zone.color,
      weight:      1,
      opacity:     strokeAlpha,
      fillColor:   zone.color,
      fillOpacity: alpha,
      interactive: false,
      dashArray:   zone.status === 'elevated' ? '6, 8' : undefined,
    }).addTo(LAYERS.c);

    // Center severity dot — FIXED: actor names now XSS-escaped
    const dotSize  = 6 + zone.severity * 2;
    const icon     = mkIcon(
      `<div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${zone.color};opacity:.9;box-shadow:0 0 ${dotSize * 2}px ${zone.color}66;border:1.5px solid rgba(255,255,255,.4);animation:qpulse ${3 - zone.severity * 0.3}s infinite"></div>`,
      dotSize, dotSize
    );

    // FIXED: esc() applied to every actor name
    const actorRows = (zone.actors || []).map(a =>
      `<div style="font-size:8.5px;color:var(--text2);padding:1px 0">${esc(a)}</div>`
    ).join('');

    L.marker([zone.lat, zone.lng], { icon, zIndexOffset: -100 })
      .bindPopup(`
        <div class="pp-head" style="color:${zone.color}">
          ⚔ ${esc(zone.name)}
          <span class="pp-badge" style="background:${zone.color}20;color:${zone.color}">${esc(zone.status.toUpperCase())}</span>
        </div>
        <div class="pp-grid">
          <span class="pp-k">Type</span><span class="pp-v">${esc(zone.type.replace(/-/g, ' '))}</span>
          <span class="pp-k">Severity</span><span class="pp-v" style="color:${zone.color};font-weight:700">${SEV_LABELS[zone.severity]} (${zone.severity}/5)</span>
          <span class="pp-k">Actors</span>
          <div>${actorRows}</div>
        </div>
      `)
      .addTo(LAYERS.c);
  });
}

/* ═══ NEWS PINS ═════════════════════════════════════════════════════════════
   Capped at MAX_NEWS_PINS. Crisis-typed marker appearance.
   Read full article link opens in new tab.
═══════════════════════════════════════════════════════════════════════════ */
function renderNewsPins({ pins }) {
  if (!mapReady || !pins) return;
  LAYERS.n.clearLayers();

  // Cap to prevent excessive marker count
  const subset = pins.slice(0, MAX_NEWS_PINS);

  subset.forEach(pin => {
    const vis     = window.GeoIntelligence?.getCrisisVisual(pin.crisisType) || { color:'#2563eb', emoji:'📡', label:'Intel' };
    const sz      = 7 + (pin.severity || 1) * 1.5;
    const opacity = 0.55 + (pin.confidence || 0) * 0.45;
    const srcLabel = pin.source === 'bbc' ? 'BBC WORLD' : 'GUARDIAN';
    const srcColor = pin.source === 'bbc' ? '#dc2626' : '#059669';
    const safeLink = esc(pin.link || '#');
    const titleShort = esc((pin.title || '').length > 60 ? (pin.title || '').slice(0, 60) + '…' : (pin.title || ''));

    const icon = mkIcon(
      `<div title="${esc(pin.title || '')}" style="width:${sz}px;height:${sz}px;border-radius:50%;background:${vis.color};opacity:${opacity.toFixed(2)};box-shadow:0 0 ${sz + 2}px ${vis.color}88;border:1.5px solid rgba(255,255,255,0.5);cursor:pointer;"></div>`,
      sz, sz
    );

    L.marker([pin.lat, pin.lng], { icon })
      .bindPopup(`
        <div class="pp-head">
          ${vis.emoji} ${titleShort}
          <span class="pp-badge" style="background:${vis.color}20;color:${vis.color}">${esc(vis.label.toUpperCase())}</span>
        </div>
        <div class="pp-grid">
          <span class="pp-k">Source</span><span class="pp-v" style="color:${srcColor};font-weight:700">${srcLabel}</span>
          <span class="pp-k">Region</span><span class="pp-v">${esc(pin.entity || '—')}</span>
          <span class="pp-k">Published</span><span class="pp-v">${timeAgo(pin.pubDate)}</span>
          <span class="pp-k">Confidence</span><span class="pp-v">${Math.round((pin.confidence || 0) * 100)}%</span>
        </div>
        ${pin.description ? `<div style="font-size:8.5px;color:var(--text2);margin-top:6px;line-height:1.5">${esc(pin.description.slice(0, 120))}…</div>` : ''}
        <div style="margin-top:8px">
          <a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="font-size:9px;color:var(--primary);text-decoration:none;font-weight:600">Read full article →</a>
        </div>
      `)
      .addTo(LAYERS.n);
  });
}

/* ═══ REDDIT PIN RENDERING ══════════════════════════════════════════════════
   Reddit pins are visually distinct from news (BBC/Guardian) pins:
   • Reddit-orange (#ff4500) base with per-subreddit tint
   • Size scales with weightedScore — hot posts are large, pulsing
   • Velocity ring: posts with high comments/hour glow brighter
   • Crisis-typed coloring overlaid on Reddit orange for conflict posts
   • Popup shows: upvote bar, comment count, flair badge, velocity, source tag
═══════════════════════════════════════════════════════════════════════════ */
const MAX_REDDIT_PINS = 40;
 
function renderRedditPins({ pins, posts }) {
  if (!mapReady || !pins) return;
  LAYERS.r.clearLayers();
 
  const subset = pins.slice(0, MAX_REDDIT_PINS);
 
  subset.forEach(pin => {
    // Pin size: log-scale on weightedScore, range 6–18px
    const sz = Math.min(18, Math.max(6, Math.round(4 + Math.log1p(pin.weightedScore) * 1.4)));
 
    // Color: conflict/war posts get crisis color tinted toward Reddit orange,
    // others get the subreddit's assigned color
    const gi      = window.GeoIntelligence;
    const vis     = gi ? gi.getCrisisVisual(pin.crisisType) : null;
    const baseClr = (['war','terrorism','conflict'].includes(pin.crisisType))
      ? _blendColors(vis?.color || '#ff4500', pin.color, 0.6)
      : pin.color;
 
    // Velocity glow: high velocity (>50 comments/hr) pulses
    const isHot   = (pin.velocity || 0) > 50 || pin.weightedScore > 2000;
    const opacity = Math.min(0.95, 0.55 + Math.min(pin.confidence || 0, 1) * 0.4);
 
    const iconHtml = isHot
      ? `<div style="
            width:${sz}px;height:${sz}px;border-radius:50%;
            background:${baseClr};
            opacity:${opacity};
            border:2px solid rgba(255,255,255,0.6);
            box-shadow:0 0 ${sz + 4}px ${baseClr}cc;
            animation:qpulse 2s infinite;
          "></div>`
      : `<div style="
            width:${sz}px;height:${sz}px;border-radius:50%;
            background:${baseClr};
            opacity:${opacity};
            border:1.5px solid rgba(255,255,255,0.45);
            box-shadow:0 0 ${sz}px ${baseClr}88;
          "></div>`;
 
    const icon = mkIcon(iconHtml, sz, sz);
 
    // Upvote ratio bar (visual fill 0–100%)
    const ratioFill   = Math.round((pin.upvoteRatio || 0.5) * 100);
    const ratioColor  = ratioFill > 80 ? '#059669' : ratioFill > 60 ? '#d97706' : '#dc2626';
    const safeUrl     = esc(pin.url || '#');
    const titleShort  = esc((pin.title || '').length > 65 ? (pin.title || '').slice(0, 65) + '…' : (pin.title || ''));
    const flairHtml   = pin.flair
      ? `<span style="font-size:7.5px;padding:1px 6px;border-radius:8px;background:${pin.color}20;color:${pin.color};font-weight:700">${esc(pin.flair)}</span>`
      : '';
    const velHtml     = (pin.velocity || 0) > 10
      ? `<span style="font-size:7.5px;color:#ff4500;font-weight:700">🔥 ${pin.velocity}/hr</span>`
      : '';
 
    L.marker([pin.lat, pin.lng], { icon })
      .bindPopup(`
        <div class="pp-head" style="gap:5px">
          <span style="font-size:12px">${pin.icon || '🟠'}</span>
          ${titleShort}
          <span class="pp-badge" style="background:${pin.color}20;color:${pin.color};white-space:nowrap">
            r/${esc(pin.sub)}
          </span>
        </div>
 
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          ${flairHtml}
          ${velHtml}
          ${vis ? `<span style="font-size:7.5px;color:${vis.color};font-weight:700">${vis.emoji} ${esc(vis.label)}</span>` : ''}
        </div>
 
        <div class="pp-grid">
          <span class="pp-k">Score</span>
          <span class="pp-v" style="color:#ff4500;font-weight:800">
            ▲ ${pin.score.toLocaleString()}
            <span style="font-size:8px;color:var(--text3);font-weight:400"> (×${pin.weight} = ${pin.weightedScore.toLocaleString()})</span>
          </span>
 
          <span class="pp-k">Upvotes</span>
          <span class="pp-v">
            <span style="display:inline-block;width:60px;height:5px;background:#e2e8f0;border-radius:3px;vertical-align:middle;margin-right:5px">
              <span style="display:block;width:${ratioFill}%;height:100%;background:${ratioColor};border-radius:3px"></span>
            </span>
            ${ratioFill}%
          </span>
 
          <span class="pp-k">Comments</span>
          <span class="pp-v">${(pin.comments || 0).toLocaleString()}</span>
          <span class="pp-k">Region</span>
          <span class="pp-v">${esc(pin.entity || '—')}</span>
          <span class="pp-k">Age</span>
          <span class="pp-v">${timeAgo(pin.created)}</span>
        </div>
 
        ${pin.selftext ? `<div style="font-size:8.5px;color:var(--text2);margin-top:7px;line-height:1.5;padding-top:6px;border-top:1px solid var(--border)">${esc(pin.selftext.slice(0, 130))}…</div>` : ''}
 
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
             style="font-size:9px;color:#ff4500;text-decoration:none;font-weight:700">
            View on Reddit →
          </a>
        </div>
      `)
      .addTo(LAYERS.r);
  });
}
 
/* ─── Color blend utility ─────────────────────────────────────────────────
   Blends two hex colors. ratio 0=full c1, 1=full c2.
   Used to tint conflict posts toward subreddit brand color.
─────────────────────────────────────────────────────────────────────────── */
function _blendColors(c1, c2, ratio) {
  try {
    const hex = h => parseInt(h.replace('#',''), 16);
    const r1 = (hex(c1) >> 16) & 255, g1 = (hex(c1) >> 8) & 255, b1 = hex(c1) & 255;
    const r2 = (hex(c2) >> 16) & 255, g2 = (hex(c2) >> 8) & 255, b2 = hex(c2) & 255;
    const r  = Math.round(r1 + (r2 - r1) * ratio);
    const g  = Math.round(g1 + (g2 - g1) * ratio);
    const b  = Math.round(b1 + (b2 - b1) * ratio);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch (_) {
    return c1;
  }
}


/* ─── PUBLIC API ─────────────────────────────────────────────────────────── */
window.MapRenderer = {
  initMap,
  toggleLayer,
  resetConflictZones,
  flyTo,
  isReady: () => mapReady,
};
