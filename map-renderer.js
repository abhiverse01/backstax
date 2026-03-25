'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · MAP RENDERER v4
   ─────────────────────────────────────────────────────────────────────────
   Responsibilities:
   • Leaflet map initialization
   • Layer management (quakes, events, ISS, news, conflict zones)
   • News pin rendering: ALL news items → precise crisis-typed markers
   • Conflict zone overlay circles with severity-scaled opacity
   • Popup templates for every marker type
   • Layer toggle system
   • flyTo utility
═══════════════════════════════════════════════════════════════════════════ */

let MAP = null;
let mapReady = false;

/* ─── LAYER REGISTRY ─────────────────────────────────────────────────────── */
const LAYERS = {
  q: null,  // Earthquakes
  e: null,  // EONET events
  i: null,  // ISS
  n: null,  // News pins
  c: null,  // Conflict zones (base overlay — always shown)
};

const LAYER_STATE = { q: true, e: true, i: true, n: true, c: true };

/* ─── INIT ───────────────────────────────────────────────────────────────── */
function initMap() {
  MAP = L.map('map', {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true,
    preferCanvas: true, // Better perf for many markers
  });

  // Carto light tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '© <a href="https://carto.com">CARTO</a> · © <a href="https://openstreetmap.org">OSM</a>',
  }).addTo(MAP);

  // Subtle equator/meridian reference lines
  L.polyline([[0, -180], [0, 180]],   { color: 'rgba(37,99,235,.05)', weight: 1, dashArray: '6,14', interactive: false }).addTo(MAP);
  L.polyline([[-90, 0], [90, 0]],    { color: 'rgba(37,99,235,.05)', weight: 1, dashArray: '6,14', interactive: false }).addTo(MAP);

  // Initialize all layer groups
  Object.keys(LAYERS).forEach(k => {
    LAYERS[k] = L.layerGroup().addTo(MAP);
  });

  mapReady = true;

  // Subscribe to data events
  window.addEventListener('bx:quakes',       e => renderQuakeMarkers(e.detail));
  window.addEventListener('bx:events',       e => renderEventMarkers(e.detail));
  window.addEventListener('bx:iss',          e => renderISSMarker(e.detail));
  window.addEventListener('bx:news',         e => renderNewsPins(e.detail));
  window.addEventListener('bx:geopolitical', e => renderConflictZones(e.detail));
}

/* ─── LAYER TOGGLE ───────────────────────────────────────────────────────── */
function toggleLayer(key, btn) {
  const ly = LAYERS[key];
  if (!ly || !MAP) return;
  LAYER_STATE[key] = !LAYER_STATE[key];
  btn.classList.toggle('on', LAYER_STATE[key]);
  if (LAYER_STATE[key]) ly.addTo(MAP);
  else MAP.removeLayer(ly);
}

/* ─── FLY TO ─────────────────────────────────────────────────────────────── */
function flyTo(lat, lng, zoom = 5) {
  if (!mapReady || !MAP) return;
  MAP.flyTo([lat, lng], zoom, { duration: 1.6, easeLinearity: 0.4 });
}

/* ─── ICON FACTORY ───────────────────────────────────────────────────────── */
function mkIcon(html, w, h) {
  return L.divIcon({ className: '', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
}

/* ─── HTML ESCAPE ────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
      `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c}1a;border:2px solid ${c};
       box-shadow:0 0 ${sz}px ${c}44;animation:qpulse 2.6s infinite"></div>`,
      sz, sz
    );

    L.marker([lat, lng], { icon }).bindPopup(`
      <div class="pp-head">⚡ M${mag.toFixed(1)} Earthquake<span class="pp-badge b-red">SEISMIC</span></div>
      <div class="pp-grid">
        <span class="pp-k">Location</span><span class="pp-v">${esc(place)}</span>
        <span class="pp-k">Depth</span><span class="pp-v">${dep.toFixed(0)} km</span>
        <span class="pp-k">Time</span><span class="pp-v">${timeAgo(time)}</span>
        <span class="pp-k">Coords</span><span class="pp-v">${lat.toFixed(2)}°, ${lng.toFixed(2)}°</span>
      </div>
    `).addTo(LAYERS.q);
  });
}

/* ═══ EONET EVENT MARKERS ═══════════════════════════════════════════════════ */
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

    const cat = ev.categories?.[0]?.id || '';
    const c   = evColor(cat);
    const icon = mkIcon(
      `<div style="width:9px;height:9px;border-radius:50%;background:${c}28;border:2px solid ${c};
       box-shadow:0 0 7px ${c}77;animation:flickr 1.7s ease-in-out infinite alternate"></div>`,
      9, 9
    );

    L.marker([lat, lng], { icon }).bindPopup(`
      <div class="pp-head">${evEmoji(cat)} ${esc(ev.title)}<span class="pp-badge b-amber">${esc(ev.categories?.[0]?.title || 'EVENT')}</span></div>
      <div class="pp-grid">
        <span class="pp-k">Type</span><span class="pp-v">${esc(ev.categories?.[0]?.title || '—')}</span>
        <span class="pp-k">Observations</span><span class="pp-v">${ev.geometry?.length || 1}</span>
        <span class="pp-k">Date</span><span class="pp-v">${new Date(geo.date || Date.now()).toLocaleDateString()}</span>
        <span class="pp-k">Status</span><span class="pp-v">Open</span>
      </div>
    `).addTo(LAYERS.e);
  });
}

/* ═══ ISS MARKER ════════════════════════════════════════════════════════════ */
function renderISSMarker({ lat, lng, alt, vel }) {
  if (!mapReady) return;
  LAYERS.i.clearLayers();

  const lD  = lat >= 0 ? 'N' : 'S';
  const lnD = lng >= 0 ? 'E' : 'W';

  const icon = mkIcon(
    `<div style="width:13px;height:13px;border-radius:50%;background:#059669;border:2.5px solid rgba(5,150,105,.3);
     box-shadow:0 0 16px #059669;animation:isspulse 1.6s infinite"></div>`,
    13, 13
  );

  L.marker([lat, lng], { icon }).bindPopup(`
    <div class="pp-head">🛸 International Space Station<span class="pp-badge b-green">LIVE</span></div>
    <div class="pp-grid">
      <span class="pp-k">Position</span><span class="pp-v">${Math.abs(lat).toFixed(4)}°${lD}, ${Math.abs(lng).toFixed(4)}°${lnD}</span>
      <span class="pp-k">Altitude</span><span class="pp-v">${alt} km</span>
      <span class="pp-k">Velocity</span><span class="pp-v">${vel} km/h</span>
      <span class="pp-k">Orbital period</span><span class="pp-v">~92 min</span>
      <span class="pp-k">Altitude band</span><span class="pp-v">Low Earth Orbit</span>
    </div>
  `).addTo(LAYERS.i);
}

/* ═══ CONFLICT ZONE OVERLAY ═════════════════════════════════════════════════
   Severity-scaled translucent circles with center markers.
   Always displayed (layer c), cannot be hidden by toolbar.
═══════════════════════════════════════════════════════════════════════════ */
const SEV_LABELS = ['', 'Watch', 'Elevated', 'High', 'Critical', 'Extreme'];

function renderConflictZones({ zones }) {
  if (!mapReady || !zones?.length) return;
  LAYERS.c.clearLayers();

  zones.forEach(zone => {
    const alpha = (zone.severity / 5) * 0.10 + 0.03; // 0.03 – 0.13
    const strokeAlpha = (zone.severity / 5) * 0.25 + 0.10;

    // Radius circle
    L.circle([zone.lat, zone.lng], {
      radius: zone.radius,
      color: zone.color,
      weight: 1,
      opacity: strokeAlpha,
      fillColor: zone.color,
      fillOpacity: alpha,
      interactive: false,
      dashArray: zone.status === 'elevated' ? '6, 8' : undefined,
    }).addTo(LAYERS.c);

    // Center pin with severity dot
    const dotSize = 6 + zone.severity * 2;
    const icon = mkIcon(
      `<div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;
        background:${zone.color};opacity:0.9;
        box-shadow:0 0 ${dotSize * 2}px ${zone.color}66;
        border:1.5px solid rgba(255,255,255,0.4);
        animation:qpulse ${3 - zone.severity * 0.3}s infinite"></div>`,
      dotSize, dotSize
    );

    const actorList = zone.actors.map(a => `<span class="pp-v">${esc(a)}</span>`).join('<br>');
    L.marker([zone.lat, zone.lng], { icon, zIndexOffset: -100 }).bindPopup(`
      <div class="pp-head" style="color:${zone.color}">
        ⚔ ${esc(zone.name)}
        <span class="pp-badge" style="background:${zone.color}15;color:${zone.color}">${zone.status.toUpperCase()}</span>
      </div>
      <div class="pp-grid">
        <span class="pp-k">Type</span><span class="pp-v">${esc(zone.type.replace(/-/g,' '))}</span>
        <span class="pp-k">Severity</span><span class="pp-v" style="color:${zone.color}">${SEV_LABELS[zone.severity]} (${zone.severity}/5)</span>
        <span class="pp-k">Actors</span>
        <div>${actorList}</div>
      </div>
    `).addTo(LAYERS.c);
  });
}

/* ═══ NEWS PINS — ALL ITEMS ════════════════════════════════════════════════
   Every news article that can be geo-resolved gets a map pin.
   Pin appearance is driven by crisis type from GeoIntelligence.
   Overlapping pins are slightly jittered by the data engine.
═══════════════════════════════════════════════════════════════════════════ */
function renderNewsPins({ pins }) {
  if (!mapReady || !pins) return;
  LAYERS.n.clearLayers();

  pins.forEach(pin => {
    const vis = window.GeoIntelligence?.getCrisisVisual(pin.crisisType) || { color:'#2563eb', emoji:'📡', label:'Intel' };
    const sz  = 7 + (pin.severity || 1) * 1.5;
    const src = window.DataEngine?.getState();
    const srcLabel = pin.source === 'bbc' ? 'BBC WORLD' : 'GUARDIAN';
    const srcColor = pin.source === 'bbc' ? '#dc2626' : '#059669';

    const icon = mkIcon(
      `<div title="${esc(pin.title)}" style="
        width:${sz}px;height:${sz}px;border-radius:50%;
        background:${vis.color};
        opacity:${0.55 + pin.confidence * 0.45};
        box-shadow:0 0 ${sz + 2}px ${vis.color}88;
        border:1.5px solid rgba(255,255,255,0.5);
        cursor:pointer;
        transition:transform .15s;
      "></div>`,
      sz, sz
    );

    const safeLink = esc(pin.link || '#');
    const marker = L.marker([pin.lat, pin.lng], { icon });

    marker.bindPopup(`
      <div class="pp-head">
        ${vis.emoji} ${esc(pin.title.length > 60 ? pin.title.slice(0, 60) + '…' : pin.title)}
        <span class="pp-badge" style="background:${vis.color}15;color:${vis.color}">${vis.label.toUpperCase()}</span>
      </div>
      <div class="pp-grid">
        <span class="pp-k">Source</span><span class="pp-v" style="color:${srcColor}">${srcLabel}</span>
        <span class="pp-k">Region</span><span class="pp-v">${esc(pin.entity || '—')}</span>
        <span class="pp-k">Published</span><span class="pp-v">${timeAgo(pin.pubDate)}</span>
        <span class="pp-k">Confidence</span><span class="pp-v">${Math.round(pin.confidence * 100)}%</span>
      </div>
      ${pin.description ? `<div style="font-size:8.5px;color:var(--text2);margin-top:6px;line-height:1.5">${esc(pin.description.slice(0, 120))}…</div>` : ''}
      <div style="margin-top:8px">
        <a href="${safeLink}" target="_blank" rel="noopener noreferrer"
           style="font-size:9px;color:var(--primary);text-decoration:none;font-weight:600">
           Read full article →
        </a>
      </div>
    `);

    marker.addTo(LAYERS.n);
  });
}

/* ─── PUBLIC API ─────────────────────────────────────────────────────────── */
window.MapRenderer = {
  initMap,
  toggleLayer,
  flyTo,
  isReady: () => mapReady,
};
