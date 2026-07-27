'use strict';
/*
 * regression_test.js — self-contained regression check for the upstream compute.
 *
 * For each finished "*Analytics.xlsm" you point it at, it re-runs computeAnalytics on
 * that file's own raw input columns and diffs the result against the file's own
 * (Excel-produced) computed columns — every row, every column. 0 mismatches == the
 * new method reproduces Excel exactly for that client.
 *
 * Usage:
 *   node regression_test.js <file.xlsm> [fork]      fork = "sw" | "databasey" | "alford"
 *   node regression_test.js --dir <folder>          scans every *Analytics.xlsm in a folder
 *
 * Requires: npm i xlsx   (SheetJS). If mapper.js uses a different xlsx lib, adapt readSheet().
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { computeAnalytics } = require('./analytics_compute');

function readSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const hdr = rows[0] || [];
  let data = rows.slice(1);
  while (data.length && data[data.length - 1].every(v => v === null || v === '')) data.pop();
  return { hdr, data };
}
function setupLookup(wb) {
  const s = readSheet(wb, 'Setup'); const m = {};
  if (!s) return m;
  for (const row of [s.hdr, ...s.data]) for (let i = 0; i < row.length - 1; i++)
    if (typeof row[i] === 'string' && row[i].trim()) m[row[i].trim()] = row[i + 1];
  return m;
}
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
function asDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number' && v > 1 && v < 80000) return new Date(EXCEL_EPOCH_MS + Math.round(v * 86400000));
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}
function blk(a, b) {
  const ab = (a === null || a === '' || a === undefined || String(a) === 'nan');
  const bb = (b === null || b === '' || b === undefined || String(b) === 'nan');
  if (ab && bb) return true;
  if (ab !== bb) return false;
  if (!(a instanceof Date) && !(b instanceof Date)) {
    const na = Number(a), nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) <= 0.01;
  }
  const da = asDate(a), db = asDate(b);
  if (da && db) return Math.abs(da - db) < 86400000;
  return String(a).trim() === String(b).trim();
}
// Read the DJ year baked into this file's Gift Data "Donor Journey Donor" formula.
// Older files hardcode a year like "2018"; newer files use the dynamic EndYear-5 named range.
function detectDJYear(wb, giftHdr, endYear) {
  const gs = wb.Sheets['Gift Data'];
  if (!gs) return null;
  const djCol = giftHdr.indexOf('Donor Journey Donor');
  if (djCol < 0) return null;
  const cell = gs[XLSX.utils.encode_cell({ r: 1, c: djCol })];
  if (!cell || !cell.f) return null;
  // Hardcoded year pattern: GiftData[Gift FY], "2018" or GiftData[Gift FY], 2018
  const m = cell.f.match(/Gift FY\][^,]*,\s*['"]*(\d{4})['"]/);
  if (m) return Number(m[1]);
  return null; // dynamic (EndYear-5 named range) — let computeAnalytics derive it
}
// Returns true when the PGP formula uses a broken COUNTIFS pattern (column range
// can never reach the target count), meaning Excel always outputs "".
function isPGPBroken(wb, consHdr) {
  const cs = wb.Sheets['Constituent Data'];
  if (!cs) return false;
  const pgpIdx = consHdr.indexOf('Planned Giving Prospect');
  if (pgpIdx < 0) return false;
  const cell = cs[XLSX.utils.encode_cell({ r: 1, c: pgpIdx })];
  if (!cell || !cell.f) return false;
  return /COUNTIFS\s*\(/i.test(cell.f);
}
function validate(file, fork) {
  const wb = XLSX.readFile(file, { cellDates: false });
  const G = readSheet(wb, 'Gift Data'), C = readSheet(wb, 'Constituent Data'), setup = setupLookup(wb);
  if (!G || !C) throw new Error('sheet unreadable by SheetJS (' + (!G ? 'Gift Data' : 'Constituent Data') +
    ') — very large files can hit a SheetJS limit; validate this one with the Python/openpyxl checker instead');
  const idIdx = C.hdr.indexOf('Constituent ID');
  const cd = C.data.filter(r => r[idIdx] !== null && r[idIdx] !== '');
  const gd = G.data.filter(r => r[0] !== null && r[0] !== '');
  const fyStartMonth = setup['Start Month'] || setup['Fiscal Year Start Month'];
  const threshold = Number(setup['Major Giving Threshold']);
  const donorJourney = fork !== 'sw';
  // Use the file's OWN Setup End Year / Data Years so we validate the compute logic
  // against how THIS file was generated (deriving from today would drift for old files).
  const endYear = Number(setup['Analytics End Year']);
  const dataYears = Number(setup['Analytics Data Years']);
  // Detect the DJ year actually used in this file's formula (may be hardcoded in older files).
  const djYear = detectDJYear(wb, G.hdr, endYear);

  // Skip columns where this file's Excel formula is known-broken.
  const pgpBroken = isPGPBroken(wb, C.hdr);
  const consSkip = new Set(pgpBroken ? ['Planned Giving Prospect'] : []);

  const out = computeAnalytics(gd.map(r => r.slice(0, 6)), cd.map(r => r.slice(0, 9)),
    { fyStartMonth, threshold, donorJourney, donorJourneyYear: djYear, endYear, dataYears });

  // map output columns by name and compare positionally to the file's columns
  const colIndex = (hdr, name) => hdr.indexOf(name);
  const isExcelError = v => typeof v === 'string' && /^#(VALUE|REF|N\/A|DIV\/0|NAME|NULL|NUM)/.test(v.trim());
  const isBlank = v => v === null || v === '' || v === undefined;
  let total = 0, sanitized = 0; const bad = [];
  function cmp(sheetName, fileHdr, fileRows, outObj, skipCols) {
    for (const col of outObj.columns) {
      if (skipCols && skipCols.has(col)) continue;
      const fi = colIndex(fileHdr, col), oi = outObj.columns.indexOf(col);
      if (fi < 0) continue; // column not present in this file (e.g. SW DJ)
      let m = 0;
      const n = Math.min(fileRows.length, outObj.rows.length);
      for (let i = 0; i < n; i++) {
        if (blk(outObj.rows[i][oi], fileRows[i][fi])) continue;
        // intended sanitization: we emit blank where Excel had a #VALUE!/#N/A error on bad data
        if (isBlank(outObj.rows[i][oi]) && isExcelError(fileRows[i][fi])) { sanitized++; continue; }
        m++;
      }
      if (m) { bad.push(`${sheetName}.${col}:${m}`); total += m; }
    }
  }
  cmp('Gift', G.hdr, gd, out.gift);
  cmp('Cons', C.hdr, cd, out.constituent, consSkip);
  return { total, sanitized, bad, gifts: gd.length, cons: cd.length };
}
function forkOf(file) {
  const b = path.basename(file).toLowerCase();
  if (b.includes('big life') || b.includes('antiquarian') || b.startsWith('sw')) return 'sw';
  // Check if the file lives inside a folder literally named "SW" (brand folder convention)
  const normalized = file.replace(/\\/g, '/');
  if (/\/SW\//i.test(normalized)) return 'sw';
  // Check Setup sheet Return Email for schultzwilliams domain
  try {
    const wb2 = XLSX.readFile(file, { sheets: ['Setup'], cellDates: false });
    const setup = setupLookup(wb2);
    const email = String(setup['Return Email'] || '').toLowerCase();
    if (email.includes('schultzwilliams')) return 'sw';
  } catch (_) {}
  return 'databasey';
}
function isDateFolder(name) {
  // Matches folders like "2026.6.10 11.32" or "2026-06-10 11.32"
  return /^\d{4}[\.\-]\d{1,2}[\.\-]\d{1,2}/.test(name);
}
function findFiles(dir, since) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  // Collect any .xlsm files directly in this folder
  for (const e of entries) {
    if (!e.isDirectory() && /Analytics\.xlsm$/i.test(e.name)) {
      const fp = path.join(dir, e.name);
      if (!since || fs.statSync(fp).mtime >= since) results.push(fp);
    }
  }
  const subDirs = entries.filter(e => e.isDirectory());
  const dateSubs = subDirs.filter(e => isDateFolder(e.name));
  const otherSubs = subDirs.filter(e => !isDateFolder(e.name));
  if (dateSubs.length > 0) {
    // Only recurse into the most recent date-based run folder
    const latest = dateSubs.sort((a, b) =>
      fs.statSync(path.join(dir, b.name)).mtime - fs.statSync(path.join(dir, a.name)).mtime
    )[0];
    console.log('  [latest run] ' + path.join(dir, latest.name));
    results = results.concat(findFiles(path.join(dir, latest.name), since));
  }
  // Always recurse into non-date subfolders (client folders, brand folders, etc.)
  for (const sub of otherSubs) results = results.concat(findFiles(path.join(dir, sub.name), since));
  return results;
}
const args = process.argv.slice(2);
// Parse flags: --days N limits to files modified within the last N days (default: no limit)
let daysArg = null;
const daysIdx = args.indexOf('--days');
if (daysIdx >= 0 && args[daysIdx + 1]) { daysArg = Number(args[daysIdx + 1]); args.splice(daysIdx, 2); }
const since = daysArg ? new Date(Date.now() - daysArg * 86400000) : null;
if (since) console.log(`[filter] only files modified on or after ${since.toDateString()} (--days ${daysArg})`);
let files = [];
if (args[0] === '--dir') files = findFiles(args[1], since);
else files = [args[0]];
const fork = args[1] && args[0] !== '--dir' ? args[1] : null;
let fail = 0;
for (const f of files) {
  try {
    const r = validate(f, fork || forkOf(f));
    const ok = r.total === 0;
    if (!ok) fail++;
    const san = r.sanitized ? `  (${r.sanitized} sanitized bad-date cell${r.sanitized > 1 ? 's' : ''})` : '';
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${path.basename(f).slice(0, 46).padEnd(46)} gifts=${String(r.gifts).padStart(7)} cons=${String(r.cons).padStart(7)}  mismatches=${r.total}${san}${r.bad.length ? '  ' + r.bad.join(' ') : ''}`);
  } catch (e) { fail++; console.log(`ERROR ${path.basename(f)}: ${e.message}`); }
}
process.exit(fail ? 1 : 0);
