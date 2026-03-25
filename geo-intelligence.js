'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   BACKSTAX · GEO-INTELLIGENCE ENGINE v4
   ─────────────────────────────────────────────────────────────────────────
   Responsibilities:
   • Comprehensive geo-entity resolution (country, city, region, conflict zone)
   • Crisis / conflict classification & severity scoring
   • News article → precise lat/lng mapping with confidence scoring
   • Conflict zone registry with live status support
   • Geopolitical threat dimension for the Global Pulse system
   ─────────────────────────────────────────────────────────────────────────
   Design: Zero external deps. Pure deterministic JS.
   All coordinates are [lat, lng] pairs.
═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. ENTITY DATABASE ─────────────────────────────────────────────────
   Ordered from most-specific (cities) to most-general (continents).
   Each entry: { lat, lng, priority, type }
   priority: lower = checked first in disambiguation
─────────────────────────────────────────────────────────────────────────── */
const GEO_ENTITIES = {
  /* ── ACTIVE CONFLICT ZONES (highest priority) ─── */
  'gaza':         { lat: 31.35,  lng: 34.31,  p: 0, type: 'conflict' },
  'west bank':    { lat: 31.90,  lng: 35.20,  p: 0, type: 'conflict' },
  'rafah':        { lat: 31.28,  lng: 34.25,  p: 0, type: 'conflict' },
  'khan younis':  { lat: 31.35,  lng: 34.30,  p: 0, type: 'conflict' },
  'donbas':       { lat: 48.00,  lng: 37.80,  p: 0, type: 'conflict' },
  'donetsk':      { lat: 48.02,  lng: 37.80,  p: 0, type: 'conflict' },
  'zaporizhzhia': { lat: 47.84,  lng: 35.14,  p: 0, type: 'conflict' },
  'kherson':      { lat: 46.64,  lng: 32.62,  p: 0, type: 'conflict' },
  'kharkiv':      { lat: 49.99,  lng: 36.23,  p: 0, type: 'conflict' },
  'bakhmut':      { lat: 48.59,  lng: 37.99,  p: 0, type: 'conflict' },
  'avdiivka':     { lat: 48.14,  lng: 37.74,  p: 0, type: 'conflict' },
  'mariupol':     { lat: 47.10,  lng: 37.55,  p: 0, type: 'conflict' },
  'kyiv':         { lat: 50.45,  lng: 30.52,  p: 0, type: 'city' },
  'odesa':        { lat: 46.48,  lng: 30.72,  p: 0, type: 'city' },
  'sudan':        { lat: 15.55,  lng: 32.53,  p: 0, type: 'conflict' },
  'khartoum':     { lat: 15.55,  lng: 32.53,  p: 0, type: 'city' },
  'darfur':       { lat: 13.50,  lng: 24.00,  p: 0, type: 'conflict' },
  'sahel':        { lat: 14.00,  lng: 2.00,   p: 0, type: 'conflict' },
  'mali':         { lat: 17.57,  lng: -3.99,  p: 0, type: 'country' },
  'burkina faso': { lat: 12.36,  lng: -1.53,  p: 0, type: 'conflict' },
  'niger':        { lat: 17.61,  lng: 8.08,   p: 0, type: 'country' },
  'somalia':      { lat: 5.15,   lng: 46.20,  p: 0, type: 'conflict' },
  'mogadishu':    { lat: 2.05,   lng: 45.34,  p: 0, type: 'city' },
  'myanmar':      { lat: 19.74,  lng: 96.08,  p: 0, type: 'conflict' },
  'rakhine':      { lat: 20.10,  lng: 92.90,  p: 0, type: 'conflict' },
  'naypyidaw':    { lat: 19.74,  lng: 96.08,  p: 0, type: 'city' },
  'haiti':        { lat: 18.97,  lng: -72.29, p: 0, type: 'conflict' },
  'port-au-prince':{ lat: 18.54, lng: -72.34, p: 0, type: 'city' },
  'kashmir':      { lat: 34.08,  lng: 74.79,  p: 0, type: 'conflict' },
  'line of control':{ lat: 34.00,lng: 74.50,  p: 0, type: 'conflict' },
  'taiwan strait':{ lat: 24.00,  lng: 119.00, p: 0, type: 'conflict' },
  'south china sea':{ lat: 12.00,lng: 113.00, p: 0, type: 'conflict' },
  'nagorno-karabakh':{ lat:40.00,lng: 46.50,  p: 0, type: 'conflict' },
  'tigray':       { lat: 14.00,  lng: 38.50,  p: 0, type: 'conflict' },
  'ethiopia':     { lat: 9.14,   lng: 40.49,  p: 0, type: 'country' },
  'addis ababa':  { lat: 9.03,   lng: 38.74,  p: 0, type: 'city' },
  'yemen':        { lat: 15.55,  lng: 48.52,  p: 0, type: 'conflict' },
  'sanaa':        { lat: 15.35,  lng: 44.21,  p: 0, type: 'city' },
  'hodeida':      { lat: 14.80,  lng: 42.95,  p: 0, type: 'city' },
  'aden':         { lat: 12.78,  lng: 45.04,  p: 0, type: 'city' },
  'congo':        { lat: -4.04,  lng: 21.76,  p: 0, type: 'conflict' },
  'drc':          { lat: -4.04,  lng: 21.76,  p: 0, type: 'conflict' },
  'kinshasa':     { lat: -4.32,  lng: 15.32,  p: 0, type: 'city' },
  'goma':         { lat: -1.67,  lng: 29.22,  p: 0, type: 'conflict' },
  'hamas':        { lat: 31.35,  lng: 34.31,  p: 0, type: 'actor' },
  'hezbollah':    { lat: 33.89,  lng: 35.50,  p: 0, type: 'actor' },
  'houthi':       { lat: 15.55,  lng: 44.20,  p: 0, type: 'actor' },
  'houthis':      { lat: 15.55,  lng: 44.20,  p: 0, type: 'actor' },
  'wagner':       { lat: 14.00,  lng: 2.00,   p: 0, type: 'actor' },
  'isis':         { lat: 34.80,  lng: 39.00,  p: 0, type: 'actor' },
  'islamic state':{ lat: 34.80,  lng: 39.00,  p: 0, type: 'actor' },
  'al-shabaab':   { lat: 5.15,   lng: 46.20,  p: 0, type: 'actor' },
  'boko haram':   { lat: 11.85,  lng: 13.16,  p: 0, type: 'actor' },
  'red sea':      { lat: 20.00,  lng: 38.00,  p: 0, type: 'region' },
  'strait of hormuz':{ lat:26.57,lng: 56.45,  p: 0, type: 'region' },
  'suez canal':   { lat: 30.50,  lng: 32.35,  p: 0, type: 'region' },
  'bab al-mandab':{ lat: 12.58,  lng: 43.44,  p: 0, type: 'region' },

  /* ── GEOPOLITICAL HOTSPOTS ─── */
  'iran':         { lat: 32.43,  lng: 53.69,  p: 1, type: 'country' },
  'tehran':       { lat: 35.69,  lng: 51.39,  p: 1, type: 'city' },
  'israel':       { lat: 31.05,  lng: 34.85,  p: 1, type: 'country' },
  'tel aviv':     { lat: 32.09,  lng: 34.79,  p: 1, type: 'city' },
  'jerusalem':    { lat: 31.77,  lng: 35.22,  p: 1, type: 'city' },
  'lebanon':      { lat: 33.89,  lng: 35.50,  p: 1, type: 'country' },
  'beirut':       { lat: 33.89,  lng: 35.50,  p: 1, type: 'city' },
  'syria':        { lat: 34.80,  lng: 38.99,  p: 1, type: 'country' },
  'damascus':     { lat: 33.51,  lng: 36.29,  p: 1, type: 'city' },
  'aleppo':       { lat: 36.20,  lng: 37.16,  p: 1, type: 'city' },
  'iraq':         { lat: 33.22,  lng: 43.68,  p: 1, type: 'country' },
  'baghdad':      { lat: 33.34,  lng: 44.40,  p: 1, type: 'city' },
  'mosul':        { lat: 36.33,  lng: 43.12,  p: 1, type: 'city' },
  'ukraine':      { lat: 49.00,  lng: 32.00,  p: 1, type: 'country' },
  'russia':       { lat: 61.52,  lng: 105.32, p: 1, type: 'country' },
  'moscow':       { lat: 55.75,  lng: 37.62,  p: 1, type: 'city' },
  'st. petersburg':{ lat:59.95,  lng: 30.32,  p: 1, type: 'city' },
  'north korea':  { lat: 40.34,  lng: 127.51, p: 1, type: 'country' },
  'pyongyang':    { lat: 39.02,  lng: 125.75, p: 1, type: 'city' },
  'china':        { lat: 35.86,  lng: 104.20, p: 1, type: 'country' },
  'beijing':      { lat: 39.91,  lng: 116.39, p: 1, type: 'city' },
  'taiwan':       { lat: 23.70,  lng: 120.96, p: 1, type: 'country' },
  'taipei':       { lat: 25.04,  lng: 121.56, p: 1, type: 'city' },
  'pakistan':     { lat: 30.38,  lng: 69.35,  p: 1, type: 'country' },
  'islamabad':    { lat: 33.72,  lng: 73.04,  p: 1, type: 'city' },
  'venezuela':    { lat: 6.42,   lng: -66.59, p: 1, type: 'country' },
  'caracas':      { lat: 10.48,  lng: -66.88, p: 1, type: 'city' },
  'nicaragua':    { lat: 12.87,  lng: -85.21, p: 1, type: 'country' },
  'cuba':         { lat: 21.52,  lng: -77.78, p: 1, type: 'country' },
  'havana':       { lat: 23.13,  lng: -82.38, p: 1, type: 'city' },

  /* ── GLOBAL INSTITUTIONS & STRATEGIC LOCATIONS ─── */
  'nato':         { lat: 50.88,  lng: 4.32,   p: 2, type: 'institution' },
  'un':           { lat: 40.75,  lng: -73.97, p: 2, type: 'institution' },
  'united nations':{ lat:40.75,  lng: -73.97, p: 2, type: 'institution' },
  'pentagon':     { lat: 38.87,  lng: -77.06, p: 2, type: 'institution' },
  'g7':           { lat: 48.86,  lng: 2.35,   p: 2, type: 'institution' },
  'g20':          { lat: 40.75,  lng: -73.97, p: 2, type: 'institution' },
  'imf':          { lat: 38.90,  lng: -77.04, p: 2, type: 'institution' },
  'world bank':   { lat: 38.90,  lng: -77.04, p: 2, type: 'institution' },
  'brics':        { lat: 25.20,  lng: 55.27,  p: 2, type: 'institution' },
  'opec':         { lat: 48.20,  lng: 16.37,  p: 2, type: 'institution' },
  'arctic':       { lat: 80.00,  lng: 0.00,   p: 2, type: 'region' },
  'antarctica':   { lat: -80.00, lng: 0.00,   p: 2, type: 'region' },
  'pacific':      { lat: 0.00,   lng: -160.00,p: 2, type: 'region' },
  'atlantic':     { lat: 20.00,  lng: -30.00, p: 2, type: 'region' },
  'indian ocean': { lat: -20.00, lng: 75.00,  p: 2, type: 'region' },

  /* ── MAJOR COUNTRIES ─── */
  'usa':          { lat: 38.89,  lng: -77.04, p: 3, type: 'country' },
  'america':      { lat: 38.89,  lng: -77.04, p: 3, type: 'country' },
  'washington':   { lat: 38.89,  lng: -77.04, p: 3, type: 'city' },
  'new york':     { lat: 40.71,  lng: -74.01, p: 3, type: 'city' },
  'united states':{ lat: 38.89,  lng: -77.04, p: 3, type: 'country' },
  'uk':           { lat: 51.51,  lng: -0.13,  p: 3, type: 'country' },
  'britain':      { lat: 51.51,  lng: -0.13,  p: 3, type: 'country' },
  'england':      { lat: 51.51,  lng: -0.13,  p: 3, type: 'country' },
  'london':       { lat: 51.51,  lng: -0.13,  p: 3, type: 'city' },
  'france':       { lat: 46.23,  lng: 2.21,   p: 3, type: 'country' },
  'paris':        { lat: 48.86,  lng: 2.35,   p: 3, type: 'city' },
  'germany':      { lat: 51.17,  lng: 10.45,  p: 3, type: 'country' },
  'berlin':       { lat: 52.52,  lng: 13.40,  p: 3, type: 'city' },
  'europe':       { lat: 54.53,  lng: 15.25,  p: 3, type: 'region' },
  'india':        { lat: 20.59,  lng: 78.96,  p: 3, type: 'country' },
  'new delhi':    { lat: 28.61,  lng: 77.21,  p: 3, type: 'city' },
  'mumbai':       { lat: 19.08,  lng: 72.88,  p: 3, type: 'city' },
  'japan':        { lat: 36.20,  lng: 138.25, p: 3, type: 'country' },
  'tokyo':        { lat: 35.68,  lng: 139.69, p: 3, type: 'city' },
  'south korea':  { lat: 35.91,  lng: 127.77, p: 3, type: 'country' },
  'seoul':        { lat: 37.57,  lng: 126.98, p: 3, type: 'city' },
  'australia':    { lat: -25.27, lng: 133.78, p: 3, type: 'country' },
  'canberra':     { lat: -35.28, lng: 149.13, p: 3, type: 'city' },
  'sydney':       { lat: -33.87, lng: 151.21, p: 3, type: 'city' },
  'brazil':       { lat: -14.24, lng: -51.93, p: 3, type: 'country' },
  'brasilia':     { lat: -15.78, lng: -47.93, p: 3, type: 'city' },
  'mexico':       { lat: 23.63,  lng: -102.55,p: 3, type: 'country' },
  'mexico city':  { lat: 19.43,  lng: -99.13, p: 3, type: 'city' },
  'canada':       { lat: 56.13,  lng: -106.35,p: 3, type: 'country' },
  'ottawa':       { lat: 45.42,  lng: -75.70, p: 3, type: 'city' },
  'turkey':       { lat: 38.96,  lng: 35.24,  p: 3, type: 'country' },
  'ankara':       { lat: 39.93,  lng: 32.85,  p: 3, type: 'city' },
  'istanbul':     { lat: 41.01,  lng: 28.95,  p: 3, type: 'city' },
  'saudi arabia': { lat: 23.89,  lng: 45.08,  p: 3, type: 'country' },
  'riyadh':       { lat: 24.69,  lng: 46.72,  p: 3, type: 'city' },
  'egypt':        { lat: 26.82,  lng: 30.80,  p: 3, type: 'country' },
  'cairo':        { lat: 30.05,  lng: 31.25,  p: 3, type: 'city' },
  'south africa': { lat: -30.56, lng: 22.94,  p: 3, type: 'country' },
  'nigeria':      { lat: 9.08,   lng: 8.68,   p: 3, type: 'country' },
  'abuja':        { lat: 9.07,   lng: 7.40,   p: 3, type: 'city' },
  'kenya':        { lat: -0.02,  lng: 37.91,  p: 3, type: 'country' },
  'nairobi':      { lat: -1.29,  lng: 36.82,  p: 3, type: 'city' },
  'indonesia':    { lat: -0.79,  lng: 113.92, p: 3, type: 'country' },
  'jakarta':      { lat: -6.21,  lng: 106.85, p: 3, type: 'city' },
  'philippines':  { lat: 12.88,  lng: 121.77, p: 3, type: 'country' },
  'manila':       { lat: 14.60,  lng: 120.98, p: 3, type: 'city' },
  'thailand':     { lat: 15.87,  lng: 100.99, p: 3, type: 'country' },
  'bangkok':      { lat: 13.75,  lng: 100.52, p: 3, type: 'city' },
  'vietnam':      { lat: 14.06,  lng: 108.28, p: 3, type: 'country' },
  'hanoi':        { lat: 21.03,  lng: 105.83, p: 3, type: 'city' },
  'poland':       { lat: 51.92,  lng: 19.14,  p: 3, type: 'country' },
  'warsaw':       { lat: 52.23,  lng: 21.01,  p: 3, type: 'city' },
  'hungary':      { lat: 47.16,  lng: 19.50,  p: 3, type: 'country' },
  'budapest':     { lat: 47.50,  lng: 19.04,  p: 3, type: 'city' },
  'serbia':       { lat: 44.02,  lng: 21.01,  p: 3, type: 'country' },
  'belgrade':     { lat: 44.80,  lng: 20.46,  p: 3, type: 'city' },
  'finland':      { lat: 61.92,  lng: 25.75,  p: 3, type: 'country' },
  'sweden':       { lat: 60.13,  lng: 18.64,  p: 3, type: 'country' },
  'balkans':      { lat: 43.00,  lng: 20.00,  p: 3, type: 'region' },
  'caucasus':     { lat: 42.00,  lng: 44.00,  p: 3, type: 'region' },
  'central asia': { lat: 46.00,  lng: 64.00,  p: 3, type: 'region' },
  'sub-saharan africa':{ lat: -5.00, lng:20.00, p: 3, type:'region' },
  'horn of africa':{ lat: 8.00,  lng: 44.00,  p: 3, type: 'region' },
  'middle east':  { lat: 29.31,  lng: 42.46,  p: 3, type: 'region' },
  'southeast asia':{ lat: 10.00, lng: 106.00, p: 3, type: 'region' },
  'latin america':{ lat: -10.00, lng: -60.00, p: 3, type: 'region' },
  'south america':{ lat: -14.00, lng: -51.00, p: 3, type: 'region' },
  'north africa': { lat: 27.00,  lng: 13.00,  p: 3, type: 'region' },
  'west africa':  { lat: 7.00,   lng: -2.00,  p: 3, type: 'region' },
  'east africa':  { lat: -1.00,  lng: 36.00,  p: 3, type: 'region' },
  'central africa':{ lat: 0.00,  lng: 22.00,  p: 3, type: 'region' },
  'africa':       { lat: -8.78,  lng: 34.51,  p: 3, type: 'region' },

  /* ── CRISIS KEYWORDS → locations ─── */
  'crimea':       { lat: 45.34,  lng: 34.10,  p: 1, type: 'conflict' },
  'taiwan':       { lat: 23.70,  lng: 120.96, p: 1, type: 'country' },
  'xinjiang':     { lat: 42.52,  lng: 87.34,  p: 1, type: 'region' },
  'tibet':        { lat: 31.69,  lng: 88.15,  p: 1, type: 'region' },
  'chechnya':     { lat: 43.40,  lng: 45.72,  p: 1, type: 'conflict' },
  'nagaland':     { lat: 26.16,  lng: 94.56,  p: 1, type: 'conflict' },
  'balochistan':  { lat: 28.49,  lng: 65.10,  p: 1, type: 'conflict' },
  'waziristan':   { lat: 32.30,  lng: 69.80,  p: 1, type: 'conflict' },
  'naxalite':     { lat: 20.00,  lng: 82.00,  p: 1, type: 'conflict' },
  'mindanao':     { lat: 8.00,   lng: 125.00, p: 1, type: 'conflict' },
  'chiapas':      { lat: 16.76,  lng: -92.64, p: 1, type: 'conflict' },
  'oaxaca':       { lat: 17.07,  lng: -96.72, p: 1, type: 'city' },
};

/* ── 2. CONFLICT ZONE REGISTRY ──────────────────────────────────────────
   Static structured data for known/potential conflict zones.
   Each zone has severity [1-5], type, actors, and a stable centroid.
─────────────────────────────────────────────────────────────────────────── */
const CONFLICT_ZONES = [
  {
    id: 'ukraine-russia',
    name: 'Ukraine–Russia War',
    lat: 49.00, lng: 33.00,
    severity: 5,
    type: 'conventional-war',
    actors: ['Russia', 'Ukraine', 'NATO (support)'],
    status: 'active',
    color: '#dc2626',
    radius: 520_000,
  },
  {
    id: 'israel-hamas',
    name: 'Israel–Gaza Conflict',
    lat: 31.40, lng: 34.40,
    severity: 5,
    type: 'urban-warfare',
    actors: ['Israel IDF', 'Hamas', 'Palestinian Islamic Jihad'],
    status: 'active',
    color: '#dc2626',
    radius: 45_000,
  },
  {
    id: 'israel-hezbollah',
    name: 'Israel–Lebanon Front',
    lat: 33.30, lng: 35.40,
    severity: 3,
    type: 'proxy-conflict',
    actors: ['Israel', 'Hezbollah', 'Iran (sponsor)'],
    status: 'active',
    color: '#ea580c',
    radius: 80_000,
  },
  {
    id: 'red-sea',
    name: 'Red Sea Shipping Crisis',
    lat: 15.50, lng: 43.00,
    severity: 4,
    type: 'maritime-conflict',
    actors: ['Houthi Movement', 'US/UK forces', 'Coalition navies'],
    status: 'active',
    color: '#ea580c',
    radius: 400_000,
  },
  {
    id: 'sudan',
    name: 'Sudan Civil War',
    lat: 15.55, lng: 30.00,
    severity: 4,
    type: 'civil-war',
    actors: ['SAF', 'RSF (Rapid Support Forces)', 'Armed militias'],
    status: 'active',
    color: '#dc2626',
    radius: 350_000,
  },
  {
    id: 'myanmar',
    name: 'Myanmar Civil Conflict',
    lat: 19.74, lng: 96.08,
    severity: 4,
    type: 'civil-war',
    actors: ['Myanmar military junta', 'PDF', 'Ethnic armed groups'],
    status: 'active',
    color: '#dc2626',
    radius: 300_000,
  },
  {
    id: 'sahel',
    name: 'Sahel Insurgency',
    lat: 14.00, lng: 2.00,
    severity: 3,
    type: 'insurgency',
    actors: ['JNIM', 'ISWAP', 'Wagner Group', 'Regional militaries'],
    status: 'active',
    color: '#d97706',
    radius: 800_000,
  },
  {
    id: 'drc',
    name: 'Eastern DRC Crisis',
    lat: -1.00, lng: 29.00,
    severity: 4,
    type: 'civil-war',
    actors: ['M23 rebels', 'DRC Armed Forces', 'Rwanda (alleged)'],
    status: 'active',
    color: '#dc2626',
    radius: 250_000,
  },
  {
    id: 'somalia',
    name: 'Somalia Insurgency',
    lat: 5.15, lng: 45.34,
    severity: 3,
    type: 'insurgency',
    actors: ['Al-Shabaab', 'Somali Federal Government', 'AU forces'],
    status: 'active',
    color: '#d97706',
    radius: 350_000,
  },
  {
    id: 'iran-tensions',
    name: 'Iran Regional Tensions',
    lat: 32.43, lng: 53.69,
    severity: 3,
    type: 'proxy-conflict',
    actors: ['Iran IRGC', 'Israel', 'US forces', 'Proxy militias'],
    status: 'elevated',
    color: '#d97706',
    radius: 600_000,
  },
  {
    id: 'korea',
    name: 'Korean Peninsula Standoff',
    lat: 38.00, lng: 127.00,
    severity: 3,
    type: 'standoff',
    actors: ['North Korea', 'South Korea', 'US (treaty)'],
    status: 'elevated',
    color: '#d97706',
    radius: 200_000,
  },
  {
    id: 'taiwan-strait',
    name: 'Taiwan Strait Crisis',
    lat: 24.00, lng: 120.00,
    severity: 3,
    type: 'standoff',
    actors: ['PRC', 'Taiwan', 'USA (strategic)'],
    status: 'elevated',
    color: '#d97706',
    radius: 300_000,
  },
  {
    id: 'south-china-sea',
    name: 'South China Sea Dispute',
    lat: 12.00, lng: 113.00,
    severity: 2,
    type: 'territorial',
    actors: ['China', 'Philippines', 'Vietnam', 'USA'],
    status: 'elevated',
    color: '#d97706',
    radius: 700_000,
  },
  {
    id: 'kashmir',
    name: 'India–Pakistan Kashmir',
    lat: 34.00, lng: 74.50,
    severity: 2,
    type: 'territorial',
    actors: ['India', 'Pakistan', 'Various militant groups'],
    status: 'elevated',
    color: '#d97706',
    radius: 200_000,
  },
  {
    id: 'haiti',
    name: 'Haiti Gang Crisis',
    lat: 18.97, lng: -72.29,
    severity: 3,
    type: 'state-collapse',
    actors: ['Gang coalition', 'National Police', 'MNS (Kenya-led)'],
    status: 'active',
    color: '#ea580c',
    radius: 50_000,
  },
  {
    id: 'venezuela',
    name: 'Venezuela Political Crisis',
    lat: 6.42, lng: -66.59,
    severity: 2,
    type: 'political',
    actors: ['Maduro government', 'Opposition', 'USA sanctions'],
    status: 'active',
    color: '#d97706',
    radius: 350_000,
  },
  {
    id: 'yemen',
    name: 'Yemen Conflict',
    lat: 15.55, lng: 48.52,
    severity: 3,
    type: 'civil-war',
    actors: ['Houthi movement', 'Saudi-led coalition', 'STC'],
    status: 'active',
    color: '#ea580c',
    radius: 300_000,
  },
];

/* ── 3. CRISIS KEYWORD CLASSIFIER ───────────────────────────────────────
   Categorises a news headline into crisis types with confidence
─────────────────────────────────────────────────────────────────────────── */
const CRISIS_PATTERNS = [
  { type:'war',          weight:5, keywords:['war','battle','offensive','troops','invasion','airstrike','bombing','shelling','missile strike','naval attack','ground assault','military operation','frontline','counteroffensive'] },
  { type:'conflict',     weight:4, keywords:['conflict','fighting','clash','ceasefire','truce','hostages','siege','occupation','resistance','militia','guerrilla','insurgent','rebel'] },
  { type:'terrorism',    weight:5, keywords:['terror','terrorist','attack','bomb','explosion','suicide bomber','mass casualty','shooting','assassination','massacre'] },
  { type:'nuclear',      weight:5, keywords:['nuclear','nuke','warhead','icbm','ballistic missile','radioactive','reactor','enrichment','deterrent'] },
  { type:'sanctions',    weight:3, keywords:['sanctions','embargo','export ban','trade war','tariff','freeze assets','blacklist'] },
  { type:'diplomacy',    weight:2, keywords:['peace talks','summit','agreement','treaty','diplomacy','bilateral','mediation','ceasefire','negotiations','deal','accord'] },
  { type:'humanitarian', weight:3, keywords:['famine','hunger','refugee','displaced','cholera','starvation','aid convoy','evacuation','civilian casualties','mass grave'] },
  { type:'protest',      weight:2, keywords:['protest','riot','demonstration','uprising','coup','revolution','unrest','crackdown','martial law','curfew'] },
  { type:'cyber',        weight:3, keywords:['cyberattack','hack','ransomware','infrastructure attack','grid attack','ddos','espionage','intelligence operation'] },
  { type:'maritime',     weight:3, keywords:['shipping','tanker','carrier strike','naval','sea route','port blockade','piracy','coast guard','strait'] },
  { type:'energy',       weight:3, keywords:['oil price','gas pipeline','energy crisis','opec','fuel','lng','power grid','blackout'] },
  { type:'economic',     weight:2, keywords:['recession','inflation','currency crisis','debt default','bank collapse','financial crisis','market crash'] },
];

/* ── 4. CORE RESOLUTION FUNCTION ────────────────────────────────────────
   Returns: { lat, lng, entity, confidence, crisisType, severity }
─────────────────────────────────────────────────────────────────────────── */
function resolveNewsGeo(title, description = '') {
  const text = (title + ' ' + description).toLowerCase();
  const words = text.replace(/[^\w\s-]/g, ' ');

  // Try progressively from specific → general (priority 0 → 3)
  // Build candidate list: all entity matches with their priority
  const candidates = [];
  for (const [key, val] of Object.entries(GEO_ENTITIES)) {
    // Use word-boundary-aware match for short keys
    const pattern = key.length <= 3
      ? new RegExp(`\\b${key}\\b`, 'i')
      : new RegExp(key.replace(/[-]/g, '[-]?'), 'i');
    if (pattern.test(text)) {
      candidates.push({ key, ...val });
    }
  }

  if (!candidates.length) return null;

  // Sort by priority (ascending), then by entity type specificity
  candidates.sort((a, b) => {
    if (a.p !== b.p) return a.p - b.p;
    const typeOrder = { conflict:0, actor:1, city:2, institution:3, country:4, region:5 };
    return (typeOrder[a.type]||5) - (typeOrder[b.type]||5);
  });

  const best = candidates[0];

  // Crisis classification
  let crisisType = 'general';
  let crisisWeight = 0;
  for (const cp of CRISIS_PATTERNS) {
    const matched = cp.keywords.filter(k => text.includes(k));
    if (matched.length > 0) {
      const w = cp.weight * matched.length;
      if (w > crisisWeight) { crisisWeight = w; crisisType = cp.type; }
    }
  }

  // Confidence: more candidates matching = higher confidence in geo pin
  const confidence = Math.min(1, 0.3 + candidates.length * 0.1 + (best.p === 0 ? 0.4 : best.p === 1 ? 0.2 : 0));

  // Severity based on crisis type weight and entity type
  const severityMap = { war:5, terrorism:5, nuclear:5, conflict:4, maritime:4, humanitarian:3, protest:3, cyber:3, sanctions:2, energy:2, diplomacy:1, economic:2, general:1 };

  return {
    lat: best.lat + (seededJitter(title, 0) * 0.8),
    lng: best.lng + (seededJitter(title, 1) * 0.8),
    entity: best.key,
    entityType: best.type,
    confidence,
    crisisType,
    severity: severityMap[crisisType] || 1,
    candidates: candidates.length,
  };
}

/* ── 5. PIN APPEARANCE BY CRISIS TYPE ─────────────────────────────────── */
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

/* ── 6. GEOPOLITICAL THREAT SCORE ───────────────────────────────────────
   Computes a 0-100 score from active conflict zone severity
─────────────────────────────────────────────────────────────────────────── */
function computeGeopoliticalScore(newsPins = []) {
  // Base: active conflict zones weighted by severity
  const activeZones = CONFLICT_ZONES.filter(z => z.status === 'active');
  const elevatedZones = CONFLICT_ZONES.filter(z => z.status === 'elevated');
  const baseScore = Math.min(40,
    activeZones.reduce((s, z) => s + z.severity * 3.5, 0) +
    elevatedZones.reduce((s, z) => s + z.severity * 1.2, 0)
  );

  // Dynamic: war/terrorism news articles spiking the score
  const warPins = newsPins.filter(p => ['war','terrorism','nuclear','conflict'].includes(p.crisisType));
  const dynamicScore = Math.min(60, warPins.length * 4.5);

  return Math.min(100, Math.round(baseScore + dynamicScore));
}

/* ── 7. UTILITY: Seeded jitter to prevent pin overlap ─── */
function seededJitter(seed, idx) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const val = Math.abs((h >> (idx * 8)) & 0xff) / 255;
  return (val - 0.5) * 2; // -1 to +1
}

/* ── 8. CONFLICT ZONE ARC DATA (for impact radius circles) ─── */
function getConflictZones() {
  return CONFLICT_ZONES;
}

/* ── EXPORTS ─── */
window.GeoIntelligence = {
  resolveNewsGeo,
  getCrisisVisual,
  computeGeopoliticalScore,
  getConflictZones,
  CRISIS_VISUALS,
  CONFLICT_ZONES,
};
