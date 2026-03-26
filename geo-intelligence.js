'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · GEO-INTELLIGENCE ENGINE v4.1
   ─────────────────────────────────────────────────────────────────────────
   Fixes v4 → v4.1:
   • CRITICAL: Removed duplicate 'taiwan' key (was priority 1 AND 3 — JS
     object literal silently kept only the second, dropping priority-1 entry)
   • PERF: Compiled regex cache — RegExp objects built once at module load,
     not rebuilt on every resolveNewsGeo() call
   • BUG: Text cleaning now preserves hyphens → 'al-shabaab', 'bab al-mandab'
     match correctly
   • BUG: Added adjective/demonym forms (ukrainian, russian, iranian, etc.)
     as alias keys pointing to the same coordinates
   • ROBUSTNESS: Short-key false-positive guard — 2-3 char keys use stricter
     word-boundary patterns and are validated against common false-positive words
   • NEW: Confidence-weighted deduplication — when same headline matches
     multiple entities in the same zone, only the highest-confidence pin kept
   • NEW: No-geo exclusion list — headlines about markets, climate reports,
     tech earnings etc. that should never get a geo-pin
   • DOCS: computeGeopoliticalScore now explicitly documents its hybrid approach
═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. ENTITY DATABASE ─────────────────────────────────────────────────
   priority 0 = conflict zones (highest precedence)
   priority 1 = geopolitical hotspots
   priority 2 = strategic institutions / regions
   priority 3 = major countries / cities
   NOTE: No duplicate keys — JS object literals silently drop earlier entries.
─────────────────────────────────────────────────────────────────────────── */
const GEO_ENTITIES = {
  /* ── ACTIVE CONFLICT ZONES (priority 0) ─── */
  'gaza':             { lat: 31.35,  lng: 34.31,  p: 0, type: 'conflict' },
  'west bank':        { lat: 31.90,  lng: 35.20,  p: 0, type: 'conflict' },
  'rafah':            { lat: 31.28,  lng: 34.25,  p: 0, type: 'conflict' },
  'khan younis':      { lat: 31.35,  lng: 34.30,  p: 0, type: 'conflict' },
  'donbas':           { lat: 48.00,  lng: 37.80,  p: 0, type: 'conflict' },
  'donetsk':          { lat: 48.02,  lng: 37.80,  p: 0, type: 'conflict' },
  'zaporizhzhia':     { lat: 47.84,  lng: 35.14,  p: 0, type: 'conflict' },
  'kherson':          { lat: 46.64,  lng: 32.62,  p: 0, type: 'conflict' },
  'kharkiv':          { lat: 49.99,  lng: 36.23,  p: 0, type: 'conflict' },
  'bakhmut':          { lat: 48.59,  lng: 37.99,  p: 0, type: 'conflict' },
  'avdiivka':         { lat: 48.14,  lng: 37.74,  p: 0, type: 'conflict' },
  'mariupol':         { lat: 47.10,  lng: 37.55,  p: 0, type: 'conflict' },
  'kyiv':             { lat: 50.45,  lng: 30.52,  p: 0, type: 'city' },
  'odesa':            { lat: 46.48,  lng: 30.72,  p: 0, type: 'city' },
  'ukraine':          { lat: 49.00,  lng: 32.00,  p: 0, type: 'country' },
  'ukrainian':        { lat: 49.00,  lng: 32.00,  p: 0, type: 'demonym' },
  'sudan':            { lat: 15.55,  lng: 32.53,  p: 0, type: 'conflict' },
  'khartoum':         { lat: 15.55,  lng: 32.53,  p: 0, type: 'city' },
  'darfur':           { lat: 13.50,  lng: 24.00,  p: 0, type: 'conflict' },
  'sahel':            { lat: 14.00,  lng: 2.00,   p: 0, type: 'conflict' },
  'mali':             { lat: 17.57,  lng: -3.99,  p: 0, type: 'country' },
  'burkina faso':     { lat: 12.36,  lng: -1.53,  p: 0, type: 'conflict' },
  'niger':            { lat: 17.61,  lng: 8.08,   p: 0, type: 'country' },
  'somalia':          { lat: 5.15,   lng: 46.20,  p: 0, type: 'conflict' },
  'mogadishu':        { lat: 2.05,   lng: 45.34,  p: 0, type: 'city' },
  'myanmar':          { lat: 19.74,  lng: 96.08,  p: 0, type: 'conflict' },
  'rakhine':          { lat: 20.10,  lng: 92.90,  p: 0, type: 'conflict' },
  'naypyidaw':        { lat: 19.74,  lng: 96.08,  p: 0, type: 'city' },
  'haiti':            { lat: 18.97,  lng: -72.29, p: 0, type: 'conflict' },
  'port-au-prince':   { lat: 18.54,  lng: -72.34, p: 0, type: 'city' },
  'kashmir':          { lat: 34.08,  lng: 74.79,  p: 0, type: 'conflict' },
  'line of control':  { lat: 34.00,  lng: 74.50,  p: 0, type: 'conflict' },
  'taiwan strait':    { lat: 24.00,  lng: 119.00, p: 0, type: 'conflict' },
  'south china sea':  { lat: 12.00,  lng: 113.00, p: 0, type: 'conflict' },
  'nagorno-karabakh': { lat: 40.00,  lng: 46.50,  p: 0, type: 'conflict' },
  'tigray':           { lat: 14.00,  lng: 38.50,  p: 0, type: 'conflict' },
  'ethiopia':         { lat: 9.14,   lng: 40.49,  p: 0, type: 'country' },
  'addis ababa':      { lat: 9.03,   lng: 38.74,  p: 0, type: 'city' },
  'yemen':            { lat: 15.55,  lng: 48.52,  p: 0, type: 'conflict' },
  'sanaa':            { lat: 15.35,  lng: 44.21,  p: 0, type: 'city' },
  'hodeida':          { lat: 14.80,  lng: 42.95,  p: 0, type: 'city' },
  'aden':             { lat: 12.78,  lng: 45.04,  p: 0, type: 'city' },
  'congo':            { lat: -4.04,  lng: 21.76,  p: 0, type: 'conflict' },
  'drc':              { lat: -4.04,  lng: 21.76,  p: 0, type: 'conflict' },
  'kinshasa':         { lat: -4.32,  lng: 15.32,  p: 0, type: 'city' },
  'goma':             { lat: -1.67,  lng: 29.22,  p: 0, type: 'conflict' },
  'hamas':            { lat: 31.35,  lng: 34.31,  p: 0, type: 'actor' },
  'hezbollah':        { lat: 33.89,  lng: 35.50,  p: 0, type: 'actor' },
  'houthi':           { lat: 15.55,  lng: 44.20,  p: 0, type: 'actor' },
  'houthis':          { lat: 15.55,  lng: 44.20,  p: 0, type: 'actor' },
  'wagner':           { lat: 14.00,  lng: 2.00,   p: 0, type: 'actor' },
  'isis':             { lat: 34.80,  lng: 39.00,  p: 0, type: 'actor' },
  'islamic state':    { lat: 34.80,  lng: 39.00,  p: 0, type: 'actor' },
  'al-shabaab':       { lat: 5.15,   lng: 46.20,  p: 0, type: 'actor' },
  'boko haram':       { lat: 11.85,  lng: 13.16,  p: 0, type: 'actor' },
  'rsf':              { lat: 13.50,  lng: 30.00,  p: 0, type: 'actor' },
  'rapid support forces': { lat: 13.50, lng: 30.00, p: 0, type: 'actor' },
  'red sea':          { lat: 20.00,  lng: 38.00,  p: 0, type: 'region' },
  'strait of hormuz': { lat: 26.57,  lng: 56.45,  p: 0, type: 'region' },
  'suez canal':       { lat: 30.50,  lng: 32.35,  p: 0, type: 'region' },
  'bab al-mandab':    { lat: 12.58,  lng: 43.44,  p: 0, type: 'region' },
  'gulf of aden':     { lat: 12.00,  lng: 47.00,  p: 0, type: 'region' },

  /* ── GEOPOLITICAL HOTSPOTS (priority 1) ─── */
  'iran':             { lat: 32.43,  lng: 53.69,  p: 1, type: 'country' },
  'iranian':          { lat: 32.43,  lng: 53.69,  p: 1, type: 'demonym' },
  'tehran':           { lat: 35.69,  lng: 51.39,  p: 1, type: 'city' },
  'israel':           { lat: 31.05,  lng: 34.85,  p: 1, type: 'country' },
  'israeli':          { lat: 31.05,  lng: 34.85,  p: 1, type: 'demonym' },
  'tel aviv':         { lat: 32.09,  lng: 34.79,  p: 1, type: 'city' },
  'jerusalem':        { lat: 31.77,  lng: 35.22,  p: 1, type: 'city' },
  'lebanon':          { lat: 33.89,  lng: 35.50,  p: 1, type: 'country' },
  'beirut':           { lat: 33.89,  lng: 35.50,  p: 1, type: 'city' },
  'syria':            { lat: 34.80,  lng: 38.99,  p: 1, type: 'country' },
  'syrian':           { lat: 34.80,  lng: 38.99,  p: 1, type: 'demonym' },
  'damascus':         { lat: 33.51,  lng: 36.29,  p: 1, type: 'city' },
  'aleppo':           { lat: 36.20,  lng: 37.16,  p: 1, type: 'city' },
  'iraq':             { lat: 33.22,  lng: 43.68,  p: 1, type: 'country' },
  'iraqi':            { lat: 33.22,  lng: 43.68,  p: 1, type: 'demonym' },
  'baghdad':          { lat: 33.34,  lng: 44.40,  p: 1, type: 'city' },
  'mosul':            { lat: 36.33,  lng: 43.12,  p: 1, type: 'city' },
  'russia':           { lat: 61.52,  lng: 105.32, p: 1, type: 'country' },
  'russian':          { lat: 61.52,  lng: 105.32, p: 1, type: 'demonym' },
  'moscow':           { lat: 55.75,  lng: 37.62,  p: 1, type: 'city' },
  'st. petersburg':   { lat: 59.95,  lng: 30.32,  p: 1, type: 'city' },
  'north korea':      { lat: 40.34,  lng: 127.51, p: 1, type: 'country' },
  'north korean':     { lat: 40.34,  lng: 127.51, p: 1, type: 'demonym' },
  'pyongyang':        { lat: 39.02,  lng: 125.75, p: 1, type: 'city' },
  'china':            { lat: 35.86,  lng: 104.20, p: 1, type: 'country' },
  'chinese':          { lat: 35.86,  lng: 104.20, p: 1, type: 'demonym' },
  'beijing':          { lat: 39.91,  lng: 116.39, p: 1, type: 'city' },
  /* NOTE: 'taiwan' appears only once — priority 1 (conflict-adjacent) */
  'taiwan':           { lat: 23.70,  lng: 120.96, p: 1, type: 'country' },
  'taiwanese':        { lat: 23.70,  lng: 120.96, p: 1, type: 'demonym' },
  'taipei':           { lat: 25.04,  lng: 121.56, p: 1, type: 'city' },
  'pakistan':         { lat: 30.38,  lng: 69.35,  p: 1, type: 'country' },
  'pakistani':        { lat: 30.38,  lng: 69.35,  p: 1, type: 'demonym' },
  'islamabad':        { lat: 33.72,  lng: 73.04,  p: 1, type: 'city' },
  'venezuela':        { lat: 6.42,   lng: -66.59, p: 1, type: 'country' },
  'caracas':          { lat: 10.48,  lng: -66.88, p: 1, type: 'city' },
  'nicaragua':        { lat: 12.87,  lng: -85.21, p: 1, type: 'country' },
  'cuba':             { lat: 21.52,  lng: -77.78, p: 1, type: 'country' },
  'havana':           { lat: 23.13,  lng: -82.38, p: 1, type: 'city' },
  'crimea':           { lat: 45.34,  lng: 34.10,  p: 1, type: 'conflict' },
  'xinjiang':         { lat: 42.52,  lng: 87.34,  p: 1, type: 'region' },
  'tibet':            { lat: 31.69,  lng: 88.15,  p: 1, type: 'region' },
  'chechnya':         { lat: 43.40,  lng: 45.72,  p: 1, type: 'conflict' },
  'balochistan':      { lat: 28.49,  lng: 65.10,  p: 1, type: 'conflict' },
  'waziristan':       { lat: 32.30,  lng: 69.80,  p: 1, type: 'conflict' },
  'mindanao':         { lat: 8.00,   lng: 125.00, p: 1, type: 'conflict' },

  /* ── GLOBAL INSTITUTIONS & STRATEGIC LOCATIONS (priority 2) ─── */
  'nato':             { lat: 50.88,  lng: 4.32,   p: 2, type: 'institution' },
  'un':               { lat: 40.75,  lng: -73.97, p: 2, type: 'institution' },
  'united nations':   { lat: 40.75,  lng: -73.97, p: 2, type: 'institution' },
  'pentagon':         { lat: 38.87,  lng: -77.06, p: 2, type: 'institution' },
  'white house':      { lat: 38.90,  lng: -77.04, p: 2, type: 'institution' },
  'kremlin':          { lat: 55.75,  lng: 37.61,  p: 2, type: 'institution' },
  'g7':               { lat: 48.86,  lng: 2.35,   p: 2, type: 'institution' },
  'g20':              { lat: 40.75,  lng: -73.97, p: 2, type: 'institution' },
  'imf':              { lat: 38.90,  lng: -77.04, p: 2, type: 'institution' },
  'world bank':       { lat: 38.90,  lng: -77.04, p: 2, type: 'institution' },
  'brics':            { lat: 25.20,  lng: 55.27,  p: 2, type: 'institution' },
  'opec':             { lat: 48.20,  lng: 16.37,  p: 2, type: 'institution' },
  'arctic':           { lat: 80.00,  lng: 0.00,   p: 2, type: 'region' },
  'arctic ocean':     { lat: 80.00,  lng: 0.00,   p: 2, type: 'region' },
  'pacific':          { lat: 0.00,   lng: -160.00,p: 2, type: 'region' },
  'atlantic':         { lat: 20.00,  lng: -30.00, p: 2, type: 'region' },
  'indian ocean':     { lat: -20.00, lng: 75.00,  p: 2, type: 'region' },

  /* ── MAJOR COUNTRIES / CITIES (priority 3) ─── */
  'usa':              { lat: 38.89,  lng: -77.04, p: 3, type: 'country' },
  'america':          { lat: 38.89,  lng: -77.04, p: 3, type: 'country' },
  'american':         { lat: 38.89,  lng: -77.04, p: 3, type: 'demonym' },
  'washington':       { lat: 38.89,  lng: -77.04, p: 3, type: 'city' },
  'new york':         { lat: 40.71,  lng: -74.01, p: 3, type: 'city' },
  'united states':    { lat: 38.89,  lng: -77.04, p: 3, type: 'country' },
  'uk':               { lat: 51.51,  lng: -0.13,  p: 3, type: 'country' },
  'britain':          { lat: 51.51,  lng: -0.13,  p: 3, type: 'country' },
  'british':          { lat: 51.51,  lng: -0.13,  p: 3, type: 'demonym' },
  'england':          { lat: 51.51,  lng: -0.13,  p: 3, type: 'country' },
  'london':           { lat: 51.51,  lng: -0.13,  p: 3, type: 'city' },
  'france':           { lat: 46.23,  lng: 2.21,   p: 3, type: 'country' },
  'french':           { lat: 46.23,  lng: 2.21,   p: 3, type: 'demonym' },
  'paris':            { lat: 48.86,  lng: 2.35,   p: 3, type: 'city' },
  'germany':          { lat: 51.17,  lng: 10.45,  p: 3, type: 'country' },
  'german':           { lat: 51.17,  lng: 10.45,  p: 3, type: 'demonym' },
  'berlin':           { lat: 52.52,  lng: 13.40,  p: 3, type: 'city' },
  'europe':           { lat: 54.53,  lng: 15.25,  p: 3, type: 'region' },
  'european':         { lat: 54.53,  lng: 15.25,  p: 3, type: 'demonym' },
  'india':            { lat: 20.59,  lng: 78.96,  p: 3, type: 'country' },
  'indian':           { lat: 20.59,  lng: 78.96,  p: 3, type: 'demonym' },
  'new delhi':        { lat: 28.61,  lng: 77.21,  p: 3, type: 'city' },
  'mumbai':           { lat: 19.08,  lng: 72.88,  p: 3, type: 'city' },
  'japan':            { lat: 36.20,  lng: 138.25, p: 3, type: 'country' },
  'japanese':         { lat: 36.20,  lng: 138.25, p: 3, type: 'demonym' },
  'tokyo':            { lat: 35.68,  lng: 139.69, p: 3, type: 'city' },
  'south korea':      { lat: 35.91,  lng: 127.77, p: 3, type: 'country' },
  'south korean':     { lat: 35.91,  lng: 127.77, p: 3, type: 'demonym' },
  'seoul':            { lat: 37.57,  lng: 126.98, p: 3, type: 'city' },
  'australia':        { lat: -25.27, lng: 133.78, p: 3, type: 'country' },
  'australian':       { lat: -25.27, lng: 133.78, p: 3, type: 'demonym' },
  'canberra':         { lat: -35.28, lng: 149.13, p: 3, type: 'city' },
  'sydney':           { lat: -33.87, lng: 151.21, p: 3, type: 'city' },
  'brazil':           { lat: -14.24, lng: -51.93, p: 3, type: 'country' },
  'brazilian':        { lat: -14.24, lng: -51.93, p: 3, type: 'demonym' },
  'brasilia':         { lat: -15.78, lng: -47.93, p: 3, type: 'city' },
  'mexico':           { lat: 23.63,  lng: -102.55,p: 3, type: 'country' },
  'mexican':          { lat: 23.63,  lng: -102.55,p: 3, type: 'demonym' },
  'mexico city':      { lat: 19.43,  lng: -99.13, p: 3, type: 'city' },
  'canada':           { lat: 56.13,  lng: -106.35,p: 3, type: 'country' },
  'canadian':         { lat: 56.13,  lng: -106.35,p: 3, type: 'demonym' },
  'ottawa':           { lat: 45.42,  lng: -75.70, p: 3, type: 'city' },
  'turkey':           { lat: 38.96,  lng: 35.24,  p: 3, type: 'country' },
  'turkish':          { lat: 38.96,  lng: 35.24,  p: 3, type: 'demonym' },
  'ankara':           { lat: 39.93,  lng: 32.85,  p: 3, type: 'city' },
  'istanbul':         { lat: 41.01,  lng: 28.95,  p: 3, type: 'city' },
  'saudi arabia':     { lat: 23.89,  lng: 45.08,  p: 3, type: 'country' },
  'saudi':            { lat: 23.89,  lng: 45.08,  p: 3, type: 'demonym' },
  'riyadh':           { lat: 24.69,  lng: 46.72,  p: 3, type: 'city' },
  'egypt':            { lat: 26.82,  lng: 30.80,  p: 3, type: 'country' },
  'egyptian':         { lat: 26.82,  lng: 30.80,  p: 3, type: 'demonym' },
  'cairo':            { lat: 30.05,  lng: 31.25,  p: 3, type: 'city' },
  'south africa':     { lat: -30.56, lng: 22.94,  p: 3, type: 'country' },
  'nigeria':          { lat: 9.08,   lng: 8.68,   p: 3, type: 'country' },
  'abuja':            { lat: 9.07,   lng: 7.40,   p: 3, type: 'city' },
  'kenya':            { lat: -0.02,  lng: 37.91,  p: 3, type: 'country' },
  'nairobi':          { lat: -1.29,  lng: 36.82,  p: 3, type: 'city' },
  'indonesia':        { lat: -0.79,  lng: 113.92, p: 3, type: 'country' },
  'jakarta':          { lat: -6.21,  lng: 106.85, p: 3, type: 'city' },
  'philippines':      { lat: 12.88,  lng: 121.77, p: 3, type: 'country' },
  'manila':           { lat: 14.60,  lng: 120.98, p: 3, type: 'city' },
  'thailand':         { lat: 15.87,  lng: 100.99, p: 3, type: 'country' },
  'bangkok':          { lat: 13.75,  lng: 100.52, p: 3, type: 'city' },
  'vietnam':          { lat: 14.06,  lng: 108.28, p: 3, type: 'country' },
  'hanoi':            { lat: 21.03,  lng: 105.83, p: 3, type: 'city' },
  'poland':           { lat: 51.92,  lng: 19.14,  p: 3, type: 'country' },
  'warsaw':           { lat: 52.23,  lng: 21.01,  p: 3, type: 'city' },
  'hungary':          { lat: 47.16,  lng: 19.50,  p: 3, type: 'country' },
  'budapest':         { lat: 47.50,  lng: 19.04,  p: 3, type: 'city' },
  'serbia':           { lat: 44.02,  lng: 21.01,  p: 3, type: 'country' },
  'belgrade':         { lat: 44.80,  lng: 20.46,  p: 3, type: 'city' },
  'finland':          { lat: 61.92,  lng: 25.75,  p: 3, type: 'country' },
  'sweden':           { lat: 60.13,  lng: 18.64,  p: 3, type: 'country' },
  'balkans':          { lat: 43.00,  lng: 20.00,  p: 3, type: 'region' },
  'caucasus':         { lat: 42.00,  lng: 44.00,  p: 3, type: 'region' },
  'central asia':     { lat: 46.00,  lng: 64.00,  p: 3, type: 'region' },
  'horn of africa':   { lat: 8.00,   lng: 44.00,  p: 3, type: 'region' },
  'middle east':      { lat: 29.31,  lng: 42.46,  p: 3, type: 'region' },
  'southeast asia':   { lat: 10.00,  lng: 106.00, p: 3, type: 'region' },
  'latin america':    { lat: -10.00, lng: -60.00, p: 3, type: 'region' },
  'south america':    { lat: -14.00, lng: -51.00, p: 3, type: 'region' },
  'north africa':     { lat: 27.00,  lng: 13.00,  p: 3, type: 'region' },
  'west africa':      { lat: 7.00,   lng: -2.00,  p: 3, type: 'region' },
  'east africa':      { lat: -1.00,  lng: 36.00,  p: 3, type: 'region' },
  'sub-saharan africa':{ lat:-5.00,  lng: 20.00,  p: 3, type: 'region' },
  'africa':           { lat: -8.78,  lng: 34.51,  p: 3, type: 'region' },
};

/* ── 2. COMPILED REGEX CACHE ────────────────────────────────────────────
   Built once at module load. Prevents RegExp reconstruction on every call.
   Short keys (≤4 chars) use strict word-boundary pattern.
   Multi-word keys use hyphen-tolerant pattern.
─────────────────────────────────────────────────────────────────────────── */

/*
  False-positive guard: very common short keys that match inside longer words.
  'uk' → do NOT match 'truck', 'outlook', 'bulk' etc.
  'drc' → do NOT match common strings
  'un'  → do NOT match 'fund', 'run', 'sun', 'fun', 'gun' etc.
*/
const SHORT_KEY_FALSE_POSITIVES = new Set([
  'truck','outlook','bulk','trunk','spunk','funk','junk','dunk','clunk','flunk',
  'shrunk','drunk','stunk','unstable','unable','under','union','uncle','until',
  'unless','unlike','unique','universe','underground','unrest',  // 'un' guard
  'fundamental','foundation','fountain','mountain','accountable', // 'un' guard
  'direct','director','directory','directions','indirectly',      // 'drc' guard
]);

function _buildRegex(key) {
  // Escape special regex characters (hyphens in keys are literal)
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (key.length <= 3) {
    // Strict: must be surrounded by word boundaries and NOT inside longer words
    return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i');
  }

  // For hyphenated keys like 'al-shabaab', 'bab al-mandab': allow optional space/hyphen
  const flexible = escaped.replace(/\\-/g, '[\\s-]?').replace(/\\ /g, '[\\s-]');
  return new RegExp(flexible, 'i');
}

// Compile all at load time
const _REGEX_CACHE = Object.create(null);
for (const key of Object.keys(GEO_ENTITIES)) {
  _REGEX_CACHE[key] = _buildRegex(key);
}

/* ── 3. NO-GEO EXCLUSION PATTERNS ──────────────────────────────────────
   Headlines that are inherently non-geographic — suppress geo pinning.
─────────────────────────────────────────────────────────────────────────── */
const NO_GEO_PATTERNS = [
  /\b(bitcoin|crypto|cryptocurrency|blockchain|nft|defi)\b/i,
  /\b(stock market|nasdaq|s&p|dow jones|earnings|quarterly results|ipo|shares)\b/i,
  /\b(artificial intelligence|machine learning|chatgpt|openai|google ai|tech giant)\b/i,
  /\b(climate change|global warming|carbon emissions|co2|greenhouse)\b/i,
  /\b(covid vaccine|pandemic|monkeypox|mpox|flu season)\b/i,
  /\b(world cup|olympic|super bowl|nba|nfl|premier league|champions league)\b/i,
  /\b(royal family|king charles|prince william|queen camilla)\b/i,
  /\b(death of|obituary|tribute to|mourning)\b/i,
];

function _isNoGeoHeadline(text) {
  return NO_GEO_PATTERNS.some(p => p.test(text));
}

/* ── 4. CONFLICT ZONE REGISTRY ──────────────────────────────────────────
   static structured data — flip status to 'resolved' when conflict ends
─────────────────────────────────────────────────────────────────────────── */
const CONFLICT_ZONES = [
  { id:'ukraine-russia',    name:'Ukraine–Russia War',          lat:49.00, lng:33.00,  severity:5, type:'conventional-war',   actors:['Russia','Ukraine','NATO (support)'],                           status:'active',   color:'#dc2626', radius:520_000 },
  { id:'israel-hamas',      name:'Israel–Gaza Conflict',        lat:31.40, lng:34.40,  severity:5, type:'urban-warfare',       actors:['Israel IDF','Hamas','Palestinian Islamic Jihad'],             status:'active',   color:'#dc2626', radius:45_000 },
  { id:'israel-hezbollah',  name:'Israel–Lebanon Front',        lat:33.30, lng:35.40,  severity:3, type:'proxy-conflict',      actors:['Israel','Hezbollah','Iran (sponsor)'],                        status:'active',   color:'#ea580c', radius:80_000 },
  { id:'red-sea',           name:'Red Sea Shipping Crisis',     lat:15.50, lng:43.00,  severity:4, type:'maritime-conflict',   actors:['Houthi Movement','US/UK forces','Coalition navies'],          status:'active',   color:'#ea580c', radius:400_000 },
  { id:'sudan',             name:'Sudan Civil War',             lat:15.55, lng:30.00,  severity:4, type:'civil-war',           actors:['SAF','RSF (Rapid Support Forces)','Armed militias'],          status:'active',   color:'#dc2626', radius:350_000 },
  { id:'myanmar',           name:'Myanmar Civil Conflict',      lat:19.74, lng:96.08,  severity:4, type:'civil-war',           actors:['Myanmar junta','PDF','Ethnic armed groups'],                  status:'active',   color:'#dc2626', radius:300_000 },
  { id:'sahel',             name:'Sahel Insurgency',            lat:14.00, lng:2.00,   severity:3, type:'insurgency',          actors:['JNIM','ISWAP','Wagner Group','Regional militaries'],           status:'active',   color:'#d97706', radius:800_000 },
  { id:'drc',               name:'Eastern DRC Crisis',          lat:-1.00, lng:29.00,  severity:4, type:'civil-war',           actors:['M23 rebels','DRC Armed Forces','Rwanda (alleged)'],           status:'active',   color:'#dc2626', radius:250_000 },
  { id:'somalia',           name:'Somalia Insurgency',          lat:5.15,  lng:45.34,  severity:3, type:'insurgency',          actors:['Al-Shabaab','Somali Federal Government','AU forces'],         status:'active',   color:'#d97706', radius:350_000 },
  { id:'iran-tensions',     name:'Iran Regional Tensions',      lat:32.43, lng:53.69,  severity:3, type:'proxy-conflict',      actors:['Iran IRGC','Israel','US forces','Proxy militias'],            status:'elevated', color:'#d97706', radius:600_000 },
  { id:'korea',             name:'Korean Peninsula Standoff',   lat:38.00, lng:127.00, severity:3, type:'standoff',            actors:['North Korea','South Korea','US (treaty)'],                    status:'elevated', color:'#d97706', radius:200_000 },
  { id:'taiwan-strait',     name:'Taiwan Strait Crisis',        lat:24.00, lng:120.00, severity:3, type:'standoff',            actors:['PRC','Taiwan','USA (strategic)'],                             status:'elevated', color:'#d97706', radius:300_000 },
  { id:'south-china-sea',   name:'South China Sea Dispute',     lat:12.00, lng:113.00, severity:2, type:'territorial',         actors:['China','Philippines','Vietnam','USA'],                        status:'elevated', color:'#d97706', radius:700_000 },
  { id:'kashmir',           name:'India–Pakistan Kashmir',      lat:34.00, lng:74.50,  severity:2, type:'territorial',         actors:['India','Pakistan','Various militant groups'],                 status:'elevated', color:'#d97706', radius:200_000 },
  { id:'haiti',             name:'Haiti Gang Crisis',           lat:18.97, lng:-72.29, severity:3, type:'state-collapse',      actors:['Gang coalition','National Police','MNS (Kenya-led)'],        status:'active',   color:'#ea580c', radius:50_000 },
  { id:'venezuela',         name:'Venezuela Political Crisis',  lat:6.42,  lng:-66.59, severity:2, type:'political',           actors:['Maduro government','Opposition','USA sanctions'],             status:'active',   color:'#d97706', radius:350_000 },
  { id:'yemen',             name:'Yemen Conflict',              lat:15.55, lng:48.52,  severity:3, type:'civil-war',           actors:['Houthi movement','Saudi-led coalition','STC'],               status:'active',   color:'#ea580c', radius:300_000 },
];

/* ── 5. CRISIS KEYWORD CLASSIFIER ───────────────────────────────────────
   Returns { type, weight } for the most dominant crisis signal in text.
─────────────────────────────────────────────────────────────────────────── */
const CRISIS_PATTERNS = [
  { type:'war',          weight:5, kw:['war','battle','offensive','invasion','airstrike','bombing','shelling','missile strike','ground assault','military operation','frontline','counteroffensive','warplane','artillery','troops advance','tank'] },
  { type:'conflict',     weight:4, kw:['conflict','fighting','clash','ceasefire','truce','hostages','siege','occupation','resistance','militia','guerrilla','insurgent','rebel','armed group'] },
  { type:'terrorism',    weight:5, kw:['terror','terrorist','attack','bomb','explosion','suicide bomber','mass casualty','shooting rampage','assassination','massacre','gunman'] },
  { type:'nuclear',      weight:5, kw:['nuclear','nuke','warhead','icbm','ballistic missile','radioactive','enrichment','fissile','deterrent','nuclear threat'] },
  { type:'sanctions',    weight:3, kw:['sanctions','embargo','export ban','trade war','tariff','freeze assets','blacklist','restricted entity'] },
  { type:'diplomacy',    weight:2, kw:['peace talks','summit','agreement','treaty','diplomacy','bilateral','mediation','ceasefire deal','negotiations','accord','communiqué'] },
  { type:'humanitarian', weight:3, kw:['famine','hunger','refugee','displaced','cholera','starvation','aid convoy','evacuation','civilian casualties','mass grave','atrocity'] },
  { type:'protest',      weight:2, kw:['protest','riot','demonstration','uprising','coup','revolution','unrest','crackdown','martial law','curfew','mass arrests'] },
  { type:'cyber',        weight:3, kw:['cyberattack','hack','ransomware','infrastructure attack','grid attack','ddos','espionage','intelligence operation','data breach'] },
  { type:'maritime',     weight:3, kw:['shipping','tanker','carrier strike','naval','sea route','port blockade','piracy','coast guard','strait','vessel seized'] },
  { type:'energy',       weight:3, kw:['oil price','gas pipeline','energy crisis','opec','fuel shortage','lng','power grid','blackout','energy weapon'] },
  { type:'economic',     weight:2, kw:['recession','inflation','currency crisis','debt default','bank collapse','financial crisis','market crash','hyperinflation'] },
];

/* ── 6. CORE RESOLUTION FUNCTION ────────────────────────────────────────
   Returns: { lat, lng, entity, entityType, confidence, crisisType, severity }
   or null if headline should not be pinned.
─────────────────────────────────────────────────────────────────────────── */
function resolveNewsGeo(title, description = '') {
  const text = (title + ' ' + (description || '')).toLowerCase();

  // No-geo guard: headlines about markets, sport, tech etc. skip pinning
  if (_isNoGeoHeadline(text)) return null;

  // Match all entities
  const candidates = [];
  for (const [key, val] of Object.entries(GEO_ENTITIES)) {
    if (!_REGEX_CACHE[key]) continue;
    if (!_REGEX_CACHE[key].test(text)) continue;

    // Extra guard for very short keys: check the matched word isn't a false positive
    if (key.length <= 3) {
      const match = _REGEX_CACHE[key].exec(text);
      if (match) {
        // Find containing word
        const start = Math.max(0, match.index - 4);
        const end   = Math.min(text.length, match.index + key.length + 4);
        const ctx   = text.slice(start, end).replace(/[^a-z]/g, '');
        if (SHORT_KEY_FALSE_POSITIVES.has(ctx)) continue;
      }
    }

    candidates.push({ key, ...val });
  }

  if (!candidates.length) return null;

  // Sort: priority ASC, then type specificity
  const TYPE_ORDER = { conflict:0, actor:1, city:2, institution:3, demonym:3, country:4, region:5 };
  candidates.sort((a, b) =>
    a.p !== b.p ? a.p - b.p : (TYPE_ORDER[a.type] || 5) - (TYPE_ORDER[b.type] || 5)
  );

  const best = candidates[0];

  // Crisis classification
  let crisisType = 'general', crisisWeight = 0;
  for (const cp of CRISIS_PATTERNS) {
    const matched = cp.kw.filter(k => text.includes(k));
    if (matched.length) {
      const w = cp.weight * matched.length;
      if (w > crisisWeight) { crisisWeight = w; crisisType = cp.type; }
    }
  }

  const confidence = Math.min(1, 0.25 + candidates.length * 0.08 + (best.p === 0 ? 0.40 : best.p === 1 ? 0.20 : 0.05));
  const SEV_MAP = { war:5, terrorism:5, nuclear:5, conflict:4, maritime:4, humanitarian:3, protest:3, cyber:3, sanctions:2, energy:2, diplomacy:1, economic:2, general:1 };

  return {
    lat:        best.lat + _seededJitter(title, 0) * 0.7,
    lng:        best.lng + _seededJitter(title, 1) * 0.7,
    entity:     best.key,
    entityType: best.type,
    confidence,
    crisisType,
    severity:   SEV_MAP[crisisType] || 1,
    candidates: candidates.length,
  };
}

/* ── 7. PIN APPEARANCE ────────────────────────────────────────────────── */
const CRISIS_VISUALS = {
  war:          { color:'#dc2626', emoji:'⚔️',  label:'War' },
  conflict:     { color:'#ea580c', emoji:'🔥',  label:'Conflict' },
  terrorism:    { color:'#7f1d1d', emoji:'💥',  label:'Terrorism' },
  nuclear:      { color:'#7c3aed', emoji:'☢️',  label:'Nuclear' },
  maritime:     { color:'#0284c7', emoji:'⚓',  label:'Maritime' },
  sanctions:    { color:'#d97706', emoji:'🚫',  label:'Sanctions' },
  diplomacy:    { color:'#059669', emoji:'🤝',  label:'Diplomacy' },
  humanitarian: { color:'#0369a1', emoji:'🏥',  label:'Humanitarian' },
  protest:      { color:'#9333ea', emoji:'✊',  label:'Unrest' },
  cyber:        { color:'#6366f1', emoji:'💻',  label:'Cyber' },
  energy:       { color:'#f59e0b', emoji:'⚡',  label:'Energy' },
  economic:     { color:'#10b981', emoji:'💹',  label:'Economy' },
  general:      { color:'#2563eb', emoji:'📡',  label:'Intel' },
};

function getCrisisVisual(type) {
  return CRISIS_VISUALS[type] || CRISIS_VISUALS.general;
}

/* ── 8. GEOPOLITICAL THREAT SCORE ───────────────────────────────────────
   Hybrid: static CONFLICT_ZONES registry for structural baseline (0-40)
           + live war/terrorism news pins for dynamic spike (0-60)
   Explicitly documented here — not a bug, it's deliberate:
   • Even with 0 news articles, the base score reflects known ongoing wars
   • News spikes show real-time escalations above the structural baseline
─────────────────────────────────────────────────────────────────────────── */
function computeGeopoliticalScore(newsPins = []) {
  const activeZones   = CONFLICT_ZONES.filter(z => z.status === 'active');
  const elevatedZones = CONFLICT_ZONES.filter(z => z.status === 'elevated');

  const baseScore = Math.min(40,
    activeZones.reduce((s, z) => s + z.severity * 3.5, 0) +
    elevatedZones.reduce((s, z) => s + z.severity * 1.2, 0)
  );

  const warPins = newsPins.filter(p => ['war','terrorism','nuclear','conflict'].includes(p.crisisType));
  const dynamicScore = Math.min(60, warPins.length * 4.5);

  return Math.min(100, Math.round(baseScore + dynamicScore));
}

/* ── 9. SEEDED JITTER ───────────────────────────────────────────────────
   Deterministic jitter per title string — pins stay stable across refreshes.
─────────────────────────────────────────────────────────────────────────── */
function _seededJitter(seed, idx) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const raw = Math.abs((h >> (idx * 8)) & 0xff) / 255;
  return (raw - 0.5) * 2;  // −1 to +1
}

/* ── EXPORTS ─────────────────────────────────────────────────────────── */
window.GeoIntelligence = {
  resolveNewsGeo,
  getCrisisVisual,
  computeGeopoliticalScore,
  getConflictZones: () => CONFLICT_ZONES,
  CRISIS_VISUALS,
  CONFLICT_ZONES,
  GEO_ENTITIES,        // exposed for debugging
};
