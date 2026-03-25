'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · UI CONTROLLER v4
   ─────────────────────────────────────────────────────────────────────────
   Responsibilities:
   • All DOM manipulation — zero API fetch logic here
   • Subscribes to DataEngine events, renders panels
   • Crypto list + sparklines
   • Weather panel
   • Earthquake list
   • Earth events list
   • News feed + tabs
   • Geopolitical panel (replaces COVID panel)
   • Pulse bars + Threat ring
   • Ticker
   • Clock
   • Mobile nav
   • Loader dismiss
   • Dev card
═══════════════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

/* ─── LOADER ─────────────────────────────────────────────────────────────── */
const BOOT_START = Date.now();
const LOADER_MIN  = 1800;
let loaderGone    = false;
let loaderSigs    = 0;

function loaderSignal() {
  loaderSigs++;
  if (loaderSigs >= 2) _dismissLoader();
}

function _dismissLoader() {
  if (loaderGone) return;
  const delay = Math.max(0, LOADER_MIN - (Date.now() - BOOT_START));
  setTimeout(() => {
    loaderGone = true;
    const ld = $('loader');
    if (ld) { ld.classList.add('fade'); setTimeout(() => (ld.style.display = 'none'), 450); }
  }, delay);
}

window.addEventListener('bx:loader', () => loaderSignal());

/* ─── CLOCK ──────────────────────────────────────────────────────────────── */
function tick() {
  const n  = new Date();
  const p  = x => String(x).padStart(2, '0');
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DA = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const te = $('clockTime');
  const de = $('clockDate');
  if (te) te.textContent = `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())} UTC`;
  if (de) de.textContent = `${DA[n.getUTCDay()]} ${MO[n.getUTCMonth()]} ${n.getUTCDate()}, ${n.getUTCFullYear()}`;
}
setInterval(tick, 1000);
tick();

/* ─── MOBILE NAV ─────────────────────────────────────────────────────────── */
function mobTab(which, btn) {
  document.querySelectorAll('.mnb').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const lp = $('leftPanel'), rp = $('rightPanel');
  lp.classList.remove('mob-show');
  rp.classList.remove('mob-show');
  if (which === 'left')  { lp.classList.add('mob-show'); lp.scrollTop = 0; }
  if (which === 'right') { rp.classList.add('mob-show'); rp.scrollTop = 0; }
}
window.mobTab = mobTab;

/* ─── DEV CARD ───────────────────────────────────────────────────────────── */
let devOpen = false;
function toggleDev() {
  devOpen = !devOpen;
  $('devPanel')?.classList.toggle('open', devOpen);
  $('devBtn')?.classList.toggle('open', devOpen);
}
window.toggleDev = toggleDev;

document.addEventListener('click', e => {
  if (devOpen && !$('devPanel')?.contains(e.target) && e.target !== $('devBtn')) {
    devOpen = false;
    $('devPanel')?.classList.remove('open');
    $('devBtn')?.classList.remove('open');
  }
});

/* ─── UTILITY ────────────────────────────────────────────────────────────── */
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

function fmtPrice(n) {
  if (n >= 1000) return '$' + n.toLocaleString('en', { maximumFractionDigits: 0 });
  if (n >= 1)    return '$' + n.toFixed(2);
  return '$' + n.toFixed(4);
}

function flashEl(el) {
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

/* ─── SPARKLINES ─────────────────────────────────────────────────────────── */
function drawSparkline(canvasId, data, color) {
  const canvas = $(canvasId);
  if (!canvas || data.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = 52, H = 26;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const pad = 2;
  const xp = i => (i / (data.length - 1)) * W;
  const yp = v => H - pad - ((v - mn) / range) * (H - pad * 2);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + '38');
  grad.addColorStop(1, color + '00');

  ctx.beginPath();
  data.forEach((v, i) => i === 0 ? ctx.moveTo(xp(i), yp(v)) : ctx.lineTo(xp(i), yp(v)));
  ctx.lineTo(xp(data.length - 1), H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  data.forEach((v, i) => i === 0 ? ctx.moveTo(xp(i), yp(v)) : ctx.lineTo(xp(i), yp(v)));
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1.6;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();

  const lx = xp(data.length - 1), ly = yp(data[data.length - 1]);
  ctx.beginPath();
  ctx.arc(lx, ly, 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function simulateSparkline(price, changePct, points = 28) {
  let seed = Math.abs(Math.round(price * 100)) || 42;
  const lcg = () => { seed = (1664525 * seed + 1013904223) & 0xffffffff; return seed / 0xffffffff; };
  const start = price / (1 + changePct / 100) || price;
  const pts = [start];
  const vol = Math.abs(changePct) / 100 * 0.3 + 0.003;
  for (let i = 1; i < points; i++) {
    const drift = (changePct / 100) / (points - 1);
    const noise = (lcg() - 0.5) * 2 * vol * pts[i - 1];
    pts.push(Math.max(0.000001, pts[i - 1] * (1 + drift) + noise));
  }
  return pts;
}

/* ─── CRYPTO PANEL ───────────────────────────────────────────────────────── */
window.addEventListener('bx:crypto', e => {
  const { coins } = e.detail;
  Object.entries(coins).forEach(([fsym, coin]) => {
    const pEl = $('p' + fsym);
    const cEl = $('c' + fsym);
    if (pEl) { pEl.textContent = fmtPrice(coin.price); flashEl(pEl); }
    if (cEl) {
      cEl.textContent  = (coin.changePct >= 0 ? '+' : '') + coin.changePct.toFixed(2) + '%';
      cEl.className    = 'cr-chg ' + (coin.changePct >= 0 ? 'up' : 'down');
    }
    // Simulated sparkline until real histoday arrives
    drawSparkline('spk' + fsym, simulateSparkline(coin.price, coin.changePct), coin.color);
  });
});

window.addEventListener('bx:cryptoSparkline', e => {
  const { fsym, closes } = e.detail;
  const defs = window.DataEngine?.COIN_DEFS || [];
  const def  = defs.find(d => d.fsym === fsym);
  if (def && closes.length > 2) drawSparkline('spk' + fsym, closes, def.color);
});

/* ─── WEATHER PANEL ──────────────────────────────────────────────────────── */
const WX_CODES = { 0:'☀️', 1:'🌤', 2:'⛅', 3:'☁️', 45:'🌫', 48:'🌫', 51:'🌦', 53:'🌦', 55:'🌧', 61:'🌧', 63:'🌧', 65:'🌨', 71:'❄️', 73:'❄️', 75:'❄️', 77:'🌨', 80:'🌦', 81:'🌧', 82:'⛈', 85:'❄️', 86:'❄️', 95:'⛈', 96:'⛈', 99:'⛈' };
function wxIcon(code) { return WX_CODES[code] || '🌡'; }
function tempColor(t) {
  if (t > 35) return 'var(--red)';
  if (t > 28) return 'var(--amber)';
  if (t < 0)  return 'var(--sky)';
  return 'var(--text)';
}

window.addEventListener('bx:weather', e => {
  const { cities } = e.detail;
  const el = $('wxPanel');
  if (!el) return;
  el.innerHTML = cities.map(c => {
    if (c.error) return `<div class="wx"><div class="wx-ic">—</div><div class="wx-city">${esc(c.name)}</div><div class="wx-temp" style="color:var(--text3)">—</div></div>`;
    return `<div class="wx" onclick="MapRenderer.flyTo(${c.lat},${c.lon},6)" tabindex="0" role="button" aria-label="${esc(c.name)} weather">
      <div class="wx-ic">${wxIcon(c.code)}</div>
      <div class="wx-city">${esc(c.name)}</div>
      <div class="wx-wind">${c.wind !== undefined ? c.wind.toFixed(0) + ' km/h' : ''}</div>
      <div class="wx-temp" style="color:${tempColor(c.temp)}">${c.temp !== undefined ? c.temp.toFixed(0) + '°C' : '—'}</div>
    </div>`;
  }).join('');
});

/* ─── EARTHQUAKES PANEL ──────────────────────────────────────────────────── */
function qColor(mag) {
  if (mag >= 7.5) return '#7f1d1d';
  if (mag >= 7)   return '#dc2626';
  if (mag >= 6)   return '#ea580c';
  if (mag >= 5)   return '#d97706';
  return '#ca8a04';
}

window.addEventListener('bx:quakes', e => {
  const { features, count, m5count, score } = e.detail;

  // Header pills
  const pq = $('pQCount'); if (pq) pq.textContent = count;
  const msq = $('msQ'); if (msq) msq.textContent = count;

  // List — top 12 by magnitude
  const el = $('quakeList');
  if (!el) return;
  const top = [...features].sort((a, b) => b.properties.mag - a.properties.mag).slice(0, 12);
  el.innerHTML = top.map(f => {
    const m  = f.properties.mag || 0;
    const p  = f.properties.place || 'Unknown';
    const t  = new Date(f.properties.time);
    const c  = qColor(m);
    const [lng, lat] = f.geometry.coordinates;
    const bg = m >= 7 ? 'var(--red-l)' : m >= 6 ? 'var(--orange-l)' : 'var(--surface2)';
    return `<div class="ev" onclick="MapRenderer.flyTo(${lat},${lng},5)" tabindex="0" role="button">
      <div class="ev-badge" style="background:${bg};color:${c}">M${m.toFixed(1)}</div>
      <div class="ev-body">
        <div class="ev-name">${esc(p.length > 42 ? p.slice(0, 42) + '…' : p)}</div>
        <div class="ev-meta">${timeAgo(t)}</div>
      </div>
    </div>`;
  }).join('');
});

/* ─── EARTH EVENTS PANEL ─────────────────────────────────────────────────── */
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

window.addEventListener('bx:events', e => {
  const { events, count } = e.detail;
  const pe = $('pECount'); if (pe) pe.textContent = count;
  const mse = $('msE'); if (mse) mse.textContent = count;

  const el = $('earthList');
  if (!el) return;
  el.innerHTML = events.slice(0, 14).map(ev => {
    const cat = ev.categories?.[0]?.id || '';
    const c   = evColor(cat), em = evEmoji(cat);
    const geo = ev.geometry?.[0];
    const isP = geo?.coordinates && !Array.isArray(geo.coordinates[0]);
    const lat = isP ? geo.coordinates[1] : null;
    const lng = isP ? geo.coordinates[0] : null;
    const clickAttr = lat !== null
      ? `onclick="MapRenderer.flyTo(${lat},${lng},5)" tabindex="0" role="button"`
      : '';
    return `<div class="ev" ${clickAttr}>
      <div class="ev-badge" style="background:${c}18;color:${c};font-size:15px;padding:0;min-width:28px">${em}</div>
      <div class="ev-body">
        <div class="ev-name">${esc(ev.title.length > 44 ? ev.title.slice(0, 44) + '…' : ev.title)}</div>
        <div class="ev-meta">${esc(ev.categories?.[0]?.title || 'Event')} · ${ev.geometry?.length || 1} obs.</div>
      </div>
    </div>`;
  }).join('');
});

/* ─── NEWS PANEL ─────────────────────────────────────────────────────────── */
let _newsBBC = [], _newsGuardian = [], _currentTab = 'bbc';

window.addEventListener('bx:news', e => {
  const { bbc, guardian, pins, total, error } = e.detail;
  if (bbc)      _newsBBC      = bbc;
  if (guardian) _newsGuardian = guardian;

  const pnc = $('pNCount'); if (pnc) pnc.textContent = total || 0;
  const msn = $('msN'); if (msn) msn.textContent = total || 0;
  const msp = $('msPins'); if (msp) msp.textContent = pins?.length || 0;

  if (error && !total) {
    const nf = $('newsFeed');
    if (nf) nf.innerHTML = '<div class="err">News proxies unreachable — retrying in 10 min</div>';
    return;
  }

  renderNewsTab(_currentTab);
});

function renderNewsTab(tab) {
  _currentTab = tab;
  const items = tab === 'bbc' ? _newsBBC : _newsGuardian;
  const src   = tab === 'bbc'
    ? { label: 'BBC WORLD', color: '#dc2626' }
    : { label: 'GUARDIAN',  color: '#059669' };

  const el = $('newsFeed');
  if (!el) return;

  if (!items.length) {
    el.innerHTML = '<div class="empty">Awaiting data for this feed…</div>';
    return;
  }

  el.innerHTML = items.slice(0, 16).map(item => {
    const safeLink = esc(item.link || '#');
    const pinGeo   = window.GeoIntelligence?.resolveNewsGeo(item.title, item.description);
    const vis      = pinGeo ? window.GeoIntelligence.getCrisisVisual(pinGeo.crisisType) : null;

    const geoTag = pinGeo
      ? `<span style="font-size:7.5px;font-weight:700;color:${vis.color};margin-left:5px">
           ${vis.emoji} ${esc(pinGeo.entity?.toUpperCase() || '')}
         </span>`
      : '';

    // Map pin button — flies map to that item
    const mapBtn = pinGeo
      ? `<button class="ni-map-btn" onclick="MapRenderer.flyTo(${pinGeo.lat},${pinGeo.lng},5);event.stopPropagation()"
                title="Locate on map" aria-label="Fly to on map">📍</button>`
      : '';

    return `<div class="ni" onclick="window.open('${safeLink}','_blank','noopener,noreferrer')"
              tabindex="0" role="button" aria-label="${esc(item.title)}">
      <div class="ni-src" style="color:${src.color}">${src.label}${geoTag}</div>
      <div class="ni-title-row">
        <div class="ni-title">${esc(item.title)}</div>
        ${mapBtn}
      </div>
      <div class="ni-time">${timeAgo(new Date(item.pubDate))}</div>
    </div>`;
  }).join('');
}

function showNewsTab(tab, btn) {
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('on'));
  btn.classList.add('on');
  renderNewsTab(tab);
}
window.showNewsTab = showNewsTab;

/* ─── GEOPOLITICAL PANEL (replaces COVID) ────────────────────────────────── */
window.addEventListener('bx:geopolitical', e => {
  const { score, zones, pins } = e.detail;

  // Stat cells
  const activeZones   = zones.filter(z => z.status === 'active');
  const elevatedZones = zones.filter(z => z.status === 'elevated');
  const warPins       = pins.filter(p => ['war','terrorism','conflict'].includes(p.crisisType));
  const cyberPins     = pins.filter(p => p.crisisType === 'cyber');

  const el1 = $('geoActive'); if (el1) el1.textContent = activeZones.length;
  const el2 = $('geoElevated'); if (el2) el2.textContent = elevatedZones.length;
  const el3 = $('geoWarNews'); if (el3) el3.textContent = warPins.length;
  const el4 = $('geoScore'); if (el4) {
    el4.textContent = score;
    el4.style.color = score > 70 ? 'var(--red)' : score > 40 ? 'var(--amber)' : 'var(--sky)';
  }

  // Mini crisis list
  const listEl = $('geoConflictList');
  if (listEl) {
    const top = [...zones].sort((a, b) => b.severity - a.severity).slice(0, 5);
    const sevColors = ['', '#94a3b8', '#d97706', '#ea580c', '#dc2626', '#7f1d1d'];
    listEl.innerHTML = top.map(z => `
      <div class="geo-ev">
        <div class="geo-sev-dot" style="background:${sevColors[z.severity] || '#94a3b8'}"></div>
        <div class="geo-ev-name">${esc(z.name)}</div>
        <div class="geo-ev-type">${esc(z.type.replace(/-/g, ' '))}</div>
      </div>
    `).join('');
  }
});

/* ─── ISS PANEL ──────────────────────────────────────────────────────────── */
window.addEventListener('bx:iss', e => {
  const { lat, lng, alt, vel } = e.detail;
  const lD  = lat >= 0 ? 'N' : 'S';
  const lnD = lng >= 0 ? 'E' : 'W';
  const coords = $('issCoords');
  const sub    = $('issSub');
  if (coords) coords.textContent = `${Math.abs(lat).toFixed(2)}° ${lD}  ${Math.abs(lng).toFixed(2)}° ${lnD}`;
  if (sub)    sub.textContent    = `Alt: ${alt} km · Vel: ${vel} km/h`;
});

/* ─── PULSE BARS ─────────────────────────────────────────────────────────── */
function setPulse(barId, valId, pct, label) {
  const bar = $(barId), val = $(valId);
  if (!bar || !val) return;
  const clr = pct < 30 ? 'var(--green)' : pct < 60 ? 'var(--amber)' : 'var(--red)';
  bar.style.width      = pct + '%';
  bar.style.background = clr;
  val.textContent      = label;
  val.style.color      = clr;
}

window.addEventListener('bx:pulse', e => {
  const { seismic, events, market, geopolitical } = e.detail;

  setPulse('seisBar', 'seisVal', seismic,
    seismic < 30 ? 'Low' : seismic < 60 ? 'Moderate' : 'Elevated');

  setPulse('evBar', 'evVal', events,
    events < 30 ? 'Normal' : events < 60 ? 'Active' : 'Elevated');

  setPulse('mktBar', 'mktVal', market,
    market < 30 ? 'Calm' : market < 60 ? 'Active' : 'Volatile');

  setPulse('geoBar', 'geoVal', geopolitical,
    geopolitical < 20 ? 'Stable' : geopolitical < 45 ? 'Tense' : geopolitical < 70 ? 'Volatile' : 'Critical');

  // Factor row
  const tfQ = $('tfQ'), tfE = $('tfE'), tfM = $('tfM'), tfG = $('tfGeo');
  if (tfQ) tfQ.textContent = (window.DataEngine?.getState().quakes.filter(f => (f.properties?.mag||0)>=5).length || '—') + ' events';
  if (tfE) tfE.textContent = (window.DataEngine?.getState().events.length || '—') + ' open';
  if (tfM) tfM.textContent = market.toFixed(0) + '% vol.';
  if (tfG) tfG.textContent = geopolitical + '/100';

  // Threat ring — composite of all 4 dimensions
  const composite = Math.min(100, Math.round(seismic * 0.20 + events * 0.15 + market * 0.15 + geopolitical * 0.50));
  _drawThreatRing(composite);
  _updateThreatChip(composite);
});

/* ─── THREAT RING ────────────────────────────────────────────────────────── */
function _drawThreatRing(score) {
  let status, desc, color;
  if      (score < 15) { status = 'NOMINAL';   desc = 'Global conditions stable';          color = '#059669'; }
  else if (score < 30) { status = 'GUARDED';   desc = 'Minor elevated indicators';         color = '#0284c7'; }
  else if (score < 50) { status = 'ELEVATED';  desc = 'Multiple active concerns';          color = '#d97706'; }
  else if (score < 70) { status = 'HIGH';      desc = 'Significant geopolitical activity'; color = '#ea580c'; }
  else                 { status = 'CRITICAL';  desc = 'Extreme multi-domain tensions';     color = '#dc2626'; }

  const c = $('threatRing');
  if (c) {
    const dpr = window.devicePixelRatio || 1;
    c.width  = 60 * dpr;
    c.height = 60 * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = 30, cy = 30, r = 23, lw = 4.5;
    ctx.clearRect(0, 0, 60, 60);
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth   = lw;
    ctx.stroke();
    if (score > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (score / 100));
      ctx.strokeStyle = color;
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
  }

  const num    = $('threatNum');
  const status_ = $('threatStatus');
  const desc_   = $('threatDesc');
  if (num)    { num.textContent = score; num.style.color = color; }
  if (status_) { status_.textContent = status; status_.style.color = color; }
  if (desc_)   desc_.textContent = desc;
}

function _updateThreatChip(score) {
  const colors = { 15: '#059669', 30: '#0284c7', 50: '#d97706', 70: '#ea580c', 101: '#dc2626' };
  const labels = { 15: 'NOMINAL', 30: 'GUARDED', 50: 'ELEVATED', 70: 'HIGH', 101: 'CRITICAL' };
  let color = '#dc2626', label = 'CRITICAL';
  for (const [threshold, c] of Object.entries(colors)) {
    if (score < Number(threshold)) { color = c; label = labels[threshold]; break; }
  }
  const chip  = $('threatChip');
  const dot   = $('threatDot');
  const lbl   = $('threatLabel');
  if (chip) chip.style.borderColor = color + '44';
  if (dot)  dot.style.background   = color;
  if (lbl)  { lbl.textContent = label; lbl.style.color = color; }
}

/* ─── TICKER ─────────────────────────────────────────────────────────────── */
window.addEventListener('bx:ticker', e => {
  const { items } = e.detail;
  if (!items?.length) return;
  const inner = $('tkrInner');
  if (!inner) return;
  const half  = items.map(i => `<div class="tkr-item">${esc(i)}</div>`).join('');
  inner.innerHTML = half + half;
});

/* ─── TOOLBAR WIRING ─────────────────────────────────────────────────────── */
window.toggleLayer = function(key, btn) {
  window.MapRenderer?.toggleLayer(key, btn);
};
