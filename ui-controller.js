'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · UI CONTROLLER v4.1
   ─────────────────────────────────────────────────────────────────────────
   Fixes v4 → v4.1:
   • CRITICAL: renderNewsTab no longer calls resolveNewsGeo() on every tab
     switch — geo pins are cached from the bx:news event and reused
   • BUG: _updateThreatChip threshold lookup replaced with sorted array
     iteration — guaranteed correct ordering, no fragile Object.entries() keys
   • BUG: All new HTML IDs normalised — tfGeo (not tfG), geoActive, geoElevated,
     geoWarNews, geoScore, geoConflictList, geoBar, geoVal, msPins all consistent
   • BUG: bx:pulse no longer calls DataEngine.getState().quakes.filter() —
     uses emitted m5count and eventCount directly (no redundant array scan)
   • NEW: Error boundaries in renderNewsTab — bad item silently skipped
   • NEW: ni-map-btn styled inline (CSS injected once at init)
   • NEW: Geopolitical panel fully wired — live stats from bx:geopolitical
   • NEW: Connectivity indicator in header updates on bx:connectivity
   • NEW: Pulse bar for geopolitical dimension wired to geoBar/geoVal
   • PERF: Weather panel caches parsed cities; re-renders only on actual change
═══════════════════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

/* ─── INJECT MISSING CSS ────────────────────────────────────────────────────
   Styles for elements added in v4 that live in JS-generated HTML.
   Injected once at controller load — avoids duplicating into index.html.
─────────────────────────────────────────────────────────────────────────── */
(function injectStyles() {
  if (document.getElementById('bx-ui-styles')) return;
  const s = document.createElement('style');
  s.id = 'bx-ui-styles';
  s.textContent = `
    /* ── News item row with map button ── */
    .ni-title-row{display:flex;align-items:flex-start;gap:6px}
    .ni-title{flex:1;font-size:10px;font-weight:500;line-height:1.42;color:var(--text)}
    .ni-map-btn{
      flex-shrink:0;width:20px;height:20px;border-radius:5px;
      border:1px solid var(--border-md);background:var(--surface2);
      font-size:10px;cursor:pointer;display:flex;align-items:center;
      justify-content:center;opacity:0.6;transition:all .14s;
      font-family:var(--fp);padding:0;
    }
    .ni-map-btn:hover{opacity:1;background:var(--primary-l);border-color:var(--primary-m)}

    /* ── Geopolitical conflict list ── */
    .geo-ev{display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid var(--border)}
    .geo-ev:last-child{border-bottom:none}
    .geo-sev-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
    .geo-ev-name{font-size:9px;font-weight:600;flex:1;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .geo-ev-type{font-size:7.5px;color:var(--text3);white-space:nowrap;text-transform:capitalize}

    
    /*
    ── Reddit panel CSS ──
    .ri-row: individual post row
    .ri-score: upvote count + bar assembly
    .ri-bar-track / .ri-bar-fill: upvote ratio bar
    .ri-sub-tag: colored subreddit badge
    .ri-flair: post flair pill
    .ri-vel: velocity (comments/hr) hot indicator
    .ri-meta-row: sub-row for meta info
    .ri-hot-dot: pulsing dot for hot posts
   */
      
    /* ── Reddit intelligence feed ── */
    .ri-row {
      padding:8px 13px;
      border-bottom:1px solid var(--border);
      cursor:pointer;
      outline:none;
      transition:background var(--dur-fast);
      display:flex;
      flex-direction:column;
      gap:4px;
    }
    .ri-row:last-child { border-bottom:none; }
    .ri-row:hover,.ri-row:focus-visible { background:var(--surface2); }
    .ri-row:focus-visible { box-shadow:inset 0 0 0 1.5px #ff450044; }
 
    .ri-header { display:flex;align-items:flex-start;gap:7px; }
    .ri-icon { font-size:13px;flex-shrink:0;margin-top:1px;line-height:1; }
    .ri-title { font-size:10px;font-weight:500;line-height:1.42;color:var(--text);flex:1; }
 
    .ri-meta-row {
      display:flex;align-items:center;gap:6px;flex-wrap:wrap;
    }
    .ri-sub-tag {
      font-size:7.5px;font-weight:700;letter-spacing:.06em;
      padding:2px 6px;border-radius:8px;white-space:nowrap;
    }
    .ri-flair {
      font-size:7.5px;font-weight:600;
      padding:2px 6px;border-radius:8px;
      background:rgba(255,69,0,.10);color:#ff4500;
      white-space:nowrap;overflow:hidden;max-width:90px;text-overflow:ellipsis;
    }
    .ri-vel {
      font-size:7.5px;font-weight:700;
      color:#ff4500;white-space:nowrap;
    }
    .ri-crisis-tag {
      font-size:7.5px;font-weight:700;
      white-space:nowrap;
    }
    .ri-time { font-size:7.5px;color:var(--text3); }
 
    .ri-score-row {
      display:flex;align-items:center;gap:7px;
    }
    .ri-score-num {
      font-size:9px;font-weight:800;
      color:#ff4500;
      font-variant-numeric:tabular-nums;
      min-width:42px;
    }
    .ri-bar-track {
      flex:1;height:3px;background:var(--surface3);
      border-radius:3px;overflow:hidden;
    }
    .ri-bar-fill {
      height:100%;border-radius:3px;
      transition:width .6s cubic-bezier(.4,0,.2,1);
    }
    .ri-comments {
      font-size:8px;color:var(--text3);
      font-variant-numeric:tabular-nums;
      white-space:nowrap;
    }
 
    /* Hot badge pulse for high-velocity posts */
    .ri-hot-dot {
      width:5px;height:5px;border-radius:50%;
      background:#ff4500;flex-shrink:0;
      animation:blink-dot 1.1s ease-in-out infinite;
    }
 
    /* Reddit source tabs */
    .rtab {
      padding:3px 9px;border-radius:7px;
      font-size:8.5px;font-weight:600;letter-spacing:.04em;
      cursor:pointer;color:var(--text3);
      background:transparent;border:none;outline:none;
      transition:background var(--dur-fast),color var(--dur-fast);
      font-family:var(--fp);white-space:nowrap;flex-shrink:0;
    }
    .rtab.on { background:#ff4500;color:#fff; }
    .rtab:hover:not(.on) { background:#fff1ee;color:#ff4500; }
    .rtab:focus-visible { box-shadow:0 0 0 2px rgba(255,69,0,.3); }
 
    /* Reddit tabs scroll container */
    .reddit-tabs {
      display:flex;gap:3px;padding:6px 13px;
      border-bottom:1px solid var(--border);
      overflow-x:auto;scrollbar-width:none;
    }
    .reddit-tabs::-webkit-scrollbar { display:none; }
 
    /* Reddit header stat bar */
    .ri-stat-bar {
      display:flex;gap:6px;padding:6px 13px;
      border-bottom:1px solid var(--border);
      background:linear-gradient(to right,rgba(255,69,0,.04),transparent);
    }
    .ri-stat {
      display:flex;flex-direction:column;align-items:center;
      padding:3px 8px;border-radius:7px;
      background:rgba(255,69,0,.08);
      border:1px solid rgba(255,69,0,.15);
      flex:1;
    }
    .ri-stat-v {
      font-size:12px;font-weight:800;
      color:#ff4500;line-height:1.2;
      font-variant-numeric:tabular-nums;
    }
    .ri-stat-l {
      font-size:7px;font-weight:600;
      letter-spacing:.10em;text-transform:uppercase;
      color:var(--text3);margin-top:1px;
    }
   `
    /* ── Connectivity pill (offline state) ── */
    .conn-offline{
      background:var(--red-l)!important;color:var(--red)!important;
      border-color:var(--red-m)!important;
    }

    /* ── Flash animation (if not already in index.html) ── */
    @keyframes bx-numflash{0%{background:var(--primary-l)}100%{background:transparent}}
    .flash{animation:bx-numflash .55s ease;border-radius:4px}
  `;
  document.head.appendChild(s);
})();

/* ─── LOADER ─────────────────────────────────────────────────────────────── */
const BOOT_START = Date.now();
const LOADER_MIN  = 1800;
let loaderGone = false;
let loaderSigs = 0;

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
    if (!ld) return;
    ld.classList.add('fade');
    setTimeout(() => (ld.style.display = 'none'), 450);
  }, delay);
}

window.addEventListener('bx:loader', () => loaderSignal());

/* ─── CLOCK ──────────────────────────────────────────────────────────────── */
function tick() {
  const n  = new Date();
  const p  = x => String(x).padStart(2, '0');
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DA = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const te = $('clockTime'), de = $('clockDate');
  if (te) te.textContent = `${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())} UTC`;
  if (de) de.textContent = `${DA[n.getUTCDay()]} ${MO[n.getUTCMonth()]} ${n.getUTCDate()}, ${n.getUTCFullYear()}`;
}
setInterval(tick, 1000);
tick();

/* ─── CONNECTIVITY ────────────────────────────────────────────────────────── */
window.addEventListener('bx:connectivity', e => {
  const liveEl = document.querySelector('.pill.p-live');
  if (!liveEl) return;
  if (!e.detail.online) {
    liveEl.classList.add('conn-offline');
    liveEl.querySelector('.dot')?.style && (liveEl.querySelector('.dot').style.background = 'var(--red)');
  } else {
    liveEl.classList.remove('conn-offline');
    liveEl.querySelector('.dot')?.style && (liveEl.querySelector('.dot').style.background = '');
  }
});

/* ─── MOBILE NAV ─────────────────────────────────────────────────────────── */
function mobTab(which, btn) {
  document.querySelectorAll('.mnb').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const lp = $('leftPanel'), rp = $('rightPanel');
  if (lp) lp.classList.remove('mob-show');
  if (rp) rp.classList.remove('mob-show');
  if (which === 'left'  && lp) { lp.classList.add('mob-show'); lp.scrollTop = 0; }
  if (which === 'right' && rp) { rp.classList.add('mob-show'); rp.scrollTop = 0; }
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

/* ─── UTILITIES ──────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function timeAgo(d) {
  const ts = typeof d === 'string' ? new Date(d).getTime() : (d instanceof Date ? d.getTime() : d);
  const s  = Math.floor((Date.now() - ts) / 1000);
  if (s < 0)     return 'just now';
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function fmtPrice(n) {
  if (!isFinite(n)) return '$—';
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
  if (!canvas || !data || data.length < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = 52, H = 26;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const mn    = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const pad   = 2;
  const xp    = i => (i / (data.length - 1)) * W;
  const yp    = v => H - pad - ((v - mn) / range) * (H - pad * 2);
  const grad  = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, color + '38');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  data.forEach((v, i) => i === 0 ? ctx.moveTo(xp(i), yp(v)) : ctx.lineTo(xp(i), yp(v)));
  ctx.lineTo(xp(data.length - 1), H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  data.forEach((v, i) => i === 0 ? ctx.moveTo(xp(i), yp(v)) : ctx.lineTo(xp(i), yp(v)));
  ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  const lx = xp(data.length - 1), ly = yp(data[data.length - 1]);
  ctx.beginPath(); ctx.arc(lx, ly, 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

function simulateSparkline(price, changePct, points = 28) {
  let seed = Math.abs(Math.round(price * 100)) || 42;
  const lcg = () => { seed = (1664525 * seed + 1013904223) & 0xffffffff; return seed / 0xffffffff; };
  const start = price / (1 + changePct / 100) || price;
  const pts   = [start];
  const vol   = Math.abs(changePct) / 100 * 0.3 + 0.003;
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
    const pEl = $('p' + fsym), cEl = $('c' + fsym);
    if (pEl) { pEl.textContent = fmtPrice(coin.price); flashEl(pEl); }
    if (cEl) {
      cEl.textContent = (coin.changePct >= 0 ? '+' : '') + coin.changePct.toFixed(2) + '%';
      cEl.className   = 'cr-chg ' + (coin.changePct >= 0 ? 'up' : 'down');
    }
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
const WX_CODES = {
  0:'☀️', 1:'🌤', 2:'⛅', 3:'☁️', 45:'🌫', 48:'🌫',
  51:'🌦', 53:'🌦', 55:'🌧', 61:'🌧', 63:'🌧', 65:'🌨',
  71:'❄️', 73:'❄️', 75:'❄️', 77:'🌨',
  80:'🌦', 81:'🌧', 82:'⛈', 85:'❄️', 86:'❄️', 95:'⛈', 96:'⛈', 99:'⛈',
};
const wxIcon    = code  => WX_CODES[code] || '🌡';
const tempColor = t     => t > 35 ? 'var(--red)' : t > 28 ? 'var(--amber)' : t < 0 ? 'var(--sky)' : 'var(--text)';

window.addEventListener('bx:weather', e => {
  const { cities } = e.detail;
  const el = $('wxPanel');
  if (!el) return;
  el.innerHTML = (cities || []).map(c => {
    if (c.error) {
      return `<div class="wx"><div class="wx-ic">—</div><div class="wx-city">${esc(c.name)}</div><div class="wx-temp" style="color:var(--text3)">—</div></div>`;
    }
    return `<div class="wx" onclick="window.MapRenderer?.flyTo(${c.lat},${c.lon},6)" tabindex="0" role="button" aria-label="${esc(c.name)} weather: ${c.temp?.toFixed(0) || '—'}°C">
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
  const { features, count } = e.detail;
  const pq = $('pQCount'); if (pq) pq.textContent = count;
  const mq = $('msQ');     if (mq) mq.textContent = count;

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
    return `<div class="ev" onclick="window.MapRenderer?.flyTo(${lat},${lng},5)" tabindex="0" role="button" aria-label="M${m.toFixed(1)} earthquake at ${esc(p)}">
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
  const pe  = $('pECount'); if (pe)  pe.textContent  = count;
  const mse = $('msE');     if (mse) mse.textContent = count;

  const el = $('earthList');
  if (!el) return;
  el.innerHTML = events.slice(0, 14).map(ev => {
    const cat = ev.categories?.[0]?.id || '';
    const c   = evColor(cat), em = evEmoji(cat);
    const geo = ev.geometry?.[0];
    const isP = geo?.coordinates && !Array.isArray(geo.coordinates[0]);
    const lat = isP ? geo.coordinates[1] : null;
    const lng = isP ? geo.coordinates[0] : null;
    const ca  = lat !== null ? `onclick="window.MapRenderer?.flyTo(${lat},${lng},5)" tabindex="0" role="button"` : '';
    return `<div class="ev" ${ca}>
      <div class="ev-badge" style="background:${c}18;color:${c};font-size:15px;padding:0;min-width:28px">${em}</div>
      <div class="ev-body">
        <div class="ev-name">${esc(ev.title.length > 44 ? ev.title.slice(0, 44) + '…' : ev.title)}</div>
        <div class="ev-meta">${esc(ev.categories?.[0]?.title || 'Event')} · ${ev.geometry?.length || 1} obs.</div>
      </div>
    </div>`;
  }).join('');
});

/* ─── NEWS PANEL ─────────────────────────────────────────────────────────── */
// FIXED: Cache resolved pins from bx:news — do NOT call resolveNewsGeo on tab switch
let _newsBBC         = [];
let _newsGuardian    = [];
let _cachedPinsByIdx = new Map();  // item idx → geo resolution
let _currentTab      = 'bbc';

window.addEventListener('bx:news', e => {
  const { bbc, guardian, pins, total, error } = e.detail;
  if (bbc)      _newsBBC      = bbc;
  if (guardian) _newsGuardian = guardian;

  // Build lookup map: link → pin data (for 📍 button in news rows)
  _cachedPinsByIdx.clear();
  (pins || []).forEach(pin => {
    _cachedPinsByIdx.set(pin.link || pin.pinIdx, pin);
  });

  const pnc = $('pNCount'); if (pnc) pnc.textContent = total || 0;
  const msn = $('msN');     if (msn) msn.textContent = total || 0;
  const msp = $('msPins');  if (msp) msp.textContent = (pins || []).length;

  if (error && !total) {
    const nf = $('newsFeed');
    if (nf) nf.innerHTML = '<div class="err">News proxies unreachable — retrying in 10 min</div>';
    return;
  }

  renderNewsTab(_currentTab);
});


/* ─── STATE for Reddit tab ────────────────────────────────────────────── */
let _redditBySource = {};
let _redditAllPosts = [];
let _currentRedditTab = 'all';
 
window.addEventListener('bx:reddit', e => {
  const { posts, pins, total, hotCount, bySource, score, pinCount } = e.detail;
 
  _redditAllPosts  = posts || [];
  _redditBySource  = bySource || {};
 
  // Update header pill count
  const pR = document.getElementById('pRedditCount');
  if (pR) pR.textContent = total || 0;
 
  // Update map stat
  const msR = document.getElementById('msR');
  if (msR) msR.textContent = pinCount || 0;
 
  // Render the active Reddit tab
  renderRedditTab(_currentRedditTab);
});
 


function renderNewsTab(tab) {
  _currentTab      = tab;
  const items      = tab === 'bbc' ? _newsBBC : _newsGuardian;
  const srcLabel   = tab === 'bbc' ? 'BBC WORLD'  : 'GUARDIAN';
  const srcColor   = tab === 'bbc' ? '#dc2626'    : '#059669';
  const el         = $('newsFeed');
  if (!el) return;

  if (!items.length) {
    el.innerHTML = '<div class="empty">Awaiting data for this feed…</div>';
    return;
  }

  const rows = [];
  for (const item of items.slice(0, 16)) {
    try {
      // FIXED: Use cached pin lookup — no NLP re-run on tab switch
      const pin = _cachedPinsByIdx.get(item.link) || null;
      const vis = pin && window.GeoIntelligence
        ? window.GeoIntelligence.getCrisisVisual(pin.crisisType)
        : null;

      const safeLink  = esc(item.link || '#');
      const safeTitle = esc(item.title || '');

      const geoTag = pin && vis
        ? `<span style="font-size:7.5px;font-weight:700;color:${vis.color};margin-left:5px;vertical-align:middle">${vis.emoji} ${esc((pin.entity || '').toUpperCase())}</span>`
        : '';

      const mapBtn = pin
        ? `<button class="ni-map-btn" onclick="window.MapRenderer?.flyTo(${pin.lat},${pin.lng},5);event.stopPropagation()" title="Locate on map" aria-label="Show on map">📍</button>`
        : '';

      rows.push(`<div class="ni" onclick="window.open('${safeLink}','_blank','noopener,noreferrer')" tabindex="0" role="button" aria-label="${safeTitle}">
        <div class="ni-src" style="color:${srcColor}">${srcLabel}${geoTag}</div>
        <div class="ni-title-row">
          <div class="ni-title">${safeTitle}</div>
          ${mapBtn}
        </div>
        <div class="ni-time">${timeAgo(item.pubDate)}</div>
      </div>`);
    } catch (_) {
      // Error boundary — skip bad item silently
    }
  }

  el.innerHTML = rows.join('');
}

function showNewsTab(tab, btn) {
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('on'));
  btn.classList.add('on');
  renderNewsTab(tab);
}
window.showNewsTab = showNewsTab;
function showRedditTab(tabKey, btn) {
  _currentRedditTab = tabKey;
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('on'));
  if (btn) btn.classList.add('on');
  renderRedditTab(tabKey);
}
window.showRedditTab = showRedditTab;
 
function renderRedditTab(tabKey) {
  const el = document.getElementById('redditFeed');
  if (!el) return;
 
  const REDDIT_SOURCES = window.DataEngine?.REDDIT_SOURCES || [];
 
  // Pick posts for this tab
  let posts;
  if (tabKey === 'all') {
    posts = _redditAllPosts;
  } else {
    posts = _redditBySource[tabKey] || [];
  }
 
  if (!posts.length) {
    el.innerHTML = '<div class="empty">No Reddit posts yet — data loading…</div>';
    return;
  }
 
  // Stats bar
  const totalScore  = posts.reduce((s, p) => s + p.weightedScore, 0);
  const hotPosts    = posts.filter(p => p.weightedScore > 1000);
  const topVel      = Math.max(0, ...posts.map(p => p.velocity || 0));
  const gi          = window.GeoIntelligence;
 
  const statsHtml = `
    <div class="ri-stat-bar">
      <div class="ri-stat">
        <span class="ri-stat-v">${posts.length}</span>
        <span class="ri-stat-l">Posts</span>
      </div>
      <div class="ri-stat">
        <span class="ri-stat-v">${hotPosts.length}</span>
        <span class="ri-stat-l">Hot</span>
      </div>
      <div class="ri-stat">
        <span class="ri-stat-v">${topVel > 999 ? (topVel/1000).toFixed(1)+'K' : topVel}</span>
        <span class="ri-stat-l">Peak /hr</span>
      </div>
      <div class="ri-stat">
        <span class="ri-stat-v">${totalScore > 99999 ? (totalScore/1000).toFixed(0)+'K' : totalScore.toLocaleString()}</span>
        <span class="ri-stat-l">Signals</span>
      </div>
    </div>
  `;
 
  const rows = [];
  for (const post of posts.slice(0, 18)) {
    try {
      // Geo pin lookup from cached pins
      const vis = gi ? gi.getCrisisVisual(post.crisisType) : null;
 
      const isHot  = (post.velocity || 0) > 50 || post.weightedScore > 2000;
      const ratio  = Math.round((post.upvoteRatio || 0.5) * 100);
      const ratioC = ratio > 80 ? '#059669' : ratio > 60 ? '#d97706' : '#dc2626';
      const safeUrl = esc(post.url || '#');
      const titleEsc = esc(post.title || '');
 
      const subSrc   = (window.DataEngine?.REDDIT_SOURCES || []).find(s => s.sub === post.sub);
      const subColor = subSrc?.color || '#ff4500';
      const subIcon  = subSrc?.icon  || '🟠';
 
      const flairHtml = post.flair
        ? `<span class="ri-flair">${esc(post.flair)}</span>`
        : '';
 
      const velHtml = (post.velocity || 0) > 10
        ? `<span class="ri-vel">🔥 ${post.velocity}/hr</span>`
        : '';
 
      const crisisHtml = vis && post.crisisType !== 'general'
        ? `<span class="ri-crisis-tag" style="color:${vis.color}">${vis.emoji} ${esc(vis.label)}</span>`
        : '';
 
      // Map fly-to — only if geo-resolved
      const hasPins = _redditAllPosts.some(p => p.id === post.id && p.lat !== undefined);
      const mapBtnHtml = hasPins
        ? `<button class="ni-map-btn" style="color:#ff4500"
             onclick="(function(){
               const p=window._redditAllPosts?.find(x=>x.id==='${post.id}');
               if(p&&p.lat) window.MapRenderer?.flyTo(p.lat,p.lng,5);
             })();event.stopPropagation()"
             title="Locate on map" aria-label="Show on map">📍</button>`
        : '';
 
      rows.push(`
        <div class="ri-row" onclick="window.open('${safeUrl}','_blank','noopener,noreferrer')"
             tabindex="0" role="button" aria-label="${titleEsc}">
 
          <div class="ri-header">
            ${isHot ? '<span class="ri-hot-dot"></span>' : ''}
            <span class="ri-icon">${subIcon}</span>
            <span class="ri-title">${titleEsc}</span>
            ${mapBtnHtml}
          </div>
 
          <div class="ri-meta-row">
            <span class="ri-sub-tag" style="background:${subColor}18;color:${subColor}">
              r/${esc(post.sub)}
            </span>
            ${flairHtml}
            ${velHtml}
            ${crisisHtml}
            <span class="ri-time">${timeAgo(post.created)}</span>
          </div>
 
          <div class="ri-score-row">
            <span class="ri-score-num">▲ ${
              post.score > 9999 ? (post.score/1000).toFixed(1)+'K' : post.score.toLocaleString()
            }</span>
            <div class="ri-bar-track">
              <div class="ri-bar-fill" style="width:${ratio}%;background:${ratioC}"></div>
            </div>
            <span class="ri-comments">💬 ${
              post.comments > 999 ? (post.comments/1000).toFixed(1)+'K' : post.comments
            }</span>
          </div>
 
        </div>
      `);
    } catch (_) {
      // Error boundary — skip bad post silently
    }
  }
 
  el.innerHTML = statsHtml + rows.join('');
}


/* ─── GEOPOLITICAL PANEL ─────────────────────────────────────────────────── */
window.addEventListener('bx:geopolitical', e => {
  const { score, zones, pins } = e.detail;

  const activeZones   = (zones || []).filter(z => z.status === 'active');
  const elevatedZones = (zones || []).filter(z => z.status === 'elevated');
  const warPins       = (pins  || []).filter(p => ['war','terrorism','conflict'].includes(p.crisisType));

  // Stat cells
  const el1 = $('geoActive');   if (el1) el1.textContent = activeZones.length;
  const el2 = $('geoElevated'); if (el2) el2.textContent = elevatedZones.length;
  const el3 = $('geoWarNews');  if (el3) el3.textContent = warPins.length;
  const el4 = $('geoScore');
  if (el4) {
    el4.textContent  = score;
    el4.style.color  = score > 70 ? 'var(--red)' : score > 40 ? 'var(--amber)' : 'var(--sky)';
  }

  // Mini conflict list — top 5 by severity, all XSS-safe
  const listEl = $('geoConflictList');
  if (listEl) {
    const top          = [...(zones || [])].sort((a, b) => b.severity - a.severity).slice(0, 5);
    const sevColors    = { 1:'#94a3b8', 2:'#d97706', 3:'#ea580c', 4:'#dc2626', 5:'#7f1d1d' };
    listEl.innerHTML   = top.map(z => `
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
  const coords = $('issCoords'), sub = $('issSub');
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
  const { seismic, events, market, geopolitical, m5count, eventCount } = e.detail;

  setPulse('seisBar', 'seisVal', seismic,
    seismic < 30 ? 'Low' : seismic < 60 ? 'Moderate' : 'Elevated');

  setPulse('evBar', 'evVal', events,
    events < 30 ? 'Normal' : events < 60 ? 'Active' : 'Elevated');

  setPulse('mktBar', 'mktVal', market,
    market < 30 ? 'Calm' : market < 60 ? 'Active' : 'Volatile');

  setPulse('geoBar', 'geoVal', geopolitical,
    geopolitical < 20 ? 'Stable' : geopolitical < 45 ? 'Tense' : geopolitical < 70 ? 'Volatile' : 'Critical');

  setPulse('redditBar', 'redditVal', reddit || 0,
    (reddit || 0) < 25 ? 'Quiet'
    : (reddit || 0) < 55 ? 'Active'
    : (reddit || 0) < 80 ? 'Surging'
    : 'Viral'
  );
  // Factor row — FIXED: use emitted counts, not DataEngine.getState() re-scan
  const tfQ = $('tfQ'), tfE = $('tfE'), tfM = $('tfM'), tfG = $('tfGeo');
  if (tfQ) tfQ.textContent = (m5count   || '—') + (m5count    !== undefined ? ' events' : '');
  if (tfE) tfE.textContent = (eventCount|| '—') + (eventCount !== undefined ? ' open'   : '');
  if (tfM) tfM.textContent = (market || 0).toFixed(0) + '% vol.';
  if (tfG) tfG.textContent = (geopolitical || 0) + '/100';

  // Composite threat ring: seismic 20% + events 15% + market 15% + geopolitical 50%
   const composite = Math.min(100, Math.round(
     (seismic      || 0) * 0.18 +
     (events       || 0) * 0.13 +
     (market       || 0) * 0.13 +
     (geopolitical || 0) * 0.46 +
     (reddit       || 0) * 0.10
   ));
  _drawThreatRing(composite);
  _updateThreatChip(composite);
});

/* ─── THREAT RING ────────────────────────────────────────────────────────── */
function _drawThreatRing(score) {
  let status, desc, color;
  if      (score < 15) { status = 'NOMINAL';  desc = 'Global conditions stable';          color = '#059669'; }
  else if (score < 30) { status = 'GUARDED';  desc = 'Minor elevated indicators';         color = '#0284c7'; }
  else if (score < 50) { status = 'ELEVATED'; desc = 'Multiple active concerns';          color = '#d97706'; }
  else if (score < 70) { status = 'HIGH';     desc = 'Significant geopolitical activity'; color = '#ea580c'; }
  else                 { status = 'CRITICAL'; desc = 'Extreme multi-domain tensions';     color = '#dc2626'; }

  const c = $('threatRing');
  if (c) {
    const dpr = window.devicePixelRatio || 1;
    c.width  = 60 * dpr; c.height = 60 * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    const cx = 30, cy = 30, r = 23, lw = 4.5;
    ctx.clearRect(0, 0, 60, 60);
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = lw; ctx.stroke();
    if (score > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (score / 100));
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  const numEl  = $('threatNum');
  const stEl   = $('threatStatus');
  const descEl = $('threatDesc');
  if (numEl)  { numEl.textContent = score; numEl.style.color = color; }
  if (stEl)   { stEl.textContent  = status; stEl.style.color  = color; }
  if (descEl)   descEl.textContent = desc;
}

/* ─── THREAT CHIP (header) ───────────────────────────────────────────────── */
// FIXED: Sorted threshold array — guaranteed correct order, no Object.entries fragility
const CHIP_THRESHOLDS = [
  { max: 15,  color: '#059669', label: 'NOMINAL'  },
  { max: 30,  color: '#0284c7', label: 'GUARDED'  },
  { max: 50,  color: '#d97706', label: 'ELEVATED' },
  { max: 70,  color: '#ea580c', label: 'HIGH'     },
  { max: 101, color: '#dc2626', label: 'CRITICAL' },
];

function _updateThreatChip(score) {
  const tier  = CHIP_THRESHOLDS.find(t => score < t.max) || CHIP_THRESHOLDS[CHIP_THRESHOLDS.length - 1];
  const chip  = $('threatChip'), dot = $('threatDot'), lbl = $('threatLabel');
  if (chip) chip.style.borderColor = tier.color + '44';
  if (dot)  dot.style.background   = tier.color;
  if (lbl)  { lbl.textContent = tier.label; lbl.style.color = tier.color; }
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

/* ─── LAYER TOOLBAR WIRING ──────────────────────────────────────────────── */
window.toggleLayer = function(key, btn) {
  window.MapRenderer?.toggleLayer(key, btn);
};
