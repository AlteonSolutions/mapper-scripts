/*
 * sheetjs_version_diff.js — diff two SheetJS builds against the same inputs.
 *
 * SheetJS stopped publishing to npm after 0.18.5; later builds come only from
 * cdn.sheetjs.com. So an upgrade cannot be validated by swapping a semver range
 * and re-running the tests — the two builds have to be installed side by side and
 * compared. That is what this does.
 *
 *   Usage:
 *     node sheetjs_version_diff.js <oldXlsxModuleDir> <newXlsxModuleDir> <sample.xlsx>
 *
 *   e.g.
 *     mkdir -p /tmp/sjs/old /tmp/sjs/new
 *     (cd /tmp/sjs/old && npm init -y && npm i xlsx@0.18.5)
 *     (cd /tmp/sjs/new && npm init -y && npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz)
 *     node sheetjs_version_diff.js /tmp/sjs/old/node_modules/xlsx \
 *                                  /tmp/sjs/new/node_modules/xlsx \
 *                                  "Some Client Data File.xlsx"
 *
 * Exits non-zero if anything differs, so it can gate a merge.
 *
 * What it compares, in the order the real pipeline hits them:
 *   1. read      — every cell of every sheet: type, value, and formatted text
 *   2. dates     — cells SheetJS typed as dates, plus the date parsing the
 *                  mapper relies on. A silent shift here moves every fiscal
 *                  year, so dates are reported separately rather than lumped in
 *                  with the rest.
 *   3. csv       — write a CSV and read it back. The mapper does not accept CSV
 *                  today, but sheet_to_csv is how output gets eyeballed, and CSV
 *                  parsing is where quoting and type-guessing changes tend to land.
 *   4. compute   — computeAnalytics over each build's parse, every output sheet
 *                  cell by cell. This is the one that matters: it is what reaches
 *                  the client.
 *   5. write     — build the output workbook with each and compare the re-read,
 *                  since the mapper writes as well as reads.
 */
'use strict';

const path = require('path');

const [oldDir, newDir, sample] = process.argv.slice(2);
if (!oldDir || !newDir || !sample) {
    console.error('usage: node sheetjs_version_diff.js <oldXlsxDir> <newXlsxDir> <sample.xlsx>');
    process.exit(2);
}

const OLD = require(path.resolve(oldDir));
const NEW = require(path.resolve(newDir));
const { computeAnalytics } = require('./analytics_compute');

let failures = 0;
function report(label, diffs, extra) {
    const ok = diffs.length === 0;
    if (!ok) failures++;
    console.log((ok ? '  ok   ' : '  DIFF ') + label + (extra ? '   ' + extra : ''));
    diffs.slice(0, 12).forEach(d => console.log('         ' + d));
    if (diffs.length > 12) console.log('         ... and ' + (diffs.length - 12) + ' more');
}

console.log('old: xlsx ' + OLD.version + '   new: xlsx ' + NEW.version);
console.log('sample: ' + sample + '\n');
if (OLD.version === NEW.version) {
    console.log('NOTE: both sides are the same version, so this run proves only that the');
    console.log('      harness agrees with itself. Point it at two different builds.\n');
}

// Read options are the ones mapper.js actually uses, so the comparison reflects
// the real call rather than SheetJS defaults.
const READ_OPTS = { dense: true, cellFormula: false, cellHTML: false, cellNF: false };

// ---- 1. read ---------------------------------------------------------------
const wbOld = OLD.readFile(sample, READ_OPTS);
const wbNew = NEW.readFile(sample, READ_OPTS);

{
    const diffs = [];
    if (String(wbOld.SheetNames) !== String(wbNew.SheetNames)) {
        diffs.push('sheet names: ' + wbOld.SheetNames + '  vs  ' + wbNew.SheetNames);
    }
    wbOld.SheetNames.forEach(n => {
        const a = wbOld.Sheets[n], b = wbNew.Sheets[n];
        if (!b) { diffs.push(n + ': missing in new'); return; }
        if ((a['!ref'] || '') !== (b['!ref'] || '')) {
            diffs.push(n + ' !ref: ' + a['!ref'] + ' vs ' + b['!ref']);
        }
        const ja = OLD.utils.sheet_to_json(a, { header: 1, defval: '', raw: true });
        const jb = NEW.utils.sheet_to_json(b, { header: 1, defval: '', raw: true });
        if (ja.length !== jb.length) diffs.push(n + ' row count: ' + ja.length + ' vs ' + jb.length);
        const rows = Math.min(ja.length, jb.length);
        for (let r = 0; r < rows; r++) {
            const ra = ja[r] || [], rb = jb[r] || [];
            const cols = Math.max(ra.length, rb.length);
            for (let c = 0; c < cols; c++) {
                const va = ra[c], vb = rb[c];
                if (!same(va, vb)) {
                    diffs.push(n + '!' + OLD.utils.encode_cell({ r, c })
                        + ': ' + show(va) + '  vs  ' + show(vb));
                }
            }
        }
    });
    report('read: every cell of every sheet', diffs);
}

function same(a, b) {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (typeof a === 'number' && typeof b === 'number') {
        return a === b || Math.abs(a - b) < 1e-9;
    }
    return a === b || (a === undefined && b === '') || (a === '' && b === undefined);
}
function show(v) {
    if (v instanceof Date) return 'Date(' + v.toISOString() + ')';
    if (v === undefined) return '(undefined)';
    return JSON.stringify(v) + ' [' + typeof v + ']';
}

// ---- 2. dates --------------------------------------------------------------
{
    const diffs = [];
    let dateCells = 0;
    wbOld.SheetNames.forEach(n => {
        const a = wbOld.Sheets[n], b = wbNew.Sheets[n];
        if (!b || !a['!ref']) return;
        const ra = OLD.utils.decode_range(a['!ref']);
        for (let r = ra.s.r; r <= ra.e.r; r++) {
            for (let c = ra.s.c; c <= ra.e.c; c++) {
                const addr = OLD.utils.encode_cell({ r, c });
                const ca = cell(a, r, c, OLD), cb = cell(b, r, c, NEW);
                if (!ca && !cb) continue;
                const ta = ca ? ca.t : null, tb = cb ? cb.t : null;
                if (ta === 'd' || tb === 'd') dateCells++;
                if (ta !== tb) diffs.push(n + '!' + addr + ' cell type: ' + ta + ' vs ' + tb);
                else if (ta === 'd' && ca.v && cb.v
                         && new Date(ca.v).getTime() !== new Date(cb.v).getTime()) {
                    diffs.push(n + '!' + addr + ' date: ' + new Date(ca.v).toISOString()
                        + ' vs ' + new Date(cb.v).toISOString());
                }
            }
        }
    });
    // The sample may hold dates as serial numbers rather than date-typed cells —
    // that is how the mapper reads them, since it does not pass cellDates. So read
    // it again WITH cellDates to get real date objects to compare, which is where a
    // timezone or epoch regression would show up.
    try {
        const da = OLD.readFile(sample, Object.assign({}, READ_OPTS, { cellDates: true }));
        const db = NEW.readFile(sample, Object.assign({}, READ_OPTS, { cellDates: true }));
        let compared = 0;
        da.SheetNames.forEach(n => {
            const ja = OLD.utils.sheet_to_json(da.Sheets[n], { header: 1, defval: '', raw: true });
            const jb = NEW.utils.sheet_to_json(db.Sheets[n], { header: 1, defval: '', raw: true });
            for (let r = 0; r < Math.min(ja.length, jb.length); r++) {
                const ra = ja[r] || [], rb = jb[r] || [];
                for (let c = 0; c < Math.max(ra.length, rb.length); c++) {
                    const x = ra[c], y = rb[c];
                    if (!(x instanceof Date) && !(y instanceof Date)) continue;
                    compared++;
                    if (!same(x, y)) {
                        diffs.push('cellDates ' + n + '!' + OLD.utils.encode_cell({ r, c })
                            + ': ' + show(x) + ' vs ' + show(y));
                    }
                }
            }
        });
        dateCells += compared;
    } catch (e) {
        diffs.push('cellDates pass threw: ' + e.message);
    }
    // The serial-number conversions the mapper leans on, exercised directly.
    [1, 2, 60, 61, 25569, 45000, 46304, 46388].forEach(n => {
        const da = OLD.SSF ? OLD.SSF.parse_date_code(n) : null;
        const db = NEW.SSF ? NEW.SSF.parse_date_code(n) : null;
        const sa = da ? [da.y, da.m, da.d].join('-') : 'null';
        const sb = db ? [db.y, db.m, db.d].join('-') : 'null';
        if (sa !== sb) diffs.push('serial ' + n + ' -> ' + sa + ' vs ' + sb);
    });
    report('dates: cell typing, values, and serial conversion', diffs,
        '(' + dateCells + ' date-typed cells seen)');
}

function cell(ws, r, c, X) {
    // Dense sheets store rows as arrays; sparse ones use A1 keys.
    if (Array.isArray(ws['!data'])) return (ws['!data'][r] || [])[c];
    if (Array.isArray(ws) ) return (ws[r] || [])[c];
    return ws[X.utils.encode_cell({ r, c })];
}

// ---- 3. csv ----------------------------------------------------------------
{
    const diffs = [];
    // Values chosen to provoke the usual CSV disagreements: embedded commas and
    // quotes, leading zeros, a leading +, something that looks like a date, and
    // the kind of ID that Excel likes to turn into a number.
    const aoa = [
        ['Constituent ID', 'Name', 'Gift Amount', 'Gift Date', 'Note'],
        ['053036', 'Smith, Jane', 1000.5, '2024-11-05', 'said "yes"'],
        ['9374', 'O\'Brien & Co', 0, '11/5/2024', 'line1\nline2'],
        ['+1200', 'Trailing space ', -5, '45000', ''],
    ];
    const csvOld = OLD.utils.sheet_to_csv(OLD.utils.aoa_to_sheet(aoa));
    const csvNew = NEW.utils.sheet_to_csv(NEW.utils.aoa_to_sheet(aoa));
    if (csvOld !== csvNew) {
        diffs.push('sheet_to_csv output differs');
        csvOld.split('\n').forEach((line, i) => {
            const other = csvNew.split('\n')[i];
            if (line !== other) diffs.push('  line ' + i + ': ' + JSON.stringify(line)
                + '  vs  ' + JSON.stringify(other));
        });
    }
    // And read it back, which is where type-guessing changes show up.
    const backOld = OLD.utils.sheet_to_json(OLD.read(csvOld, { type: 'string' }).Sheets.Sheet1,
        { header: 1, defval: '', raw: false });
    const backNew = NEW.utils.sheet_to_json(NEW.read(csvNew, { type: 'string' }).Sheets.Sheet1,
        { header: 1, defval: '', raw: false });
    if (JSON.stringify(backOld) !== JSON.stringify(backNew)) {
        diffs.push('CSV re-read differs');
        backOld.forEach((row, i) => {
            if (JSON.stringify(row) !== JSON.stringify(backNew[i])) {
                diffs.push('  row ' + i + ': ' + JSON.stringify(row)
                    + '  vs  ' + JSON.stringify(backNew[i]));
            }
        });
    }
    report('csv: write and read back', diffs);
}

// ---- 4. compute ------------------------------------------------------------
// The mapper's own call shape: fixed-width arrays built by header name.
function rowsFor(X, wb) {
    const g = X.utils.sheet_to_json(wb.Sheets['Gift Data'], { defval: '' });
    const c = X.utils.sheet_to_json(wb.Sheets['Constituent Data'], { defval: '' });
    return {
        gift: g.map(r => [r['Constituent ID'], r['Gift Date'], r['Gift Amount'],
                          r['Gift Type'], r['Event'] || '', r['Spotlights'] || '']),
        cons: c.map(r => [r['Constituent ID'], r['Constituent Name'] || r['Name'] || '',
                          r['Constituent Type'] || '', r['First Gift Date'] || '',
                          r['Board Member?'] || r['Board Member'] || '',
                          r['Street Address'] || r['Street'] || '', r['City'] || '',
                          r['State'] || '', r['Zip Code'] || r['Zip'] || '',
                          r['Deceased?'] || r['Deceased'] || '']),
    };
}

let resOld = null, resNew = null;
{
    const diffs = [];
    const PARAMS = { fyStartMonth: 'January', threshold: 5000, donorJourney: true };
    try {
        const a = rowsFor(OLD, wbOld), b = rowsFor(NEW, wbNew);
        if (a.gift.length !== b.gift.length) diffs.push('gift row count: ' + a.gift.length + ' vs ' + b.gift.length);
        if (a.cons.length !== b.cons.length) diffs.push('constituent row count: ' + a.cons.length + ' vs ' + b.cons.length);
        resOld = computeAnalytics(a.gift, a.cons, PARAMS);
        resNew = computeAnalytics(b.gift, b.cons, PARAMS);
        Object.keys(resOld).forEach(key => {
            const x = resOld[key], y = resNew[key];
            if (!x || !x.rows) return;
            if (!y || !y.rows) { diffs.push(key + ': missing in new'); return; }
            if (String(x.columns) !== String(y.columns)) diffs.push(key + ' columns differ');
            if (x.rows.length !== y.rows.length) {
                diffs.push(key + ' rows: ' + x.rows.length + ' vs ' + y.rows.length);
            }
            const n = Math.min(x.rows.length, y.rows.length);
            for (let i = 0; i < n; i++) {
                const ra = x.rows[i], rb = y.rows[i];
                for (let c = 0; c < Math.max(ra.length, rb.length); c++) {
                    if (!same(ra[c], rb[c])) {
                        diffs.push(key + ' row ' + i + ' col ' + c + ' ('
                            + (x.columns[c] || '?') + '): ' + show(ra[c]) + ' vs ' + show(rb[c]));
                    }
                }
            }
        });
    } catch (e) {
        diffs.push('threw: ' + e.message);
    }
    const summary = resOld
        ? '(' + resOld.gift.rows.length + ' gift rows, ' + resOld.constituent.rows.length
          + ' constituents, ' + resOld.allProspects.rows.length + ' prospects)'
        : '';
    report('compute: every analytics output sheet', diffs, summary);
}

// ---- 5. write --------------------------------------------------------------
{
    const diffs = [];
    try {
        const build = (X, res) => {
            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(
                [res.constituent.columns].concat(res.constituent.rows)), 'Constituent Data');
            X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(
                [res.gift.columns].concat(res.gift.rows)), 'Gift Data');
            return X.write(wb, { bookType: 'xlsx', type: 'buffer', bookSST: true, compression: true });
        };
        if (!resOld || !resNew) throw new Error('compute step did not produce output');
        const bufOld = build(OLD, resOld), bufNew = build(NEW, resNew);
        // Byte equality is not expected across builds, so compare the re-read.
        const reOld = OLD.read(bufOld, READ_OPTS), reNew = NEW.read(bufNew, READ_OPTS);
        ['Constituent Data', 'Gift Data'].forEach(n => {
            const ja = OLD.utils.sheet_to_json(reOld.Sheets[n], { header: 1, defval: '' });
            const jb = NEW.utils.sheet_to_json(reNew.Sheets[n], { header: 1, defval: '' });
            if (ja.length !== jb.length) { diffs.push(n + ' rows: ' + ja.length + ' vs ' + jb.length); return; }
            for (let r = 0; r < ja.length; r++) {
                for (let c = 0; c < Math.max(ja[r].length, jb[r].length); c++) {
                    if (!same(ja[r][c], jb[r][c])) {
                        diffs.push(n + '!' + OLD.utils.encode_cell({ r, c }) + ': '
                            + show(ja[r][c]) + ' vs ' + show(jb[r][c]));
                    }
                }
            }
        });
        console.log('         output size: old ' + bufOld.length + ' bytes, new ' + bufNew.length
            + ' bytes (' + (bufNew.length - bufOld.length >= 0 ? '+' : '')
            + (bufNew.length - bufOld.length) + ')');
    } catch (e) {
        diffs.push('threw: ' + e.message);
    }
    report('write: output workbook, compared after re-reading', diffs);
}

console.log('\n' + (failures === 0
    ? 'no differences between xlsx ' + OLD.version + ' and ' + NEW.version
    : failures + ' area(s) differ — see above'));
process.exit(failures === 0 ? 0 : 1);
