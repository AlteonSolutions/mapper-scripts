'use strict';
// Quick diagnostic for Welcoming Center: print the first N mismatching rows
// per column with actual vs expected values.
const XLSX = require('xlsx');
const { computeAnalytics } = require('./analytics_compute');

const file = process.argv[2];
if (!file) { console.error('Usage: node debug_welcoming.js <file.xlsm>'); process.exit(1); }

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
function asDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number' && v > 1 && v < 80000) return new Date(EXCEL_EPOCH_MS + Math.round(v * 86400000));
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}
function blk(a, b) {
  const ab = (a === null || a === '' || a === undefined);
  const bb = (b === null || b === '' || b === undefined);
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

const wb = XLSX.readFile(file, { cellDates: false });

function readSheet(name) {
  const ws = wb.Sheets[name]; if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const hdr = rows[0] || [];
  let data = rows.slice(1);
  while (data.length && data[data.length - 1].every(v => v === null || v === '')) data.pop();
  return { hdr, data };
}
function setupLookup() {
  const s = readSheet('Setup'); const m = {};
  if (!s) return m;
  for (const row of [s.hdr, ...s.data]) for (let i = 0; i < row.length - 1; i++)
    if (typeof row[i] === 'string' && row[i].trim()) m[row[i].trim()] = row[i + 1];
  return m;
}

const G = readSheet('Gift Data'), C = readSheet('Constituent Data'), setup = setupLookup();
const idIdx = C.hdr.indexOf('Constituent ID');
const cd = C.data.filter(r => r[idIdx] !== null && r[idIdx] !== '');
const gd = G.data.filter(r => r[0] !== null && r[0] !== '');

console.log('Setup values:');
for (const k of ['Start Month','Fiscal Year Start Month','Major Giving Threshold','Analytics End Year','Analytics Data Years'])
  if (setup[k] !== undefined) console.log(`  ${k} = ${JSON.stringify(setup[k])}`);

// Show ID types in both sheets
const consIdTypes = {}, giftIdTypes = {};
for (const r of cd) { const t = typeof r[idIdx]; consIdTypes[t] = (consIdTypes[t]||0)+1; }
for (const r of gd) { const t = typeof r[0]; giftIdTypes[t] = (giftIdTypes[t]||0)+1; }
console.log('\nConstituent ID types in Constituent Data:', consIdTypes);
console.log('Constituent ID types in Gift Data:', giftIdTypes);

// Check for IDs that appear in gift but not constituent
const consIdSet = new Set(cd.map(r => String(r[idIdx]).trim()));
const missedGiftIds = new Set();
for (const r of gd) { const id = String(r[0]).trim(); if (!consIdSet.has(id)) missedGiftIds.add(id); }
console.log(`\nGift IDs not in Constituent table: ${missedGiftIds.size} unique IDs`);
if (missedGiftIds.size) console.log('  First 5:', [...missedGiftIds].slice(0, 5));

const fyStartMonth = setup['Start Month'] || setup['Fiscal Year Start Month'];
const threshold = Number(setup['Major Giving Threshold']);
const endYear = Number(setup['Analytics End Year']);
const dataYears = Number(setup['Analytics Data Years']);

// Detect formula variants
function detectCYDRetentionYears() {
  const cs = wb.Sheets['Constituent Data']; if (!cs) return 5;
  const cydIdx = C.hdr.indexOf('Consecutive Year Donor'); if (cydIdx < 0) return 5;
  const cell = cs[XLSX.utils.encode_cell({ r: 1, c: cydIdx })]; if (!cell || !cell.f) return 5;
  if (cell.f.includes('#REF!')) return 0;
  if (/MAP\s*\(/i.test(cell.f) || /SEQUENCE\s*\(/i.test(cell.f)) return -1;
  return (cell.f.match(/LEFT\s*\(/gi) || []).length || 5;
}
function detectDJYear() {
  const gs = wb.Sheets['Gift Data']; if (!gs) return null;
  const djCol = G.hdr.indexOf('Donor Journey Donor'); if (djCol < 0) return null;
  const cell = gs[XLSX.utils.encode_cell({ r: 1, c: djCol })]; if (!cell || !cell.f) return null;
  const m = cell.f.match(/Gift FY\][^,]*,\s*['"]*(\d{4})['"]/);
  return m ? Number(m[1]) : null;
}

const cydRetentionYears = detectCYDRetentionYears();
const djYear = detectDJYear();
console.log(`\ncydRetentionYears: ${cydRetentionYears}, djYear: ${djYear}`);

const out = computeAnalytics(gd.map(r => r.slice(0, 6)), cd.map(r => r.slice(0, 9)),
  { fyStartMonth, threshold, donorJourney: true, donorJourneyYear: djYear, endYear, dataYears, cydRetentionYears });

// Diagnose Total Giving mismatches in detail
console.log('\n--- Total Giving mismatches (first 10) ---');
const tvCol = out.constituent.columns.indexOf('Total Giving');
const tvFileCol = C.hdr.indexOf('Total Giving');
let tvCount = 0;
for (let i = 0; i < Math.min(cd.length, out.constituent.rows.length); i++) {
  const ours = out.constituent.rows[i][tvCol];
  const theirs = cd[i][tvFileCol];
  if (!blk(ours, theirs) && tvCount++ < 10) {
    console.log(`  row ${i+1}: ID=${cd[i][idIdx]}  ours=${ours}  file=${theirs}`);
  }
}

// Diagnose FGD mismatches in Gift Data
console.log('\n--- Gift.FGD mismatches (first 10) ---');
const fgdCol = out.gift.columns.indexOf('FGD');
const fgdFileCol = G.hdr.indexOf('FGD');
let fgdCount = 0;
for (let i = 0; i < Math.min(gd.length, out.gift.rows.length); i++) {
  const ours = out.gift.rows[i][fgdCol];
  const theirs = gd[i][fgdFileCol];
  if (!blk(ours, theirs) && fgdCount++ < 10) {
    const cid = gd[i][0];
    const da = asDate(ours), db = asDate(theirs);
    console.log(`  row ${i+1}: ID=${cid}  ours=${da ? da.toISOString().slice(0,10) : ours}  file=${db ? db.toISOString().slice(0,10) : theirs}`);
  }
}

// Show a year column for a few mismatching constituents
const yr2025 = out.constituent.columns.indexOf('2025');
const yr2025f = C.hdr.indexOf('2025');
if (yr2025 >= 0 && yr2025f >= 0) {
  console.log('\n--- Cons.2025 mismatches (first 10) ---');
  let yc = 0;
  for (let i = 0; i < Math.min(cd.length, out.constituent.rows.length); i++) {
    const ours = out.constituent.rows[i][yr2025];
    const theirs = cd[i][yr2025f];
    if (!blk(ours, theirs) && yc++ < 10) {
      console.log(`  row ${i+1}: ID=${cd[i][idIdx]}  ours=${ours}  file=${theirs}`);
    }
  }
}

// National Breakdown mismatches — show constituent type
console.log('\n--- Gift.National Breakdown mismatches (first 10) ---');
const nbCol = out.gift.columns.indexOf('National Breakdown');
const nbFileCol = G.hdr.indexOf('National Breakdown');
let nbCount = 0;
for (let i = 0; i < Math.min(gd.length, out.gift.rows.length); i++) {
  const ours = out.gift.rows[i][nbCol];
  const theirs = gd[i][nbFileCol];
  if (!blk(ours, theirs) && nbCount++ < 10) {
    console.log(`  row ${i+1}: ID=${gd[i][0]}  ours="${ours}"  file="${theirs}"`);
  }
}
