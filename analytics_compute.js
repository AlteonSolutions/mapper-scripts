'use strict';
/*
 * analytics_compute.js — upstream (mapper-side) computation of the Databasey
 * Analytics derived columns. Port of the validated Python reference; produces the
 * finished Gift Data / Constituent Data columns as VALUES so Excel no longer runs
 * the O(n^2) worksheet formulas.
 *
 * Validated: JS output matches the Python reference (which matches Excel's real
 * output cell-for-cell) on Chicago (Databasey) and Big Life (SW).
 *
 * API:
 *   const { computeAnalytics } = require('./analytics_compute');
 *   const out = computeAnalytics(giftRows, consRows, params);
 *   // giftRows: array of [Constituent ID, Gift Date, Gift Amount, Gift Type, Event, Spotlights]
 *   // consRows: array of [Constituent ID, Name, Type, First Gift Date, Board Member?, Street, City, State, Zip]
 *   //   (Dates may be Excel serial numbers, JS Date objects, or ISO strings.)
 *   // params: { fyStartMonth, endYear, dataYears, threshold,
 *   //           donorJourneyYear=null, donorJourney=true }
 *   // returns { gift: {columns:[...], rows:[[...]]},
 *   //           constituent: {columns:[...], rows:[[...]]} }
 *
 * Fork settings:
 *   Databasey / Alford : { donorJourney: true }                 (default)
 *   SW                 : { donorJourney: false }                (drops both DJ columns)
 */

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30); // 1899-12-30
const DAY_MS = 86400000;

function excelSerialToDate(n) {
  return new Date(EXCEL_EPOCH_MS + Math.round(n * DAY_MS));
}
function toDate(v) {
  let d = null;
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) d = isNaN(v.getTime()) ? null : v;
  else if (typeof v === 'number') d = excelSerialToDate(v);
  else if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return null;
    if (!Number.isNaN(Number(s))) d = excelSerialToDate(Number(s)); // numeric serial as text
    else { const p = new Date(s); d = isNaN(p.getTime()) ? null : p; }
  }
  // Sanitize placeholder/junk dates: Excel can't represent pre-1900 dates (its serials
  // start at 1900), so anything earlier is a bad value (e.g. "1/1/1753"). Treat as blank
  // — it then falls back to the min gift date and is excluded from year derivation.
  if (d && d.getUTCFullYear() < 1900) return null;
  return d;
}
function fyOf(date, fyStart) {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1;
  if (fyStart === 1) return y;
  return m >= fyStart ? y + 1 : y;
}
function round2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
function normId(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}
const TYPE_MAP = { 'Bequest': 'Bequests', 'Estate': 'Bequests', 'Individual': 'Individuals',
  'Foundation': 'Foundations', 'Family Foundation': 'Foundations',
  'Corporation': 'Corporations', 'Organization': 'Corporations', 'Government': '' };

const MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7,
  august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };
// FY Start Month may arrive as a number (1-12) or a name ("March"); normalize to a number.
function monthNum(v) {
  if (typeof v === 'number' && v >= 1 && v <= 12) return v;
  const s = String(v).trim().toLowerCase();
  if (MONTHS[s]) return MONTHS[s];
  const n = Number(s);
  if (n >= 1 && n <= 12) return n;
  throw new Error('Unrecognized FY Start Month: ' + v);
}

// Derive End Year and Data Years from the gift data, replicating the Setup sheet formulas.
// today defaults to the run date (matches Excel's TODAY() at flow time).
function deriveYearParams(giftRows, fyStartMonth, today) {
  const fyStart = monthNum(fyStartMonth);
  const t = today || new Date();
  const fys = [];
  for (const r of giftRows) {
    const d = toDate(r[1]);
    if (d) fys.push(fyOf(d, fyStart));
  }
  if (!fys.length) throw new Error('deriveYearParams: no valid gift dates');
  fys.sort((a, b) => a - b);
  const minFY = fys[0], maxFY = fys[fys.length - 1];
  const secondSmallest = fys.length > 1 ? fys[1] : fys[0];
  const ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1;
  const currentFY = (fyStart === 1 || tm < fyStart) ? ty : ty + 1;
  const endYear = Math.min(maxFY, currentFY - 1);
  const startRaw = (minFY === 1900) ? secondSmallest : minFY;
  const startYear = Math.max(startRaw, endYear - 9);
  const dataYears = Math.max(1, endYear - startYear + 1);
  return { fyStartMonth: fyStart, endYear, dataYears };
}

// Excel-style retention classification. prev/cur are numbers or null (blank).
function retention(prev, cur, year, fgdfy) {
  const pb = prev === null, cb = cur === null;
  if (pb && cb) return 'Non-Donor';
  if (!pb && prev > 0 && cb) return 'Lost';
  if (fgdfy === year) return 'New Donor';
  if (pb && !cb && cur > 0 && fgdfy !== null && fgdfy < year) return 'Recovered';
  if (!pb && !cb && prev === cur) return 'Retained';
  // ">" with Excel type order: blank(text) > number ; number > number numeric
  const gt = (pb && !cb) ? true : (!pb && cb) ? false : (prev > cur);
  return gt ? 'Retained - Decrease' : 'Retained - Increase';
}

function computeAnalytics(giftRows, consRows, params) {
  const fyStart = monthNum(params.fyStartMonth);
  // endYear / dataYears are derived from the gift data if not supplied.
  let endYear = params.endYear, dataYears = params.dataYears;
  if (endYear == null || dataYears == null) {
    const d = deriveYearParams(giftRows, fyStart, params.today);
    endYear = d.endYear; dataYears = d.dataYears;
  }
  const threshold = params.threshold;
  const doDJ = params.donorJourney !== false;
  const djYear = (params.donorJourneyYear != null) ? params.donorJourneyYear : endYear - 5;

  const years = [];
  for (let y = endYear - dataYears + 1; y <= endYear; y++) years.push(y);

  // ---- prep gift rows ----
  const G = giftRows.map(r => {
    const cid = normId(r[0]);
    const date = toDate(r[1]);
    const amt = (r[2] === '' || r[2] == null || isNaN(Number(r[2]))) ? 0 : Number(r[2]);
    const fy = date ? fyOf(date, fyStart) : null;
    return { cid, date, amt, type: r[3], event: r[4], spot: r[5], fy };
  });

  // ---- one-pass gift aggregates ----
  const tot = new Map();          // cid -> sum
  const minFy = new Map();        // cid -> min gift fy
  const minDate = new Map();      // cid -> min gift date (ms)
  const matFull = new Map();      // cid -> Map(fy -> sum)
  const gpyKey = new Map();       // `cid|fy` -> count
  for (const g of G) {
    if (g.cid === null) continue;
    tot.set(g.cid, (tot.get(g.cid) || 0) + g.amt);
    if (g.fy !== null) {
      if (!minFy.has(g.cid) || g.fy < minFy.get(g.cid)) minFy.set(g.cid, g.fy);
      let m = matFull.get(g.cid); if (!m) { m = new Map(); matFull.set(g.cid, m); }
      m.set(g.fy, (m.get(g.fy) || 0) + g.amt);
      const k = g.cid + '|' + g.fy; gpyKey.set(k, (gpyKey.get(k) || 0) + 1);
    }
    if (g.date) {
      const t = g.date.getTime();
      if (!minDate.has(g.cid) || t < minDate.get(g.cid)) minDate.set(g.cid, t);
    }
  }
  const djSum = new Map();        // cid -> sum in FY djYear
  if (doDJ) for (const g of G) if (g.cid !== null && g.fy === djYear) djSum.set(g.cid, (djSum.get(g.cid) || 0) + g.amt);

  function givingFor(cid, year) {
    const m = matFull.get(cid); if (!m) return null;
    let v = m.get(year); if (v === undefined) return null;
    v = round2(v); return v === 0 ? null : v;
  }

  // constituent lookups (first occurrence per id)
  const consFgd = new Map();      // cid -> first-gift-date raw (Date|null)
  const consType = new Map();     // cid -> type
  const consIds = new Set();
  const C = consRows.map(r => {
    const cid = normId(r[0]);
    const fgd = toDate(r[3]);
    if (!consIds.has(cid)) { consFgd.set(cid, fgd); consType.set(cid, r[2]); consIds.add(cid); }
    return { row: r, cid, fgd };
  });

  // ---- Constituent output ----
  const consCols = ['Constituent ID', 'Constituent Name', 'Constituent Type', 'First Gift Date',
    'Board Member?', 'Street Address', 'City', 'State', 'Zip Code', 'First Gift Date FY', 'Total Giving'];
  years.forEach((y, i) => { consCols.push(String(y)); if (i > 0) consCols.push(`${y} Retention`, `${y} Lift/Loss`); });
  consCols.push('Consecutive Year Donor', 'Donor Journey Donor', 'Renewals', 'Major Gift Prospect',
    'Lapsed Major Donors', 'Mid-Level Giving Prospect', 'Planned Giving Prospect');

  const consOut = C.map(c => {
    const cid = c.cid;
    // First Gift Date FY
    let fgdfy;
    if (c.fgd === null) fgdfy = minFy.has(cid) ? minFy.get(cid) : null;
    else { const y = c.fgd.getUTCFullYear(), m = c.fgd.getUTCMonth() + 1; fgdfy = (fyStart === 1) ? y : (m < fyStart ? y : y + 1); }
    // Total Giving
    const totalGiving = round2(tot.get(cid) || 0);
    // giving per displayed year
    const giving = {}; for (const y of years) giving[y] = givingFor(cid, y);
    // retention + lift/loss
    const ret = {}, ll = {};
    for (let i = 1; i < years.length; i++) {
      const y = years[i], prev = giving[years[i - 1]], cur = giving[y];
      const rr = retention(prev, cur, y, fgdfy); ret[y] = rr;
      // Excel does the arithmetic on the giving cells, and any operand that is a blank
      // ("" text) yields #VALUE! -> IFERROR -> blank. Mirror that: a null operand -> blank.
      let v = '';
      if (rr.startsWith('Retained -')) v = (prev === null || cur === null) ? '' : round2(cur - prev);
      else if (rr === 'Lost') v = (prev === null) ? '' : round2(-prev);
      else if (rr === 'Recovered') v = (cur === null) ? '' : round2(cur);
      ll[y] = v;
    }
    // Consecutive Year Donor: ALL retention years must be "Retained*"
    const retYears = years.filter((y, i) => i > 0);
    let cons = retYears.length > 0;
    for (const y of retYears) if (!String(ret[y]).startsWith('Retained')) cons = false;
    const consecutive = cons ? 'Yes' : '';
    // Donor Journey (constituent) = gave in FY endYear-5 (full history); SW: blank
    let donorJourney = '';
    if (doDJ) donorJourney = (givingFor(cid, endYear - 5) !== null) ? 'Yes' : '';
    // window helpers
    const w4 = years.slice(-4);
    const last = years[years.length - 1];
    // block for [Year7]:[Year10] COUNTIFS = w4 giving + lift/loss of w4 except last year
    const block = [];
    for (const y of w4) block.push(giving[y]);
    for (let i = 0; i < w4.length - 1; i++) { const y = w4[i]; const v = ll[y]; if (v !== '' && v != null) block.push(v); }
    let cntMid = 0, cntMaj = 0;
    for (const v of block) { if (v != null && v !== '') { if (v >= 500 && v < threshold) cntMid++; if (v >= threshold) cntMaj++; } }
    const y9_10 = (w4.length >= 2) ? (giving[w4[w4.length - 2]] !== null || giving[w4[w4.length - 1]] !== null) : (giving[last] !== null);
    const majorProspect = (cntMid >= 3 && y9_10) ? 'Yes' : '';
    const lapsed = (giving[last] !== null && giving[last] < threshold && cntMaj > 0) ? 'Yes' : '';
    // Renewals
    const renewals = (giving[last] !== null && giving[last] >= threshold) ? 'Yes' : '';
    // Mid-Level: w4 all nonblank, min>=250, max<1000
    let allnb4 = w4.length > 0, wmin = Infinity, wmax = -Infinity;
    for (const y of w4) { const v = giving[y]; if (v === null) allnb4 = false; else { if (v < wmin) wmin = v; if (v > wmax) wmax = v; } }
    const midlevel = (allnb4 && wmin >= 250 && wmax < 1000) ? 'Yes' : '';
    // Planned Giving: last 5 years all nonblank & > 0
    const w5 = years.slice(-5);
    let planned = w5.length === 5;
    for (const y of w5) { const v = giving[y]; if (v === null || !(v > 0)) planned = false; }
    const plannedGiving = planned ? 'Yes' : '';

    const out = c.row.slice(0, 9);
    out.push(fgdfy, totalGiving);
    years.forEach((y, i) => {
      out.push(giving[y] === null ? '' : giving[y]);
      if (i > 0) out.push(ret[y], ll[y]);
    });
    out.push(consecutive, donorJourney, renewals, majorProspect, lapsed, midlevel, plannedGiving);
    return out;
  });

  // ---- Gift output ----
  const giftCols = ['Constituent ID', 'Gift Date', 'Gift Amount', 'Gift Type', 'Event', 'Spotlights',
    'Gifts Per Year', 'Gift Month', 'Gift FY', 'Donor Journey Donor', 'FGD', 'National Breakdown'];
  const giftOut = G.map((g, idx) => {
    const gpy = g.fy !== null ? gpyKey.get(g.cid + '|' + g.fy) : '';
    const month = g.date ? g.date.getUTCMonth() + 1 : '';
    const fy = g.fy === null ? '' : g.fy;
    const dj = (doDJ && (djSum.get(g.cid) || 0) > 0) ? 'Yes' : '';
    // FGD: constituent's First Gift Date (blank stays blank); fall back to min gift
    // date ONLY when the ID isn't in the constituent table.
    let fgd;
    if (consIds.has(g.cid)) fgd = consFgd.get(g.cid);           // Date or null(blank)
    else fgd = minDate.has(g.cid) ? new Date(minDate.get(g.cid)) : null;
    const t = consType.get(g.cid);
    let nat = TYPE_MAP.hasOwnProperty(t) ? TYPE_MAP[t] : 'Individuals';
    const raw = giftRows[idx];
    return [normId(raw[0]), raw[1], raw[2], raw[3], raw[4], raw[5], gpy, month, fy, dj, fgd, nat];
  });

  return { gift: { columns: giftCols, rows: giftOut }, constituent: { columns: consCols, rows: consOut } };
}

module.exports = { computeAnalytics, deriveYearParams };
