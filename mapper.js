/* APPROVED */
(function() {
    'use strict';
    var MAPPER_VERSION = '7.29.2026b (upstream compute + prospect sheets)';
    var UPSTREAM_COMPUTE = true; // set true to emit 12-col Gift + full Constituent via analytics_compute
    // Direct PA HTTP trigger URL — set before deploying. Omit trailing slash.
    var PA_TRIGGER_URL = 'https://defaulted5c7128d9ed46fb9e402a0fae8db2.22.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/24/workflows/008b5ce9fd5a4db69f04c74da8ffbd18/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6mMSZNTMFX_k1X66vlsEmmKHta_GieRr4QQfrQNky_w';

    if (window.location.href.includes('page-builder') || 
        window.location.href.includes('/builder/') ||
        window.location.href.includes('app.gohighlevel.com/location/')) {
        console.log('Mapper.js: Disabled in builder/edit mode');
        return;
    }
    
    console.log('Mapper.js: Initializing on live page');

    // Theme/variant detection based on URL params passed from outer page
    var _urlParams = new URLSearchParams(window.location.search);
    var isSW = _urlParams.get('brand') === 'sw';
    var isDatabasey = _urlParams.get('brand') === 'databasey';
    var isKellogg = _urlParams.get('brand') === 'kellogg';
    var isStaffing = _urlParams.get('variant') === 'staffing';
    var isDevelopmentAssessment = _urlParams.get('variant') === 'developmentassessment';
    var isCampaignCounsel = _urlParams.get('variant') === 'campaigncounsel';
    var isSimpleFlow = isStaffing || isDevelopmentAssessment || isCampaignCounsel;
    var themeColor = isSW ? '#00386c' : isDatabasey ? '#4F788D' : isKellogg ? '#4F2683' : '#2c5f5d';
    var themeColorHover = isSW ? '#004f99' : isDatabasey ? '#5d8fa5' : isKellogg ? '#6535a8' : '#3d7672';
    var themeColorLight = isSW ? 'rgba(0, 56, 108, 0.1)' : isDatabasey ? 'rgba(79, 120, 141, 0.1)' : isKellogg ? 'rgba(79, 38, 131, 0.1)' : 'rgba(44, 95, 93, 0.1)';
    var themeColorShadow = isSW ? 'rgba(0, 56, 108, 0.3)' : isDatabasey ? 'rgba(79, 120, 141, 0.3)' : isKellogg ? 'rgba(79, 38, 131, 0.3)' : 'rgba(44, 95, 93, 0.3)';
    console.log('Mapper.js: Theme =', isSW ? 'SW (#00386c)' : isDatabasey ? 'Databasey (#4F788D)' : isKellogg ? 'Kellogg (#4F2683)' : 'Default (#2c5f5d)');

    // Apply theme to CSS variables so static CSS in HTML also picks up the color
    if (isSW || isDatabasey || isKellogg) {
        document.documentElement.style.setProperty('--theme-color', themeColor);
        document.documentElement.style.setProperty('--theme-color-hover', themeColorHover);
    }
    
    var workbook = null;
    var uploadIconSvg = '<svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:46px;height:46px;display:block;margin:0 auto;"><rect x="3" y="3" width="40" height="40" rx="20" fill="#F2F4F7"></rect><rect x="3" y="3" width="40" height="40" rx="20" stroke="#F9FAFB" stroke-width="6"></rect><path fill-rule="evenodd" clip-rule="evenodd" d="M20.9167 16.3334C17.9252 16.3334 15.5 18.7585 15.5 21.7501C15.5 23.2425 16.1025 24.5926 17.0795 25.5732C17.4043 25.8992 17.4034 26.4268 17.0773 26.7517C16.7513 27.0765 16.2237 27.0756 15.8988 26.7495C14.6233 25.4693 13.8334 23.7012 13.8334 21.7501C13.8334 17.8381 17.0047 14.6667 20.9167 14.6667C23.454 14.6667 25.6787 16.0013 26.9288 18.003C29.8376 18.0973 32.1667 20.485 32.1667 23.4167C32.1667 25.0991 31.3987 26.6028 30.1974 27.595C29.8425 27.8881 29.3172 27.838 29.0242 27.4831C28.7311 27.1282 28.7812 26.603 29.1361 26.3099C29.9705 25.6208 30.5 24.581 30.5 23.4167C30.5 21.3457 28.8211 19.6667 26.75 19.6667C26.2803 19.6667 25.8332 19.422 25.5872 19.0046C24.6441 17.4042 22.905 16.3334 20.9167 16.3334ZM22.4108 22.4108C22.7362 22.0854 23.2639 22.0854 23.5893 22.4108L26.9226 25.7442C27.2481 26.0696 27.2481 26.5972 26.9226 26.9227C26.5972 27.2481 26.0696 27.2481 25.7441 26.9227L23.8334 25.0119V30.5001C23.8334 30.9603 23.4603 31.3334 23 31.3334C22.5398 31.3334 22.1667 30.9603 22.1667 30.5001V25.0119L20.256 26.9227C19.9305 27.2481 19.4029 27.2481 19.0775 26.9227C18.752 26.5972 18.752 26.0696 19.0775 25.7442L22.4108 22.4108Z" fill="#2c3345FF"></path></svg>';
    var giftAppeals = [];
    var specialEventSkipped = false;
    var spotlightSkipped = false;
    var constituentTypes = [];
    var spotlightSourceData = [];
    var categories = [];
    var mappings = {};
    var spotlightMappings = {};
    var constituentMappings = {};
    var giftTypeMappings = {};
    var currentIndex = 0;
    var spotlightCurrentIndex = 0;
    var constituentCurrentIndex = 0;
    var giftTypeCurrentIndex = 0;
    var hasUsedPrevious = false;
    var spotlightHasUsedPrevious = false;
    var constituentHasUsedPrevious = false;
    var giftTypeHasUsedPrevious = false;
    var currentStep = 0;
    var selectedIndustryType = null;
    var solicitors = [];
    var selectedSolicitors = {};
    var solicitorSelectionDone = false;
    var constituentMappingSkipped = false;
    var giftTypeMappingSkipped = false;
    var pledgeStatusMappingSkipped = false;
    var appealCategories = [];
    var appealCategoryMappings = {};
    var appealCategoryCurrentIndex = 0;
    var appealCategoryHasUsedPrevious = false;
    var appealCategorySkipped = false;

    var constituentCategories = [
        'Individual', 'Organization', 'Government', 'Foundation',
        'Estate', 'Family Foundation', 'Corporation'
    ];

    var giftTypeCategories = ['Cash', 'Pledge', 'Pledge Payment'];
    var giftTypes = [];

    var pledgeStatusCategories = [
        { label: 'Active',               desc: 'Pledge is open and on schedule' },
        { label: 'Fulfilled',            desc: 'Paid in full' },
        { label: 'Partially Fulfilled',  desc: 'Some payments received, balance remaining and on schedule' },
        { label: 'Past Due',             desc: 'Payment(s) missed, pledge still considered collectible' },
        { label: 'Cancelled',            desc: 'Donor or org cancelled before any payment' },
        { label: 'Written Off',          desc: 'Uncollectible balance closed out' },
        { label: 'On Hold',              desc: 'Paused intentionally (e.g., donor death, dispute, renegotiation)' }
    ];
    var pledgeStatuses = [];
    var pledgeStatusMappings = {};
    var pledgeStatusCurrentIndex = 0;
    var pledgeStatusHasUsedPrevious = false;

    var spotlightConfig = null;

    var industryParamMap = {
        'arts': 'arts', 'arts_culture': 'arts', 'Arts & Culture': 'arts',
        'environmental': 'environmental', 'Environmental': 'environmental',
        'education': 'education', 'Education': 'education',
        'communityfoundation': 'communityfoundation', 'family_foundation': 'communityfoundation',
        'Community Foundation': 'communityfoundation', 'Family Foundation': 'communityfoundation',
        'healthcare': 'healthcare', 'Healthcare': 'healthcare',
        'humanservices': 'humanservices', 'human_services': 'humanservices', 'Human Services': 'humanservices',
        'religion': 'religion', 'Religion': 'religion'
    };

    var industryDisplayLabels = {
        'arts': 'Arts & Culture', 'environmental': 'Environmental', 'education': 'Education',
        'communityfoundation': 'Community Foundation', 'healthcare': 'Healthcare',
        'humanservices': 'Human Services', 'religion': 'Religion'
    };

    var industryImageIds = {
        'image-FRdTKXvCKw': 'arts', 'image-jmRsaBRUt0': 'environmental',
        'image-mPaKkFsRIc': 'education', 'image-LAJZMp0Uz7': 'communityfoundation',
        'image-I9s-xC-hNO': 'healthcare', 'image-Ki-dn13age': 'humanservices',
        'image-7Zvkl8xveW': 'religion'
    };

    // Inline browser-compatible port of analytics_compute.js (mirrors the Node module for regression_test.js)
    var computeAnalytics = (function() {
        var _EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
        var _DAY_MS = 86400000;
        function _excelSerialToDate(n) { return new Date(_EXCEL_EPOCH_MS + Math.round(n * _DAY_MS)); }
        function _toDate(v) {
            var d = null;
            if (v === null || v === undefined || v === '') return null;
            if (v instanceof Date) d = isNaN(v.getTime()) ? null : v;
            else if (typeof v === 'number') d = _excelSerialToDate(v);
            else if (typeof v === 'string') {
                var s = v.trim(); if (s === '') return null;
                if (!isNaN(Number(s))) d = _excelSerialToDate(Number(s));
                else { var p = new Date(s); d = isNaN(p.getTime()) ? null : p; }
            }
            if (d && d.getUTCFullYear() < 1900) return null;
            return d;
        }
        function _fyOf(date, fyStart) { var y = date.getUTCFullYear(), m = date.getUTCMonth() + 1; return (fyStart === 1) ? y : (m >= fyStart ? y + 1 : y); }
        function _round2(x) { return Math.round((x + (x >= 0 ? 1e-9 : -1e-9)) * 100) / 100; }
        function _normId(v) { if (v === null || v === undefined) return null; if (typeof v === 'number') return String(v); return String(v).trim().toLowerCase(); }
        var _TYPE_MAP = { 'Bequest': 'Bequests', 'Estate': 'Bequests', 'Individual': 'Individuals', 'Foundation': 'Foundations', 'Family Foundation': 'Foundations', 'Corporation': 'Corporations', 'Organization': 'Corporations', 'Government': '' };
        var _MONTHS = { january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12, jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, sept:9, oct:10, nov:11, dec:12 };
        function _monthNum(v) {
            if (typeof v === 'number' && v >= 1 && v <= 12) return v;
            var s = String(v).trim().toLowerCase();
            if (_MONTHS[s]) return _MONTHS[s];
            var n = Number(s); if (n >= 1 && n <= 12) return n;
            throw new Error('Unrecognized FY Start Month: ' + v);
        }
        function _deriveYearParams(giftRows, fyStartMonth, today) {
            var fyStart = _monthNum(fyStartMonth), t = today || new Date(), fys = [];
            for (var i = 0; i < giftRows.length; i++) { var d = _toDate(giftRows[i][1]); if (d) fys.push(_fyOf(d, fyStart)); }
            if (!fys.length) throw new Error('deriveYearParams: no valid gift dates');
            fys.sort(function(a, b) { return a - b; });
            var minFY = fys[0], maxFY = fys[fys.length - 1];
            var secondSmallest = fys.length > 1 ? fys[1] : fys[0];
            var ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1;
            var currentFY = (fyStart === 1 || tm < fyStart) ? ty : ty + 1;
            var endYear = Math.min(maxFY, currentFY - 1);
            var startRaw = (minFY === 1900) ? secondSmallest : minFY;
            var startYear = Math.max(startRaw, endYear - 9);
            var dataYears = Math.max(1, endYear - startYear + 1);
            return { fyStartMonth: fyStart, endYear: endYear, dataYears: dataYears };
        }
        function _retention(prev, cur, year, fgdfy) {
            var pb = prev === null, cb = cur === null;
            if (pb && cb) return 'Non-Donor';
            if (!pb && prev > 0 && cb) return 'Lost';
            if (fgdfy === year) return 'New Donor';
            if (pb && !cb && cur > 0 && fgdfy !== null && fgdfy < year) return 'Recovered';
            if (!pb && !cb && prev === cur) return 'Retained';
            var gt = (pb && !cb) ? true : (!pb && cb) ? false : (prev > cur);
            return gt ? 'Retained - Decrease' : 'Retained - Increase';
        }
        function _computeAnalytics(giftRows, consRows, params) {
            var fyStart = _monthNum(params.fyStartMonth);
            var endYear = params.endYear, dataYears = params.dataYears;
            if (endYear == null || dataYears == null) { var dp = _deriveYearParams(giftRows, fyStart, params.today); endYear = dp.endYear; dataYears = dp.dataYears; }
            var threshold = params.threshold, doDJ = params.donorJourney !== false;
            var djYear = (params.donorJourneyYear != null) ? params.donorJourneyYear : endYear - 5;
            var years = []; for (var y0 = endYear - dataYears + 1; y0 <= endYear; y0++) years.push(y0);
            var G = giftRows.map(function(r) {
                var cid = _normId(r[0]), date = _toDate(r[1]);
                var amt = (r[2] === '' || r[2] == null || isNaN(Number(r[2]))) ? 0 : Number(r[2]);
                return { cid: cid, date: date, amt: amt, type: r[3], event: r[4], spot: r[5], fy: date ? _fyOf(date, fyStart) : null };
            });
            var tot = {}, minFyMap = {}, minDateMap = {}, matFull = {}, gpyKey = {};
            for (var gi = 0; gi < G.length; gi++) {
                var g = G[gi]; if (g.cid === null) continue;
                tot[g.cid] = (tot[g.cid] || 0) + g.amt;
                if (g.fy !== null) {
                    if (!(g.cid in minFyMap) || g.fy < minFyMap[g.cid]) minFyMap[g.cid] = g.fy;
                    if (!matFull[g.cid]) matFull[g.cid] = {};
                    matFull[g.cid][g.fy] = (matFull[g.cid][g.fy] || 0) + g.amt;
                    var gpk = g.cid + '|' + g.fy; gpyKey[gpk] = (gpyKey[gpk] || 0) + 1;
                }
                if (g.date) { var gt2 = g.date.getTime(); if (!(g.cid in minDateMap) || gt2 < minDateMap[g.cid]) minDateMap[g.cid] = gt2; }
            }
            var djSum = {};
            if (doDJ) { for (var dji = 0; dji < G.length; dji++) { var dg = G[dji]; if (dg.cid !== null && dg.fy === djYear) djSum[dg.cid] = (djSum[dg.cid] || 0) + dg.amt; } }
            function _givingFor(cid, year) {
                var m = matFull[cid]; if (!m) return null;
                var v = m[year]; if (v === undefined) return null;
                v = _round2(v); return v === 0 ? null : v;
            }
            var consFgdMap = {}, consTypeMap = {}, consIdSet = {};
            var C = consRows.map(function(r) {
                var cid = _normId(r[0]), fgd = _toDate(r[3]);
                if (!(cid in consIdSet)) { consFgdMap[cid] = fgd; consTypeMap[cid] = r[2]; consIdSet[cid] = true; }
                return { row: r, cid: cid, fgd: fgd };
            });
            var consCols = ['Constituent ID', 'Constituent Name', 'Constituent Type', 'First Gift Date', 'Board Member?', 'Street Address', 'City', 'State', 'Zip Code', 'First Gift Date FY', 'Total Giving'];
            for (var yi = 0; yi < years.length; yi++) { consCols.push(String(years[yi])); if (yi > 0) consCols.push(years[yi] + ' Retention', years[yi] + ' Lift/Loss'); }
            consCols.push('Consecutive Year Donor', 'Donor Journey Donor', 'Renewals', 'Major Gift Prospect', 'Lapsed Major Donors', 'Mid-Level Giving Prospect', 'Planned Giving Prospect');
            // Drop constituents absent from Gift Data. Ports the DeleteExtraConstituents
            // macro's =COUNTIF('Gift Data'!$A:$A,A2)=0 -> delete rule. That macro ran on the
            // data file *after* this script produced it, so the gift-side aggregates above
            // are deliberately built pre-filter; only the constituent output is pruned.
            // Every derived sheet below reads consOut, so each inherits the filter.
            var giftCidSet = Object.create(null);
            for (var _gci = 0; _gci < G.length; _gci++) { if (G[_gci].cid !== null) giftCidSet[G[_gci].cid] = true; }
            var consOut = C.filter(function(c) { return c.cid !== null && (c.cid in giftCidSet); }).map(function(c) {
                var cid = c.cid, fgdfy;
                if (c.fgd === null) fgdfy = (cid in minFyMap) ? minFyMap[cid] : null;
                else { var fy_y = c.fgd.getUTCFullYear(), fy_m = c.fgd.getUTCMonth() + 1; fgdfy = (fyStart === 1) ? fy_y : (fy_m < fyStart ? fy_y : fy_y + 1); }
                var totalGiving = _round2(tot[cid] || 0);
                var giving = {}; for (var yi2 = 0; yi2 < years.length; yi2++) giving[years[yi2]] = _givingFor(cid, years[yi2]);
                var ret = {}, ll = {};
                for (var ri = 1; ri < years.length; ri++) {
                    var ry = years[ri], rr = _retention(giving[years[ri-1]], giving[ry], ry, fgdfy); ret[ry] = rr;
                    var llv = '';
                    if (rr.indexOf('Retained -') === 0) llv = (giving[years[ri-1]] === null || giving[ry] === null) ? '' : _round2(giving[ry] - giving[years[ri-1]]);
                    else if (rr === 'Lost') llv = (giving[years[ri-1]] === null) ? '' : _round2(-giving[years[ri-1]]);
                    else if (rr === 'Recovered') llv = (giving[ry] === null) ? '' : _round2(giving[ry]);
                    ll[ry] = llv;
                }
                var w5 = years.slice(-5);
                var consecutive = (w5.length === 5 && w5.every(function(y) { return giving[y] !== null; })) ? 'Yes' : '';
                var donorJourney = '';
                if (doDJ) donorJourney = (_givingFor(cid, endYear - 5) !== null) ? 'Yes' : '';
                var w4 = years.slice(-4), lastY = years[years.length - 1];
                var block = [];
                for (var bi = 0; bi < w4.length; bi++) block.push(giving[w4[bi]]);
                for (var bli = 0; bli < w4.length - 1; bli++) { var blv = ll[w4[bli]]; if (blv !== '' && blv != null) block.push(blv); }
                var cntMid = 0, cntMaj = 0;
                for (var bci = 0; bci < block.length; bci++) { var bv = block[bci]; if (bv != null && bv !== '') { if (bv >= 500 && bv < threshold) cntMid++; if (bv >= threshold) cntMaj++; } }
                var y9_10 = (w4.length >= 2) ? (giving[w4[w4.length-2]] !== null || giving[w4[w4.length-1]] !== null) : (giving[lastY] !== null);
                var majorProspect = (cntMid >= 3 && y9_10) ? 'Yes' : '';
                var lapsed = (giving[lastY] !== null && giving[lastY] < threshold && cntMaj > 0) ? 'Yes' : '';
                var renewals = (giving[lastY] !== null && giving[lastY] >= threshold) ? 'Yes' : '';
                var allnb4 = w4.length > 0, wmin = Infinity, wmax = -Infinity;
                for (var wi = 0; wi < w4.length; wi++) { var wv = giving[w4[wi]]; if (wv === null) allnb4 = false; else { if (wv < wmin) wmin = wv; if (wv > wmax) wmax = wv; } }
                var midlevel = (allnb4 && wmin >= 250 && wmax < 1000) ? 'Yes' : '';
                var planned = (w5.length === 5);
                for (var pi = 0; pi < w5.length; pi++) { var pv = giving[w5[pi]]; if (pv === null || !(pv > 0)) planned = false; }
                var plannedGiving = planned ? 'Yes' : '';
                var out = c.row.slice(0, 9);
                out.push(fgdfy, totalGiving);
                for (var oi = 0; oi < years.length; oi++) { out.push(giving[years[oi]] === null ? '' : giving[years[oi]]); if (oi > 0) out.push(ret[years[oi]], ll[years[oi]]); }
                out.push(consecutive, donorJourney, renewals, majorProspect, lapsed, midlevel, plannedGiving);
                return out;
            });
            var giftCols = ['Constituent ID', 'Gift Date', 'Gift Amount', 'Gift Type', 'Event', 'Spotlights', 'Gifts Per Year', 'Gift Month', 'Gift FY', 'Donor Journey Donor', 'FGD', 'National Breakdown'];
            var giftOut = G.map(function(g, idx) {
                var gpy = g.fy !== null ? gpyKey[g.cid + '|' + g.fy] : '';
                var month = g.date ? g.date.getUTCMonth() + 1 : '';
                var fy2 = g.fy === null ? '' : g.fy;
                var dj2 = (doDJ && (djSum[g.cid] || 0) > 0) ? 'Yes' : '';
                var fgd2;
                if (g.cid in consIdSet) fgd2 = consFgdMap[g.cid];
                else fgd2 = (g.cid in minDateMap) ? new Date(minDateMap[g.cid]) : null;
                var fgd2Serial = fgd2 ? Math.round((fgd2.getTime() - _EXCEL_EPOCH_MS) / _DAY_MS) : null;
                var t2 = consTypeMap[g.cid];
                var nat = _TYPE_MAP.hasOwnProperty(t2) ? _TYPE_MAP[t2] : 'Individuals';
                var raw = giftRows[idx];
                return [raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], gpy, month, fy2, dj2, fgd2Serial, nat];
            });
            // ---- Donor / Prospect sheet outputs ----
            // Column index helpers into a consOut row (0-based):
            //   years[0] giving  -> 11
            //   years[k] giving  -> 3k+9  (k >= 1)
            //   years[k] ret     -> 3k+10 (k >= 1)
            //   flag cols base   -> 3n+9  (n = years.length)
            //     +0 Consecutive Year Donor, +1 DJ, +2 Renewals, +3 Major Gift Prospect,
            //     +4 Lapsed Major Donors, +5 Mid-Level, +6 Planned Giving
            var _n = years.length;
            var _gIdx = function(k) { return k === 0 ? 11 : 3 * k + 9; };
            var _rIdx = function(k) { return 3 * k + 10; };
            var _fBase = 3 * _n + 9;
            var _F_CON = _fBase, _F_REN = _fBase + 2, _F_MGP = _fBase + 3,
                _F_LMD = _fBase + 4, _F_MID = _fBase + 5, _F_PLN = _fBase + 6;
            var _lK = _n - 1;
            var _endGIdx = _gIdx(_lK);
            var _endRIdx = _lK >= 1 ? _rIdx(_lK) : null;
            var _prevGIdx = _lK >= 1 ? _gIdx(_lK - 1) : null;

            var _idNameCols = ['Constituent ID', 'Constituent Name'];
            var _flagRows = function(fi) {
                return consOut.filter(function(r) { return r[fi] === 'Yes'; })
                    .map(function(r) { return [r[0], r[1]]; });
            };

            // All Donors: gave in EndYear
            var allDonorsCols = ['Constituent ID', 'Constituent Name', 'Street Address', 'City', 'State', 'Zip Code', 'Giving'];
            var allDonorsRows = consOut
                .filter(function(r) { return r[_endGIdx] !== '' && r[_endGIdx] !== null; })
                .map(function(r) { return [r[0], r[1], r[5], r[6], r[7], r[8], r[_endGIdx]]; });

            // Major Donors: gave > threshold in EndYear
            var majorDonorsRows = consOut
                .filter(function(r) { return r[_endGIdx] !== '' && r[_endGIdx] !== null && r[_endGIdx] > threshold; })
                .map(function(r) { return [r[0], r[1], r[5], r[6], r[7], r[8], r[_endGIdx]]; });

            // Decreased Giving Donors
            var decreasedCols = ['Constituent ID', 'Constituent Name',
                String(endYear - 1) + ' Giving', String(endYear) + ' Giving', 'Loss'];
            var decreasedRows = (_endRIdx !== null && _prevGIdx !== null)
                ? consOut.filter(function(r) { return r[_endRIdx] === 'Retained - Decrease'; })
                    .map(function(r) {
                        var prev = r[_prevGIdx] !== '' ? r[_prevGIdx] : null;
                        var cur  = r[_endGIdx]  !== '' ? r[_endGIdx]  : null;
                        var loss = (prev !== null && cur !== null) ? _round2(cur - prev) : '';
                        return [r[0], r[1], prev !== null ? prev : '', cur !== null ? cur : '', loss];
                    })
                : [];

            // Consecutive Giving Donors: last up-to-5 years of giving
            var _c5k = [];
            for (var _k = Math.max(0, _lK - 4); _k <= _lK; _k++) _c5k.push(_k);
            var consecCols = ['Constituent ID', 'Constituent Name'].concat(
                _c5k.map(function(k) { return String(years[k]) + ' Giving'; }));
            var consecRows = consOut
                .filter(function(r) { return r[_F_CON] === 'Yes'; })
                .map(function(r) {
                    return [r[0], r[1]].concat(_c5k.map(function(k) { return r[_gIdx(k)] !== '' ? r[_gIdx(k)] : ''; }));
                });

            // All Prospects: constituents with at least one prospect flag = "Yes"
            var allProspectsCols = ['Constituent ID', 'Constituent Name',
                'Renewals', 'Major Gift Prospect', 'Lapsed Major Donors',
                'Mid-Level Giving Prospect', 'Planned Giving Prospect'];
            var allProspectsRows = consOut
                .filter(function(r) {
                    return r[_F_REN] === 'Yes' || r[_F_MGP] === 'Yes' || r[_F_LMD] === 'Yes' ||
                           r[_F_MID] === 'Yes' || r[_F_PLN] === 'Yes';
                })
                .map(function(r) {
                    return [r[0], r[1], r[_F_REN] || '', r[_F_MGP] || '', r[_F_LMD] || '',
                            r[_F_MID] || '', r[_F_PLN] || ''];
                });

            return {
                gift:                    { columns: giftCols,          rows: giftOut },
                constituent:             { columns: consCols,          rows: consOut },
                allDonors:               { columns: allDonorsCols,     rows: allDonorsRows },
                majorDonors:             { columns: allDonorsCols,     rows: majorDonorsRows },
                allProspects:            { columns: allProspectsCols,  rows: allProspectsRows },
                renewals:                { columns: _idNameCols,       rows: _flagRows(_F_REN) },
                majorGiftProspects:      { columns: _idNameCols,       rows: _flagRows(_F_MGP) },
                lapsedMajorDonors:       { columns: _idNameCols,       rows: _flagRows(_F_LMD) },
                midLevelProspects:       { columns: _idNameCols,       rows: _flagRows(_F_MID) },
                plannedGivingProspects:  { columns: _idNameCols,       rows: _flagRows(_F_PLN) },
                decreasedGivingDonors:   { columns: decreasedCols,     rows: decreasedRows },
                consecutiveGivingDonors: { columns: consecCols,        rows: consecRows },
            };
        }
        return _computeAnalytics;
    })();

    function detectIndustry() {
        console.log('=== Starting Industry Detection ===');
        
        var urlParams = new URLSearchParams(window.location.search);
        var industryParam = urlParams.get('industry');
        if (industryParam && industryParamMap[industryParam]) {
            console.log('✓ DETECTED from URL param:', industryParamMap[industryParam]);
            return industryParamMap[industryParam];
        }

        try {
            if (window.parent && window.parent !== window && window.parent.selectedIndustryKey) {
                var parentKey = window.parent.selectedIndustryKey;
                if (industryParamMap[parentKey]) {
                    console.log('✓ DETECTED from parent window:', industryParamMap[parentKey]);
                    return industryParamMap[parentKey];
                }
            }
        } catch (e) { console.log('Cannot access parent window'); }

        if (window.selectedIndustryKey && industryParamMap[window.selectedIndustryKey]) {
            console.log('✓ DETECTED from global var:', industryParamMap[window.selectedIndustryKey]);
            return industryParamMap[window.selectedIndustryKey];
        }
        
        // METHOD 4: Legacy image detection - only use if exactly ONE image is visible
        var visibleImages = [];
        for (var imageId in industryImageIds) {
            if (industryImageIds.hasOwnProperty(imageId)) {
                var img = document.getElementById(imageId);
                if (img) {
                    var style = window.getComputedStyle(img);
                    var rect = img.getBoundingClientRect();
                    if (style.display !== 'none' && style.visibility !== 'hidden' &&
                        parseFloat(style.opacity) > 0 && rect.width > 0 && rect.height > 0) {
                        visibleImages.push(industryImageIds[imageId]);
                    }
                }
            }
        }
        if (visibleImages.length === 1) {
            console.log('✓ DETECTED from single visible image:', visibleImages[0]);
            return visibleImages[0];
        } else if (visibleImages.length > 1) {
            console.log('Multiple industry images visible (' + visibleImages.length + '), skipping image detection');
        }
        
        console.log('✗ No industry detected');
        return null;
    }

    function setIndustryTypeField(industryLabel) {
        if (!industryLabel) return;
        console.log('Setting IndustryType field to:', industryLabel);
        
        function trySetField() {
            var industryField = null;
            var labels = document.querySelectorAll('label');
            for (var i = 0; i < labels.length; i++) {
                var txt = labels[i].textContent;
                if (txt.indexOf('IndustryType') !== -1 || txt.indexOf('Industry Type') !== -1 || txt.indexOf('industry_type') !== -1) {
                    var container = labels[i].closest('div');
                    if (container) industryField = container.querySelector('input');
                    break;
                }
            }
            if (!industryField) industryField = document.querySelector('input[name*="industry_type"]');
            if (!industryField) industryField = document.querySelector('input[name*="IndustryType"]');
            
            if (industryField) {
                industryField.value = industryLabel;
                industryField.dispatchEvent(new Event('input', { bubbles: true }));
                industryField.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✓ IndustryType set to:', industryLabel);
                return true;
            }
            return false;
        }
        
        if (!trySetField()) {
            var attempts = 0;
            var retry = setInterval(function() {
                attempts++;
                if (trySetField() || attempts >= 30) {
                    clearInterval(retry);
                    if (attempts >= 30) console.log('✗ IndustryType field not found after retries');
                }
            }, 500);
        }
    }

    // Finds a page-provided file input for the organization logo by locating a
    // <label> whose text mentions "Logo" and reading the nearest file input's
    // currently-selected file. Mirrors setIndustryTypeField's DOM-search
    // pattern above, since both rely on a field the surrounding page provides
    // rather than one mapper.js creates itself.
    function getLogoFile() {
        var labels = document.querySelectorAll('label');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.indexOf('Logo') !== -1) {
                var container = labels[i].closest('div');
                var input = container ? container.querySelector('input[type="file"]') : null;
                if (input && input.files && input.files[0]) return input.files[0];
            }
        }
        var fallback = document.querySelector('input[type="file"][name*="logo"]')
                     || document.querySelector('input[type="file"][name*="Logo"]');
        return (fallback && fallback.files && fallback.files[0]) ? fallback.files[0] : null;
    }

    window.addEventListener('message', function(event) {
        var data = event.data;
        if (data && data.type === 'setIndustryType' && data.value) {
            console.log('Received industry via postMessage:', data.value);
            selectedIndustryType = data.value;
            setIndustryTypeField(data.value);
        }
        // Respond with mappingBoxLabel position for outer page scroll
        if (data && data.type === 'getMapperBoxTop') {
            var el = document.getElementById('uploadTitle') || document.getElementById('mappingBoxLabel') || document.getElementById('mappingBox');
            if (el) {
                var offsetTop = el.getBoundingClientRect().top + window.pageYOffset;
                window.parent.postMessage({ type: 'mapperBoxTop', offsetTop: offsetTop }, '*');
            }
        }
    });

    function setSpotlightConfig(industry) {
        if (industry === 'arts') {
            spotlightConfig = { type: 'giftAppeal', title: 'Map Spotlights', categories: ['Tickets', 'Season Ticket Holders', 'Skip'], completionText: 'You have successfully mapped all Gift Appeals to spotlight categories.' };
        } else if (industry === 'education') {
            spotlightConfig = { type: 'giftAppeal', title: 'Map Spotlights', categories: ['Alumni', 'Parent & Grandparent', 'Skip'], completionText: 'You have successfully mapped all Gift Appeals to spotlight categories.' };
        } else if (industry === 'communityfoundation') {
            spotlightConfig = { type: 'constituentType', title: 'Map Spotlights', categories: ['Donor', 'Fundholder', 'Skip'], completionText: 'You have successfully mapped all Constituent Types to spotlight categories.' };
        } else if (industry === 'healthcare') {
            spotlightConfig = { type: 'constituentType', title: 'Map Spotlights', categories: ['Patient', 'Physician', 'Skip'], completionText: 'You have successfully mapped all Constituent Types to spotlight categories.' };
        }
        if (spotlightConfig) console.log('✓ Spotlight config:', spotlightConfig.type, spotlightConfig.categories);
        else console.log('No spotlight config for:', industry);
    }

    function initializeStepTracker() {
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;
        var stepLabels = [];
        if (isSimpleFlow) {
            if (isStaffing && solicitors.length > 0) stepLabels.push('Solicitor Selection');
            else if (isDevelopmentAssessment && appealCategories.length > 0) stepLabels.push('Appeals Category Mapping');
            else if (isCampaignCounsel && pledgeStatuses.length > 0) stepLabels.push('Pledge Status Mapping');
            if (!constituentMappingSkipped) stepLabels.push('Constituent Type Mapping');
            if (!giftTypeMappingSkipped) stepLabels.push('Gift Type Mapping');
        } else {
            if (!specialEventSkipped) stepLabels.push('Special Event Mapping');
            if (!spotlightSkipped && spotlightConfig) stepLabels.push('Spotlight Mapping');
            if (!constituentMappingSkipped) stepLabels.push('Constituent Type Mapping');
            if (!giftTypeMappingSkipped) stepLabels.push('Gift Type Mapping');
        }
        if (stepLabels.length === 0) { document.getElementById('stepProgress').style.display = 'none'; return; }
        var steps = stepLabels.map(function(label, i) { return { label: label, number: i + 1 }; });
        var html = '';
        for (var i = 0; i < steps.length; i++) {
            html += '<div class="step-item"><div class="step-circle">' + steps[i].number + '</div><div class="step-label">' + steps[i].label + '</div></div>';
            if (i < steps.length - 1) html += '<div class="step-connector"></div>';
        }
        stepTracker.innerHTML = html;
        var offset = 'calc(100% / ' + (steps.length * 2) + ')';
        stepTracker.style.setProperty('--tracker-offset', offset);
        document.getElementById('stepProgress').style.display = 'block';
    }

    function getStepIndex(label) {
        var tracker = document.getElementById('stepTracker');
        if (!tracker) return 0;
        var items = tracker.querySelectorAll('.step-label');
        for (var i = 0; i < items.length; i++) { if (items[i].textContent === label) return i; }
        return items.length; // past all steps → all completed
    }

    function updateStepTracker(step) {
        currentStep = step;
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;
        var items = stepTracker.querySelectorAll('.step-item');
        var circles = stepTracker.querySelectorAll('.step-circle');
        for (var i = 0; i < items.length; i++) {
            if (i === step) {
                // Current active step
                items[i].classList.add('active'); items[i].classList.remove('completed');
                circles[i].classList.add('active'); circles[i].classList.remove('completed');
                circles[i].textContent = (i+1).toString();
            } else if (i < step) {
                // Completed or skipped — both show checkmark
                items[i].classList.remove('active'); items[i].classList.add('completed');
                circles[i].classList.add('completed'); circles[i].classList.remove('active');
                circles[i].textContent = '✓';
            } else {
                // Future step — neutral
                items[i].classList.remove('active','completed');
                circles[i].classList.remove('active','completed');
                circles[i].textContent = (i+1).toString();
            }
        }
    }

    function waitForElement(selector, callback) {
        var interval = setInterval(function() {
            var el = document.querySelector(selector);
            if (el) { clearInterval(interval); callback(el); }
        }, 100);
    }

    function init() {
        // Check URL params on load - if industry param exists, detect and set field
        var urlParams = new URLSearchParams(window.location.search);
        var industryParam = urlParams.get('industry');
        if (industryParam && industryParamMap[industryParam]) {
            var detected = industryParamMap[industryParam];
            selectedIndustryType = industryDisplayLabels[detected] || null;
            console.log('✓ Industry from URL on init:', detected, '(' + selectedIndustryType + ')');
            if (selectedIndustryType) setIndustryTypeField(selectedIndustryType);
            if (!isSimpleFlow) setSpotlightConfig(detected);
        }

        // Hide custom submit button until all mapping is complete
        waitForElement('#customSubmitBtn', function(btn) {
            btn.parentElement.style.display = 'none';
        });

        // Hide GHL's Client Data File upload field and submit button via JS
        (function hideGHLElements() {
            var selectors = [
                '#el_5GIq2FyRJrWJv32C9avI_btJHfCz265PqHT9D7m9S_13',
                '#el_5GIq2FyRJrWJv32C9avI_button_12'
            ];
            var allFound = true;
            selectors.forEach(function(sel) {
                var el = document.querySelector(sel);
                if (el) { el.style.display = 'none'; }
                else { allFound = false; }
            });
            // Also hide by name attribute as fallback
            var fileInputs = document.querySelectorAll('input[type="file"]');
            fileInputs.forEach(function(input) {
                if (input.name && input.name.indexOf('Client Data File') !== -1) {
                    var wrapper = input.closest('.file-upload') || input.closest('.form-field-wrapper');
                    if (wrapper) wrapper.style.display = 'none';
                }
            });
            var submitBtn = document.querySelector('#_builder-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.style.display = 'none';
                var wrapper = submitBtn.closest('.form-field-wrapper');
                if (wrapper) wrapper.style.display = 'none';
            }
            if (!allFound) setTimeout(hideGHLElements, 500);
        })();

        // Block native form submission if no file has been uploaded and processed
        waitForElement('form', function(form) {
            form.addEventListener('submit', function(e) {
                if (!workbook) {
                    e.preventDefault();
                    e.stopPropagation();
                    alert('Please upload and process your Client Data file before submitting.');
                    return false;
                }
            }, true);
        });

        // uploadTitle pre-styled in HTML

        // uploadBox pre-styled in HTML - just attach click listener
        waitForElement('#uploadBox', function(el) {
            el.style.border = '1px solid #ACACACFF';
            el.style.borderRadius = '8px';
            el.style.minHeight = '74px';
            // Remove GHL's default icon elements but keep any <input> elements
            var kids = Array.prototype.slice.call(el.children);
            for (var k = 0; k < kids.length; k++) { if (kids[k].tagName !== 'INPUT') el.removeChild(kids[k]); }
            // Insert our SVG icon before any remaining inputs
            var iconWrap = document.createElement('div');
            iconWrap.id = 'uploadIconWrap';
            iconWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:14px 0;pointer-events:none;';
            iconWrap.innerHTML = uploadIconSvg;
            el.insertBefore(iconWrap, el.firstChild);
            el.addEventListener('click', function() { document.getElementById('fileInput').click(); });
        });

        // uploadSection pre-styled in HTML

        // Reveal mapper-container once JS is ready, then signal parent to show iframe
        waitForElement('#mapper-container', function(mc) {
            var menuWrap = mc.closest('.menu-field-wrap');
            if (menuWrap) { menuWrap.style.paddingLeft = '0'; menuWrap.style.paddingRight = '0'; }
            mc.style.visibility = 'visible';
            mc.style.padding = '0px 0px';
            mc.style.width = '713px';
            // Signal parent page that mapper is ready to be shown
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'mapperReady', mapperVersion: MAPPER_VERSION }, '*');
            }
        });

        waitForElement('#fileInput', function(el) { el.addEventListener('change', handleFileUpload); });

        // Create Download Template button AFTER the upload box, before the note
        waitForElement('#uploadNote', function(noteEl) {
            var downloadContainer = document.createElement('div');
            downloadContainer.id = 'download-container';
            downloadContainer.style.cssText = 'padding:0;display:flex;justify-content:center;align-items:center;margin-top:10px;margin-bottom:0;';
            var downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download Template File';
            downloadBtn.type = 'button';
            downloadBtn.style.cssText = 'background-color:#ffffff;color:' + themeColor + ';font-family:Roboto,sans-serif;font-size:14px;font-weight:600;padding:10px 30px;border:2px solid ' + themeColor + ';border-radius:8px;cursor:pointer;display:inline-block;transition:transform 0.3s ease;';
            downloadBtn.onmouseover = function() { this.style.transform = 'translateY(-5px)'; };
            downloadBtn.onmouseout = function() { this.style.transform = 'translateY(0)'; };
            downloadBtn.addEventListener('click', function() {
                var templateUrl = isStaffing
                    ? 'https://assets.cdn.filesafe.space/CwIkkwa8MTjmkcKkZaGX/media/69f41949cad250291f4bf0cb.xlsx'
                    : isDevelopmentAssessment
                    ? 'https://assets.cdn.filesafe.space/CwIkkwa8MTjmkcKkZaGX/media/69f4d41f23e63d676c8653d7.xlsx'
                    : isCampaignCounsel
                    ? 'https://assets.cdn.filesafe.space/CwIkkwa8MTjmkcKkZaGX/media/69f50560daa24d98950cd696.xlsx'
                    : 'https://assets.cdn.filesafe.space/CwIkkwa8MTjmkcKkZaGX/media/699de24d52a4028ce9b402d1.xlsx';
                var filename = 'Data Upload Template.xlsx';
                fetch(templateUrl)
                    .then(function(response) { return response.blob(); })
                    .then(function(blob) {
                        var link = document.createElement('a');
                        link.href = URL.createObjectURL(blob);
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(link.href);
                    })
                    .catch(function() {
                        var link = document.createElement('a');
                        link.href = templateUrl;
                        link.download = filename;
                        link.click();
                    });
            });
            downloadContainer.appendChild(downloadBtn);
            noteEl.parentNode.insertBefore(downloadContainer, noteEl);
            // Update note text
            noteEl.innerHTML = 'Note: the Client Data file <strong>must</strong> use the designated template.<br>Use the link above to download the template.';
        });
        waitForElement('#categoryInput', function(el) { el.addEventListener('keypress', function(e) { if (e.key === 'Enter') addCategory(); }); });
        waitForElement('#addCategoryBtn', function(el) { el.addEventListener('click', addCategory); });
        waitForElement('#startMappingBtn', function(el) {
            el.addEventListener('click', startMapping);
            // Move skip button into the same flex row as this button
            var skipBtn = document.getElementById('skipSpecialEventBtn');
            if (skipBtn && el.parentNode) {
                el.parentNode.appendChild(skipBtn);
                skipBtn.style.cssText = 'display:inline-block;padding:12px 32px;border-radius:8px;background:white;color:' + themeColor + ';border:1px solid ' + themeColor + ';font-size:15px;font-weight:400;cursor:pointer;font-family:Roboto,sans-serif;';
            }
        });
        waitForElement('#skipSpecialEventBtn', function(el) {
            el.addEventListener('click', function() {
                document.getElementById('categorySetup').style.display = 'none';
                specialEventSkipped = true;
                // Let the destination function set the tracker state correctly
                if (spotlightConfig) { startSpotlightMapping(); }
                else { startConstituentMapping(); }
            });
        });
        waitForElement('#startConstituentMappingBtn', function(el) { el.addEventListener('click', startConstituentMapping); });
        waitForElement('#skipSpotlightBtn', function(el) {
            el.addEventListener('click', function() {
                spotlightSkipped = true;
                document.getElementById('spotlightMappingSection').style.display = 'none';
                var ssw = document.getElementById('spotlightSkipWrapper'); if (ssw) ssw.style.display = 'none';
                startConstituentMapping();
            });
        });
        waitForElement('#startGiftTypeMappingBtn', function(el) { el.addEventListener('click', startGiftTypeMapping); });
        waitForElement('#categoriesList', function(el) { el.addEventListener('click', function(e) { if (e.target.tagName === 'BUTTON') removeCategory(parseInt(e.target.getAttribute('data-index'))); }); });

        // Wrap mapping sections in a GHL-style box with label
        waitForElement('#categorySetup', function(catSetup) {
            var parent = catSetup.parentNode;
            // Create label
            var label = document.createElement('div');
            label.id = 'mappingBoxLabel';
            label.textContent = 'Client Data File Mapping';
            label.style.cssText = 'margin-bottom:10px;margin-top:15px;color:#2c3345;text-align:left;font-family:Inter,sans-serif;font-size:14px;font-weight:500;display:none;';
            // Create wrapper box
            var box = document.createElement('div');
            box.id = 'mappingBox';
            box.style.cssText = 'border:none;padding:20px;background:white;width:100%;box-sizing:border-box;display:none;';
            // Insert label and box before categorySetup
            parent.insertBefore(label, catSetup);
            parent.insertBefore(box, catSetup);
            // Inject tooltip CSS for pledge status buttons
            if (!document.getElementById('pledge-tooltip-style')) {
                var tipStyle = document.createElement('style');
                tipStyle.id = 'pledge-tooltip-style';
                tipStyle.textContent = '.info-icon-wrap{display:inline-block;cursor:help;color:#aaa;font-size:13px;vertical-align:middle;margin-left:5px;user-select:none;}.info-icon-wrap:hover{color:#555;}#pledgeInfoPopup{display:none;position:fixed;left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100% - 40px);background:rgba(30,30,30,0.95);color:#fff;font-family:Roboto,sans-serif;font-size:12px;font-weight:400;padding:10px 14px;border-radius:8px;z-index:9999;pointer-events:none;line-height:1.6;text-align:left;box-shadow:0 4px 12px rgba(0,0,0,0.3);}.info-popup-item{margin-bottom:5px;}.info-popup-item:last-child{margin-bottom:0;}.info-popup-label{font-weight:700;}';
                document.head.appendChild(tipStyle);
            }

            // Create pledge status mapping section dynamically (Campaign Counsel only)
            var pledgeSection = document.createElement('div');
            pledgeSection.id = 'pledgeStatusMappingSection';
            pledgeSection.style.display = 'none';
            pledgeSection.innerHTML = '<h2>Pledge Status Mapping</h2>'
                + '<div class="progress-container" style="margin-top:16px;margin-bottom:16px;">'
                + '<div style="background:#eee;border-radius:99px;height:24px;overflow:hidden;margin-bottom:8px;">'
                + '<div id="pledgeStatusProgressBar" style="height:100%;border-radius:99px;background:' + themeColor + ';width:0%;transition:width 0.3s;display:flex;align-items:center;justify-content:center;">'
                + '<span id="pledgeStatusProgressBarText" style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;"></span>'
                + '</div>'
                + '</div>'
                + '<div style="text-align:center;font-size:14px;font-weight:600;color:' + themeColor + ';margin-top:6px;"><span id="pledgeStatusProgressText">0 of 0 Pledge Statuses Mapped</span></div>'
                + '</div>'
                + '<div id="pledgeStatusMappingContainer"></div>'
                + '<div id="pledgeStatusCompletionCard" class="completion-card" style="display:none;">'
                + '<div style="font-size:1.4rem;font-weight:700;color:#111827;margin-bottom:14px;">🎉 Pledge Status Mapping Complete!</div>'
                + '<p>You\'ve successfully mapped all Pledge Statuses.</p>'
                + '<p style="margin-bottom:24px;">Click below to continue to Constituent Type mapping.</p>'
                + '<button id="startConstituentFromPledgeBtn" type="button" style="background-color:' + themeColor + ';color:#fff;font-family:Roboto,sans-serif;font-size:15px;font-weight:600;padding:12px 40px;border:none;border-radius:8px;cursor:pointer;">Continue to Constituent Mapping ➡</button>'
                + '</div>';
            parent.insertBefore(pledgeSection, catSetup);

            // Create appeal category mapping section dynamically (DA only)
            var appealCatSection = document.createElement('div');
            appealCatSection.id = 'appealCategoryMappingSection';
            appealCatSection.style.display = 'none';
            appealCatSection.innerHTML = '<h2>Appeals Category Mapping</h2>'
                + '<div class="progress-container" style="margin-top:16px;margin-bottom:16px;">'
                + '<div style="background:#eee;border-radius:99px;height:24px;overflow:hidden;margin-bottom:8px;">'
                + '<div id="appealCategoryProgressBar" style="height:100%;border-radius:99px;background:' + themeColor + ';width:0%;transition:width 0.3s;display:flex;align-items:center;justify-content:center;">'
                + '<span id="appealCategoryProgressBarText" style="font-size:12px;font-weight:600;color:#fff;white-space:nowrap;"></span>'
                + '</div>'
                + '</div>'
                + '<div style="text-align:center;font-size:14px;font-weight:600;color:' + themeColor + ';margin-top:6px;"><span id="appealCategoryProgressText">0 of 0 Appeals Mapped</span></div>'
                + '</div>'
                + '<div id="appealCategoryMappingContainer"></div>'
                + '<div id="appealCategoryCompletionCard" class="completion-card" style="display:none;">'
                + '<div style="font-size:1.4rem;font-weight:700;color:#111827;margin-bottom:14px;">🎉 Appeals Mapping Complete!</div>'
                + '<p>You\'ve successfully mapped all Gift Appeals to categories.</p>'
                + '<p style="margin-bottom:24px;">Click below to continue to Constituent Type mapping.</p>'
                + '<button id="startConstituentFromAppealBtn" type="button" style="background-color:' + themeColor + ';color:#fff;font-family:Roboto,sans-serif;font-size:15px;font-weight:600;padding:12px 40px;border:none;border-radius:8px;cursor:pointer;">Continue to Constituent Mapping ➡</button>'
                + '</div>';
            parent.insertBefore(appealCatSection, catSetup);

            // Create solicitor selection section dynamically (staffing only)
            var solicitorSection = document.createElement('div');
            solicitorSection.id = 'solicitorSelectionSection';
            solicitorSection.style.display = 'none';
            solicitorSection.innerHTML = '<h2 style="text-align:center;margin-bottom:10px;">Solicitor Selection</h2>'
                + '<div style="text-align:center;margin-bottom:20px;color:#666;font-weight:600;">Review your solicitors below and deselect any who are no longer active.</div>'
                + '<div id="solicitorButtonsContainer" class="category-buttons allow-wrap" style="justify-content:center;gap:10px;"></div>'
                + '<div style="text-align:center;margin-top:25px;">'
                + '<button id="solicitorDoneBtn" type="button" style="background-color:' + themeColor + ';color:white;font-family:Roboto,sans-serif;font-size:15px;font-weight:600;padding:12px 40px;border:none;border-radius:8px;cursor:pointer;">Continue to Constituent Mapping ➡</button>'
                + '</div>';
            parent.insertBefore(solicitorSection, catSetup);

            // Move all mapping sections into the box
            var sections = ['categorySetup', 'mappingSection', 'spotlightMappingSection', 'pledgeStatusMappingSection', 'appealCategoryMappingSection', 'solicitorSelectionSection', 'constituentMappingSection', 'giftTypeMappingSection', 'stepProgress'];
            sections.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) box.appendChild(el);
            });

            // Inject unified "All Done" card into giftTypeMappingSection
            var giftTypeSec = document.getElementById('giftTypeMappingSection');
            if (giftTypeSec) {
                var allDoneCard = document.createElement('div');
                allDoneCard.id = 'allDoneCard';
                allDoneCard.className = 'completion-card';
                allDoneCard.style.display = 'none';
                var _months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                var _monthOpts = _months.map(function(m){ return '<option value="' + m + '">' + m + '</option>'; }).join('');
                var _inp = 'width:100%;padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:0.9rem;box-sizing:border-box;outline:none;';
                var _lbl = 'display:block;font-size:0.82rem;font-weight:600;color:#374151;margin-bottom:4px;';
                var _req = '<span style="color:#ef4444;">*</span>';
                allDoneCard.innerHTML = ''
                    + '<div style="font-size:1.3rem;font-weight:700;color:#111827;margin-bottom:6px;">🎉 All Done! Fill in the details below to submit.</div>'
                    + '<div style="display:grid;gap:12px;margin-top:16px;">'
                    +   '<div>'
                    +     '<label style="' + _lbl + '">Client / Organization Name ' + _req + '</label>'
                    +     '<input id="mapper-client-name" type="text" placeholder="e.g. Smith Animal Shelter" style="' + _inp + '">'
                    +   '</div>'
                    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
                    +     '<div>'
                    +       '<label style="' + _lbl + '">Contact Name ' + _req + '</label>'
                    +       '<input id="mapper-contact-name" type="text" placeholder="Jane Smith" style="' + _inp + '">'
                    +     '</div>'
                    +     '<div>'
                    +       '<label style="' + _lbl + '">Email ' + _req + '</label>'
                    +       '<input id="mapper-email" type="email" placeholder="jane@example.org" style="' + _inp + '">'
                    +     '</div>'
                    +   '</div>'
                    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
                    +     '<div>'
                    +       '<label style="' + _lbl + '">Fiscal Year Start Month ' + _req + '</label>'
                    +       '<select id="mapper-fy-start-month" style="' + _inp + 'background:#fff;cursor:pointer;">'
                    +         '<option value="">Select month...</option>' + _monthOpts
                    +       '</select>'
                    +     '</div>'
                    +     '<div>'
                    +       '<label style="' + _lbl + '">Major Giving Threshold ' + _req + '</label>'
                    +       '<input id="mapper-major-giving-threshold" type="number" value="10000" min="1" placeholder="10000" style="' + _inp + '">'
                    +     '</div>'
                    +   '</div>'
                    +   '<div>'
                    +     '<label style="' + _lbl + '">Number of Board Members</label>'
                    +     '<input id="mapper-board-members" type="number" min="0" placeholder="Optional" style="' + _inp + 'width:auto;min-width:160px;">'
                    +   '</div>'
                    + '</div>';
                giftTypeSec.appendChild(allDoneCard);
            }
        });

        waitForElement('#customSubmitBtn', function(btn) {
            btn.addEventListener('click', function() {
                // Validate submission fields
                var clientName  = (document.getElementById('mapper-client-name')             || {}).value || '';
                var contactName = (document.getElementById('mapper-contact-name')            || {}).value || '';
                var email       = (document.getElementById('mapper-email')                   || {}).value || '';
                var fyMonth     = (document.getElementById('mapper-fy-start-month')          || {}).value || '';
                var threshRaw   = (document.getElementById('mapper-major-giving-threshold')  || {}).value || '';
                var threshold   = parseFloat(threshRaw);
                var boardMembers = (document.getElementById('mapper-board-members')          || {}).value || '';

                if (!clientName.trim())  { alert('Please enter the Client / Organization Name.'); return; }
                if (!contactName.trim()) { alert('Please enter a Contact Name.'); return; }
                if (!email.trim() || email.indexOf('@') < 0) { alert('Please enter a valid email address.'); return; }
                if (!fyMonth)            { alert('Please select the Fiscal Year Start Month.'); return; }
                if (isNaN(threshold) || threshold <= 0) { alert('Please enter a valid Major Giving Threshold.'); return; }
                if (!PA_TRIGGER_URL)     { alert('Submission endpoint not configured. Please contact support.'); return; }

                var originalHTML = btn.innerHTML;
                btn.disabled = true;
                if (!document.getElementById('mapper-spinner-style')) {
                    var spinStyle = document.createElement('style');
                    spinStyle.id = 'mapper-spinner-style';
                    spinStyle.textContent = '@keyframes mapperSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                    document.head.appendChild(spinStyle);
                }
                btn.innerHTML = '<div style="display:inline-flex;align-items:center;gap:10px;"><div style="width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);border-top:3px solid #ffffff;border-radius:50%;animation:mapperSpin 0.8s linear infinite;"></div><span>Uploading...</span></div>';

                setTimeout(function() {
                    var blob = generateExcelBlob();
                    if (!blob) { btn.disabled = false; btn.innerHTML = originalHTML; return; }

                    var formSource   = isSW ? 'SW' : (isKellogg ? 'Databasey' : (isDatabasey ? 'Databasey' : 'Alford'));
                    var analysisType = isStaffing ? 'Interim Staffing' : (isDevelopmentAssessment ? 'Development Assessment' : (isCampaignCounsel ? 'Campaign Counsel' : 'Analytics'));
                    var logoFile = getLogoFile();

                    function submitPayload(logoBase64, logoFilename) {
                        var reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = function() {
                            var base64 = reader.result.split(',')[1];
                            var payload = {
                                company_name:              clientName.trim(),
                                full_name:                 contactName.trim(),
                                email:                     email.trim(),
                                'Fiscal Year Start Month': fyMonth,
                                'Major Giving Threshold':  threshold,
                                '# of Board Members':      boardMembers || '',
                                'Industry Type':           selectedIndustryType || '',
                                form_source:               formSource,
                                analysis_type:             analysisType,
                                file_content:              base64,
                                logo_content:              logoBase64 || '',
                                logo_filename:             logoFilename || ''
                            };
                            fetch(PA_TRIGGER_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            })
                            .then(function(res) {
                                if (res.ok || res.status === 202) {
                                    window.location.href = 'https://getdatabasey.com/submitted';
                                } else {
                                    throw new Error('Server returned ' + res.status);
                                }
                            })
                            .catch(function(err) {
                                console.error('PA submit error:', err);
                                btn.disabled = false;
                                btn.innerHTML = originalHTML;
                                alert('Submission failed — please try again or contact support.\n\nError: ' + err.message);
                            });
                        };
                        reader.onerror = function() {
                            btn.disabled = false;
                            btn.innerHTML = originalHTML;
                            alert('Failed to prepare file for upload. Please try again.');
                        };
                    }

                    if (logoFile) {
                        var logoReader = new FileReader();
                        logoReader.readAsDataURL(logoFile);
                        logoReader.onloadend = function() {
                            submitPayload(logoReader.result.split(',')[1], logoFile.name);
                        };
                        logoReader.onerror = function() {
                            console.warn('Logo file failed to read — submitting without it.');
                            submitPayload('', '');
                        };
                    } else {
                        submitPayload('', '');
                    }
                }, 50);
            });
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('solicitor-toggle-btn')) {
                var sol = e.target.getAttribute('data-solicitor');
                selectedSolicitors[sol] = !selectedSolicitors[sol];
                if (selectedSolicitors[sol]) {
                    e.target.style.background = themeColor; e.target.style.color = 'white'; e.target.style.borderColor = themeColor;
                } else {
                    e.target.style.background = 'white'; e.target.style.color = themeColor; e.target.style.borderColor = themeColor;
                }
            } else if (e.target.classList.contains('category-btn')) {
                var appeal = e.target.getAttribute('data-appeal');
                var cat = e.target.getAttribute('data-category');
                var type = e.target.getAttribute('data-mapping-type');
                if (type === 'event') selectCategory(appeal, cat);
                else if (type === 'spotlight') selectSpotlight(appeal, cat);
                else if (type === 'appealcategory') selectAppealCategory(appeal, cat);
                else if (type === 'pledgestatus') selectPledgeStatus(appeal, cat);
                else if (type === 'constituent') selectConstituentType(appeal, cat);
                else if (type === 'gifttype') selectGiftType(appeal, cat);
            } else if (e.target.classList.contains('nav-btn')) {
                var action = e.target.getAttribute('data-action');
                var navType = e.target.getAttribute('data-mapping-type');
                if (navType === 'event') { if (action === 'previous') previousAppeal(); else if (action === 'next') nextAppeal(); }
                else if (navType === 'spotlight') { if (action === 'previous') previousSpotlight(); else if (action === 'next') nextSpotlight(); }
                else if (navType === 'appealcategory') { if (action === 'previous') previousAppealCategory(); else if (action === 'next') nextAppealCategory(); }
                else if (navType === 'pledgestatus') { if (action === 'previous') previousPledgeStatus(); else if (action === 'next') nextPledgeStatus(); }
                else if (navType === 'constituent') { if (action === 'previous') previousConstituentType(); else if (action === 'next') nextConstituentType(); }
                else if (navType === 'gifttype') { if (action === 'previous') previousGiftType(); else if (action === 'next') nextGiftType(); }
            }
        });

        waitForElement('#solicitorDoneBtn', function(btn) {
            btn.addEventListener('click', function() {
                solicitorSelectionDone = true;
                document.getElementById('solicitorSelectionSection').style.display = 'none';
                startConstituentMapping();
            });
        });

        waitForElement('#startConstituentFromAppealBtn', function(btn) {
            btn.addEventListener('click', startConstituentMapping);
        });

        waitForElement('#startConstituentFromPledgeBtn', function(btn) {
            btn.addEventListener('click', startConstituentMapping);
        });
    }

    function startSolicitorSelection() {
        updateStepTracker(getStepIndex('Solicitor Selection'));
        var section = document.getElementById('solicitorSelectionSection');
        if (section) section.style.display = 'block';
        var container = document.getElementById('solicitorButtonsContainer');
        if (!container) return;
        var html = '';
        for (var i = 0; i < solicitors.length; i++) {
            html += '<button class="category-btn solicitor-toggle-btn" data-solicitor="' + solicitors[i] + '" style="background:' + themeColor + ';color:white;border-color:' + themeColor + ';">' + solicitors[i] + '</button>';
        }
        container.innerHTML = html;
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function isExcelDateVal(v) {
        if (typeof v === 'number' && v > 0 && isFinite(v)) return true;
        if (v instanceof Date) return !isNaN(v.getTime());
        if (typeof v === 'string' && v.trim() !== '') return !isNaN(new Date(v).getTime());
        return false;
    }

    function validateWorkbook(wb, giftJson, constJson) {
        var errors = [];
        var giftHeaders = (XLSX.utils.sheet_to_json(wb.Sheets['Gift Data'], { header: 1 })[0]) || [];
        ['Constituent ID', 'Gift Date', 'Gift Amount'].forEach(function(col) {
            if (giftHeaders.indexOf(col) === -1) errors.push('Gift Data sheet is missing required column: "' + col + '"');
        });
        var constHeaders = (XLSX.utils.sheet_to_json(wb.Sheets['Constituent Data'], { header: 1 })[0]) || [];
        ['Constituent ID', 'Constituent Type'].forEach(function(col) {
            if (constHeaders.indexOf(col) === -1) errors.push('Constituent Data sheet is missing required column: "' + col + '"');
        });
        if (errors.length > 0) return errors;

        if (giftJson.length > 0) {
            var validCID = 0, validDate = 0, validAmt = 0;
            for (var i = 0; i < giftJson.length; i++) {
                var r = giftJson[i];
                var cid = r['Constituent ID'];
                if (cid !== undefined && cid !== null && cid.toString().trim() !== '') validCID++;
                if (isExcelDateVal(r['Gift Date'])) validDate++;
                if (typeof r['Gift Amount'] === 'number' && !isNaN(r['Gift Amount'])) validAmt++;
            }
            if (validCID === 0)  errors.push('Gift Data — Constituent ID column appears to be entirely blank');
            if (validDate === 0) errors.push('Gift Data — Gift Date column contains no valid dates');
            if (validAmt === 0)  errors.push('Gift Data — Gift Amount column contains no valid numbers');
        }
        if (constJson.length > 0) {
            var validConstCID = 0, validConstType = 0;
            for (var j = 0; j < constJson.length; j++) {
                var cr = constJson[j];
                if (cr['Constituent ID'] && cr['Constituent ID'].toString().trim() !== '') validConstCID++;
                if (cr['Constituent Type'] && cr['Constituent Type'].toString().trim() !== '') validConstType++;
            }
            if (validConstCID === 0)  errors.push('Constituent Data — Constituent ID column appears to be entirely blank');
            if (validConstType === 0) errors.push('Constituent Data — Constituent Type column appears to be entirely blank');
        }
        // 6-year minimum data range check (Alford, Databasey, and Kellogg)
        if (!isSW && giftJson.length > 0) {
            var minTs = Infinity, maxTs = -Infinity;
            for (var k = 0; k < giftJson.length; k++) {
                var dv = giftJson[k]['Gift Date'], d = null;
                if (typeof dv === 'number' && dv > 0) d = new Date((dv - 25569) * 86400000);
                else if (typeof dv === 'string' && dv.trim() !== '') { var pd = new Date(dv); if (!isNaN(pd.getTime())) d = pd; }
                else if (dv instanceof Date && !isNaN(dv.getTime())) d = dv;
                if (d) { var t = d.getTime(); if (t < minTs) minTs = t; if (t > maxTs) maxTs = t; }
            }
            if (minTs !== Infinity && (new Date(maxTs).getFullYear() - new Date(minTs).getFullYear()) < 5) {
                errors.push('Gift Data must contain at least 6 years of history — found data from '
                    + new Date(minTs).getFullYear() + ' to ' + new Date(maxTs).getFullYear());
            }
        }
        return errors;
    }

    function showUploadValidationError(errors) {
        workbook = null;
        var fi = document.getElementById('fileInput'); if (fi) fi.value = '';
        var dn = document.getElementById('uploadNote'); if (dn) dn.style.display = '';
        var dd = document.getElementById('download-container'); if (dd) dd.style.display = 'flex';
        var uploadBox = document.getElementById('uploadBox');
        uploadBox.style.cursor = 'pointer';
        uploadBox.style.border = '1px solid #f87171';
        var html = '<div style="display:flex;flex-direction:column;align-items:center;padding:10px 16px 14px;">'
            + uploadIconSvg
            + '<div style="margin-top:8px;font-size:13px;font-weight:600;color:#b91c1c;">Please fix the following issues and re-upload:</div>'
            + '<ul style="margin:6px 0 0 0;padding-left:18px;font-size:13px;color:#b91c1c;line-height:1.7;text-align:left;">';
        errors.forEach(function(e) { html += '<li>' + e + '</li>'; });
        html += '</ul></div>';
        uploadBox.innerHTML = html;
    }

    function handleFileUpload(e) {
        var file = e.target.files[0];
        if (!file) return;
        var detected = detectIndustry();
        if (detected) { if (!isSimpleFlow) setSpotlightConfig(detected); var lbl = industryDisplayLabels[detected]; if (lbl) { selectedIndustryType = lbl; setIndustryTypeField(lbl); } }

        // Show loading state
        var uploadBox = document.getElementById('uploadBox');
        uploadBox.style.border = '1px solid #ACACACFF';
        uploadBox.style.cursor = 'default';
        uploadBox.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px 0;">'
            + '<div style="width:30px;height:30px;border:3px solid #e0e0e0;border-top:3px solid ' + themeColor + ';border-radius:50%;animation:mapperSpin 0.8s linear infinite;"></div>'
            + '<div style="margin-top:10px;font-size:13px;color:#666;font-weight:500;">Processing ' + file.name + '...</div>'
            + '</div>';
        // Inject spinner keyframes if not already present
        if (!document.getElementById('mapper-spinner-style')) {
            var spinStyle = document.createElement('style');
            spinStyle.id = 'mapper-spinner-style';
            spinStyle.textContent = '@keyframes mapperSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(spinStyle);
        }
        var n = document.getElementById('uploadNote'); if (n) n.style.display = 'none';
        var d = document.getElementById('download-container'); if (d) d.style.display = 'none';

        var reader = new FileReader();
        reader.onload = function(e) {
            // Use setTimeout to let the spinner render before heavy parsing
            setTimeout(function() {
            try {
                var data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, {type: 'array'});
                if (workbook.SheetNames.indexOf('Gift Data') === -1) { alert('Error: No Gift Data sheet found!'); return; }
                if (workbook.SheetNames.indexOf('Constituent Data') === -1) { alert('Error: No Constituent Data sheet found!'); return; }
                var giftJson = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data']);
                var ua = {};
                for (var i = 0; i < giftJson.length; i++) { if (giftJson[i]['Gift Appeal']) ua[giftJson[i]['Gift Appeal']] = true; }
                giftAppeals = Object.keys(ua).sort();
                var constJson = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], { defval: '' });

                var valErrors = validateWorkbook(workbook, giftJson, constJson);
                if (valErrors.length > 0) { showUploadValidationError(valErrors); return; }

                var uc = {};
                for (var j = 0; j < constJson.length; j++) { var ct = (constJson[j]['Constituent Type'] || '').toString().trim(); if (ct) uc[ct] = true; }
                var allConstituentTypeCount = Object.keys(uc).length;
                constituentTypes = Object.keys(uc).sort().filter(function(ct) { return constituentCategories.indexOf(ct) === -1; });
                constituentMappingSkipped = constituentTypes.length === 0;
                if (isStaffing) {
                    var uSol = {};
                    for (var s = 0; s < constJson.length; s++) { var solVal = (constJson[s]['Solicitor'] || '').toString().trim(); if (solVal) uSol[solVal] = true; }
                    solicitors = Object.keys(uSol).sort();
                    selectedSolicitors = {};
                    for (var si = 0; si < solicitors.length; si++) selectedSolicitors[solicitors[si]] = true;
                }
                if (isCampaignCounsel) {
                    var uPS = {};
                    for (var ps = 0; ps < giftJson.length; ps++) { var psVal = (giftJson[ps]['Status'] || '').toString().trim(); if (psVal) uPS[psVal] = true; }
                    var psLabels = pledgeStatusCategories.map(function(c) { return c.label; });
                    pledgeStatuses = Object.keys(uPS).sort().filter(function(s) { return psLabels.indexOf(s) === -1; });
                    pledgeStatusMappingSkipped = pledgeStatuses.length === 0;
                }
                if (isDevelopmentAssessment) {
                    appealCategories = [];
                    if (workbook.SheetNames.indexOf('Appeals Data') !== -1) {
                        var appealsJson = XLSX.utils.sheet_to_json(workbook.Sheets['Appeals Data'], { defval: '' });
                        var uac = {};
                        for (var ac = 0; ac < appealsJson.length; ac++) { var acVal = (appealsJson[ac]['Appeal Category'] || '').toString().trim(); if (acVal) uac[acVal] = true; }
                        appealCategories = Object.keys(uac).sort();
                    }
                }
                var ug = {};
                for (var g = 0; g < giftJson.length; g++) { if (giftJson[g]['Gift Type']) ug[giftJson[g]['Gift Type']] = true; }
                var allGiftTypeCount = Object.keys(ug).length;
                giftTypes = Object.keys(ug).sort().filter(function(gt) { return giftTypeCategories.indexOf(gt) === -1; });
                giftTypeMappingSkipped = giftTypes.length === 0;
                var hasBlankGiftType = !giftTypeMappingSkipped && giftJson.some(function(row) { return !row['Gift Type']; });
                if (hasBlankGiftType) giftTypes.push('__blank__');
                if (spotlightConfig) {
                    if (spotlightConfig.type === 'giftAppeal') spotlightSourceData = giftAppeals.slice();
                    else if (spotlightConfig.type === 'constituentType') spotlightSourceData = constituentTypes.slice();
                }
                if (!isSimpleFlow && giftAppeals.length === 0) {
                    specialEventSkipped = true;
                    spotlightSkipped = true;
                }
                initializeStepTracker(); updateStepTracker(0);
                if (constituentMappingSkipped && giftTypeMappingSkipped) {
                    ['solicitorDoneBtn','startConstituentFromPledgeBtn','startConstituentFromAppealBtn','startConstituentMappingBtn'].forEach(function(id) {
                        var el = document.getElementById(id); if (el) el.textContent = 'Submit ➡';
                    });
                } else if (constituentMappingSkipped) {
                    ['solicitorDoneBtn','startConstituentFromPledgeBtn','startConstituentFromAppealBtn','startConstituentMappingBtn'].forEach(function(id) {
                        var el = document.getElementById(id); if (el) el.textContent = 'Continue to Gift Type Mapping ➡';
                    });
                }
                if (giftTypeMappingSkipped) {
                    var gtBtn = document.getElementById('startGiftTypeMappingBtn'); if (gtBtn) gtBtn.textContent = 'Submit ➡';
                }
                // Update upload box to show file info like GHL style
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.innerHTML = uploadIconSvg
                    + '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 14px 10px;border-top:1px solid #eee;margin-top:8px;box-sizing:border-box;">'
                    + '<div style="text-align:left;font-size:13px;color:#333;">✓ ' + file.name + '</div>'
                    + '<div style="text-align:center;font-size:12px;color:#666;">' + (isStaffing ? solicitors.length + ' Solicitors &middot; ' : isSimpleFlow ? '' : giftAppeals.length + ' Appeals &middot; ') + allConstituentTypeCount + ' Constituent Types &middot; ' + allGiftTypeCount + ' Gift Types</div>'
                    + '</div>';
                document.getElementById('fileInfo').innerHTML = '';
                var mb = document.getElementById('mappingBox'); if (mb) mb.style.display = 'block';
                var ml = document.getElementById('mappingBoxLabel'); if (ml) ml.style.display = 'block';
                // Notify outer shell page to scroll mappingBox into view
                window.parent.postMessage({ type: 'mapperBoxReady' }, '*');
                if (isSimpleFlow) {
                    specialEventSkipped = true;
                    if (isStaffing && solicitors.length > 0) { startSolicitorSelection(); }
                    else if (isDevelopmentAssessment && appealCategories.length > 0) { startAppealCategoryMapping(); }
                    else if (isCampaignCounsel && pledgeStatuses.length > 0) { startPledgeStatusMapping(); }
                    else { startConstituentMapping(); }
                } else {
                    if (giftAppeals.length === 0) {
                        startConstituentMapping();
                    } else {
                        document.getElementById('categorySetup').style.display = 'block';
                    }
                }

            } catch (err) {
                // Reset upload box on error
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.style.cursor = 'pointer';
                uploadBox.innerHTML = uploadIconSvg;
                var dn = document.getElementById('uploadNote'); if (dn) dn.style.display = '';
                var dd = document.getElementById('download-container'); if (dd) dd.style.display = 'flex';
                alert('Error reading file: ' + err.message);
            }
            }, 50);
        };
        reader.readAsArrayBuffer(file);
    }

    function addCategory() {
        var input = document.getElementById('categoryInput');
        var name = input.value.trim();
        if (!name) { alert('Please enter an event name'); return; }
        if (categories.length >= 3) { alert('Maximum of 3 events allowed'); return; }
        if (categories.indexOf(name) > -1) { alert('This event already exists'); return; }
        categories.push(name); updateCategoriesList(); input.value = '';
        if (categories.length >= 3) { document.getElementById('addCategoryBtn').disabled = true; document.getElementById('categoryInput').disabled = true; document.getElementById('categoryInput').placeholder = 'Maximum of 3 events reached'; }
        else input.focus();
    }

    function updateCategoriesList() {
        var html = '';
        for (var i = 0; i < categories.length; i++) html += '<div class="category-tag">' + categories[i] + ' <button data-index="' + i + '">×</button></div>';
        document.getElementById('categoriesList').innerHTML = html;
    }

    function removeCategory(index) {
        categories.splice(index, 1); updateCategoriesList();
        if (categories.length < 3) { document.getElementById('addCategoryBtn').disabled = false; document.getElementById('categoryInput').disabled = false; document.getElementById('categoryInput').placeholder = 'Enter event name (e.g., Gala, Golf Tournament, Annual Auction)'; }
    }

    function startMapping() {
        if (categories.length === 0) { alert('Please add at least one event'); return; }
        if (!spotlightConfig) { var d = detectIndustry(); if (d) { setSpotlightConfig(d); if (spotlightConfig) { if (spotlightConfig.type === 'giftAppeal') spotlightSourceData = giftAppeals.slice(); else if (spotlightConfig.type === 'constituentType') spotlightSourceData = constituentTypes.slice(); } } }
        updateStepTracker(getStepIndex('Special Event Mapping')); currentIndex = 0; hasUsedPrevious = false;
        if (spotlightConfig) { document.getElementById('completionNextStep').textContent = 'Click below to continue to spotlight mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Spotlight Mapping ➝'; document.getElementById('completionNextButton').onclick = startSpotlightMapping; }
        else if (constituentMappingSkipped && giftTypeMappingSkipped) { document.getElementById('completionNextStep').textContent = 'Click below to submit.'; document.getElementById('completionNextButton').textContent = 'Submit ➝'; document.getElementById('completionNextButton').onclick = startGiftTypeMapping; }
        else if (constituentMappingSkipped) { document.getElementById('completionNextStep').textContent = 'Click below to continue to Gift Type mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Gift Type Mapping ➝'; document.getElementById('completionNextButton').onclick = startGiftTypeMapping; }
        else if (giftTypeMappingSkipped) { document.getElementById('completionNextStep').textContent = 'Click below to continue to Constituent Type mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Constituent Mapping ➝'; document.getElementById('completionNextButton').onclick = startConstituentMapping; }
        else { document.getElementById('completionNextStep').textContent = 'Click below to continue to Constituent Type mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Constituent Mapping ➝'; document.getElementById('completionNextButton').onclick = startConstituentMapping; }
        document.getElementById('mappingSection').style.display = 'block'; showCurrentAppeal(); updateProgress();
        document.getElementById('categorySetup').style.display = 'none';
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentAppeal() {
        var container = document.getElementById('mappingContainer');
        if (currentIndex >= giftAppeals.length) { container.innerHTML = ''; document.getElementById('completionCard').style.display = 'block'; document.getElementById('spotlightMappingSection').style.display = 'none'; document.getElementById('constituentMappingSection').style.display = 'none'; document.querySelector('#mappingSection .progress-container').style.display = 'none'; document.querySelector('#mappingSection h2').style.display = 'none'; return; }
        var appeal = giftAppeals[currentIndex]; var cm = mappings[appeal] || null;
        var html = '<div class="mapping-card"><div class="appeal-label">Gift Appeal ' + (currentIndex+1) + ' of ' + giftAppeals.length + '</div><div class="appeal-name">' + appeal + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select an event:</div><div class="category-buttons">';
        for (var i = 0; i < categories.length; i++) html += '<button class="category-btn" data-appeal="' + appeal + '" data-category="' + categories[i] + '" data-mapping-type="event">' + categories[i] + '</button>';
        html += '<button class="category-btn non-event-btn" data-appeal="' + appeal + '" data-category="Skip" data-mapping-type="event">Skip</button></div>';
        html += '<div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="event"' + (currentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="nextBtn" data-action="next" data-mapping-type="event"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { if (cm === 'Skip') { btns[j].style.background = '#999'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#999'; } else { btns[j].style.background = themeColor; btns[j].style.color = 'white'; btns[j].style.borderColor = themeColor; } } } }
        var nb = container.querySelector('#nextBtn'); if (nb && hasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectCategory(appeal, category) {
        var prevValue = mappings[appeal] || null;
        mappings[appeal] = category; updateProgress();
        var btns = document.querySelectorAll('#mappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { var bc = btns[i].getAttribute('data-category'); if (bc === category) { if (category === 'Skip') { btns[i].style.background = '#999'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = themeColor; btns[i].style.color = 'white'; btns[i].style.borderColor = themeColor; } } else { if (btns[i].classList.contains('non-event-btn')) { btns[i].style.background = 'white'; btns[i].style.color = '#666'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = 'white'; btns[i].style.color = themeColor; btns[i].style.borderColor = themeColor; } } }
        var nb = document.querySelector('#nextBtn'); if (nb && hasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!hasUsedPrevious || (hasUsedPrevious && prevValue !== null && prevValue !== category)) nextAppeal(); }, 500);
    }

    function nextAppeal() { if (currentIndex < giftAppeals.length) { currentIndex++; hasUsedPrevious = false; showCurrentAppeal(); updateProgress(); } }
    function previousAppeal() { if (currentIndex > 0) { currentIndex--; hasUsedPrevious = true; showCurrentAppeal(); updateProgress(); } }

    function updateProgress() {
        var mapped = Object.keys(mappings).length; var total = giftAppeals.length;
        var pct = total > 0 ? Math.round((mapped/total)*100) : 0;
        document.getElementById('progressBar').style.width = pct + '%';
        document.getElementById('progressBarText').textContent = pct === 0 ? '' : pct + '%';
        document.getElementById('progressText').textContent = mapped + ' of ' + total + ' appeals mapped';
    }

    function startSpotlightMapping() {
        updateStepTracker(getStepIndex('Spotlight Mapping')); spotlightCurrentIndex = 0; spotlightHasUsedPrevious = false;
        document.getElementById('spotlightMappingTitle').textContent = spotlightConfig.title;
        document.getElementById('spotlightCompletionText').textContent = spotlightConfig.completionText;
        document.getElementById('spotlightMappingSection').style.display = 'block'; showCurrentSpotlight(); updateSpotlightProgress();
        var ssw = document.getElementById('spotlightSkipWrapper'); if (ssw) ssw.style.display = 'block';
        document.getElementById('mappingSection').style.display = 'none';
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentSpotlight() {
        var container = document.getElementById('spotlightMappingContainer');
        if (spotlightCurrentIndex >= spotlightSourceData.length) { container.innerHTML = ''; document.getElementById('spotlightCompletionCard').style.display = 'block'; document.querySelector('#spotlightMappingSection .progress-container').style.display = 'none'; document.querySelector('#spotlightMappingSection h2').style.display = 'none'; return; }
        var sv = spotlightSourceData[spotlightCurrentIndex]; var cm = spotlightMappings[sv] || null;
        var lt = spotlightConfig.type === 'giftAppeal' ? 'Gift Appeal' : 'Constituent Type';
        var html = '<div class="mapping-card"><div class="appeal-label">' + lt + ' ' + (spotlightCurrentIndex+1) + ' of ' + spotlightSourceData.length + '</div><div class="appeal-name">' + sv + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select a spotlight category:</div><div class="category-buttons">';
        for (var i = 0; i < spotlightConfig.categories.length; i++) { if (spotlightConfig.categories[i] !== 'Skip') html += '<button class="category-btn" data-appeal="' + sv + '" data-category="' + spotlightConfig.categories[i] + '" data-mapping-type="spotlight">' + spotlightConfig.categories[i] + '</button>'; }
        html += '<button class="category-btn non-event-btn" data-appeal="' + sv + '" data-category="Skip" data-mapping-type="spotlight">Skip</button></div>';
        html += '<div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="spotlight"' + (spotlightCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="spotlightNextBtn" data-action="next" data-mapping-type="spotlight"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { if (cm === 'Skip') { btns[j].style.background = '#999'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#999'; } else { btns[j].style.background = themeColor; btns[j].style.color = 'white'; btns[j].style.borderColor = themeColor; } } } }
        var nb = container.querySelector('#spotlightNextBtn'); if (nb && spotlightHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectSpotlight(sv, category) {
        var prevValue = spotlightMappings[sv] || null;
        spotlightMappings[sv] = category; updateSpotlightProgress();
        var btns = document.querySelectorAll('#spotlightMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { var bc = btns[i].getAttribute('data-category'); if (bc === category) { if (category === 'Skip') { btns[i].style.background = '#999'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = themeColor; btns[i].style.color = 'white'; btns[i].style.borderColor = themeColor; } } else { if (btns[i].classList.contains('non-event-btn')) { btns[i].style.background = 'white'; btns[i].style.color = '#666'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = 'white'; btns[i].style.color = themeColor; btns[i].style.borderColor = themeColor; } } }
        var nb = document.querySelector('#spotlightNextBtn'); if (nb && spotlightHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!spotlightHasUsedPrevious || (spotlightHasUsedPrevious && prevValue !== null && prevValue !== category)) nextSpotlight(); }, 500);
    }

    function nextSpotlight() { if (spotlightCurrentIndex < spotlightSourceData.length) { spotlightCurrentIndex++; spotlightHasUsedPrevious = false; showCurrentSpotlight(); updateSpotlightProgress(); } }
    function previousSpotlight() { if (spotlightCurrentIndex > 0) { spotlightCurrentIndex--; spotlightHasUsedPrevious = true; showCurrentSpotlight(); updateSpotlightProgress(); } }

    function updateSpotlightProgress() {
        var mapped = Object.keys(spotlightMappings).length; var total = spotlightSourceData.length;
        var pct = total > 0 ? Math.round((mapped/total)*100) : 0;
        document.getElementById('spotlightProgressBar').style.width = pct + '%';
        document.getElementById('spotlightProgressBarText').textContent = pct === 0 ? '' : pct + '%';
        document.getElementById('spotlightProgressText').textContent = mapped + ' of ' + total + ' mapped';
    }

    function startPledgeStatusMapping() {
        if (pledgeStatusMappingSkipped) { startConstituentMapping(); return; }
        updateStepTracker(getStepIndex('Pledge Status Mapping')); pledgeStatusCurrentIndex = 0; pledgeStatusHasUsedPrevious = false;
        document.getElementById('pledgeStatusMappingSection').style.display = 'block';
        showCurrentPledgeStatus(); updatePledgeStatusProgress();
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentPledgeStatus() {
        var container = document.getElementById('pledgeStatusMappingContainer');
        if (pledgeStatusCurrentIndex >= pledgeStatuses.length) {
            container.innerHTML = '';
            // If nothing else to map, go straight to submit state instead of showing an intermediate button
            if (constituentMappingSkipped && giftTypeMappingSkipped) { startGiftTypeMapping(); return; }
            var nextLabel = constituentMappingSkipped ? 'Gift Type Mapping' : 'Constituent Type Mapping';
            var psCard = document.getElementById('pledgeStatusCompletionCard');
            var psBtnEl = document.getElementById('startConstituentFromPledgeBtn');
            if (psCard) { var psParts = psCard.querySelectorAll('p'); if (psParts.length >= 2) psParts[1].textContent = 'Click below to continue to ' + nextLabel + '.'; }
            if (psBtnEl) psBtnEl.textContent = 'Continue to ' + nextLabel + ' ➡';
            psCard.style.display = 'block';
            document.querySelector('#pledgeStatusMappingSection .progress-container').style.display = 'none';
            document.querySelector('#pledgeStatusMappingSection h2').style.display = 'none';
            return;
        }
        var status = pledgeStatuses[pledgeStatusCurrentIndex]; var cm = pledgeStatusMappings[status] || null;
        if (!document.getElementById('pledgeInfoPopup')) {
            var popupDiv = document.createElement('div');
            popupDiv.id = 'pledgeInfoPopup';
            for (var p = 0; p < pledgeStatusCategories.length; p++) { popupDiv.innerHTML += '<div class="info-popup-item"><span class="info-popup-label">' + pledgeStatusCategories[p].label + '</span> — ' + pledgeStatusCategories[p].desc + '</div>'; }
            document.body.appendChild(popupDiv);
        }
        var popupHtml = '<span class="info-icon-wrap" onmouseenter="var el=document.getElementById(\'pledgeInfoPopup\');el.style.display=\'block\';var r=this.getBoundingClientRect();var t=r.top-el.offsetHeight-10;el.style.top=Math.max(10,t)+\'px\';" onmouseleave="document.getElementById(\'pledgeInfoPopup\').style.display=\'none\';">ⓘ</span>';
        var html = '<div class="mapping-card"><div class="appeal-label">Pledge Status ' + (pledgeStatusCurrentIndex+1) + ' of ' + pledgeStatuses.length + '</div><div class="appeal-name">' + status + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select a pledge status category:' + popupHtml + '</div><div class="category-buttons allow-wrap" style="justify-content:center;">';
        for (var i = 0; i < pledgeStatusCategories.length; i++) {
            html += '<button class="category-btn" data-appeal="' + status + '" data-category="' + pledgeStatusCategories[i].label + '" data-mapping-type="pledgestatus">' + pledgeStatusCategories[i].label + '</button>';
        }
        html += '</div><div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="pledgestatus"' + (pledgeStatusCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="pledgeStatusNextBtn" data-action="next" data-mapping-type="pledgestatus"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { btns[j].style.background = themeColor; btns[j].style.color = 'white'; btns[j].style.borderColor = themeColor; } } }
        var nb = container.querySelector('#pledgeStatusNextBtn'); if (nb && pledgeStatusHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectPledgeStatus(status, category) {
        var prevValue = pledgeStatusMappings[status] || null;
        pledgeStatusMappings[status] = category; updatePledgeStatusProgress();
        var btns = document.querySelectorAll('#pledgeStatusMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { if (btns[i].getAttribute('data-category') === category) { btns[i].style.background = themeColor; btns[i].style.color = 'white'; btns[i].style.borderColor = themeColor; } else { btns[i].style.background = 'white'; btns[i].style.color = themeColor; btns[i].style.borderColor = themeColor; } }
        var nb = document.querySelector('#pledgeStatusNextBtn'); if (nb && pledgeStatusHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!pledgeStatusHasUsedPrevious || (pledgeStatusHasUsedPrevious && prevValue !== null && prevValue !== category)) nextPledgeStatus(); }, 500);
    }

    function nextPledgeStatus() { if (pledgeStatusCurrentIndex < pledgeStatuses.length) { pledgeStatusCurrentIndex++; pledgeStatusHasUsedPrevious = false; showCurrentPledgeStatus(); updatePledgeStatusProgress(); } }
    function previousPledgeStatus() { if (pledgeStatusCurrentIndex > 0) { pledgeStatusCurrentIndex--; pledgeStatusHasUsedPrevious = true; showCurrentPledgeStatus(); updatePledgeStatusProgress(); } }

    function updatePledgeStatusProgress() {
        var mapped = Object.keys(pledgeStatusMappings).length; var total = pledgeStatuses.length;
        var pct = total > 0 ? Math.round((mapped/total)*100) : 0;
        document.getElementById('pledgeStatusProgressBar').style.width = pct + '%';
        document.getElementById('pledgeStatusProgressBarText').textContent = pct === 0 ? '' : pct + '%';
        document.getElementById('pledgeStatusProgressText').textContent = mapped + ' of ' + total + ' Pledge Statuses Mapped';
    }

    function startAppealCategoryMapping() {
        updateStepTracker(getStepIndex('Appeals Category Mapping')); appealCategoryCurrentIndex = 0; appealCategoryHasUsedPrevious = false;
        document.getElementById('appealCategoryMappingSection').style.display = 'block';
        showCurrentAppealCategory(); updateAppealCategoryProgress();
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentAppealCategory() {
        var container = document.getElementById('appealCategoryMappingContainer');
        if (appealCategoryCurrentIndex >= giftAppeals.length) {
            container.innerHTML = '';
            if (constituentMappingSkipped && giftTypeMappingSkipped) { startGiftTypeMapping(); return; }
            var nextLabel = constituentMappingSkipped ? 'Gift Type Mapping' : 'Constituent Type Mapping';
            var acCard = document.getElementById('appealCategoryCompletionCard');
            var acBtnEl = document.getElementById('startConstituentFromAppealBtn');
            if (acCard) { var acParts = acCard.querySelectorAll('p'); if (acParts.length >= 2) acParts[1].textContent = 'Click below to continue to ' + nextLabel + '.'; }
            if (acBtnEl) acBtnEl.textContent = 'Continue to ' + nextLabel + ' ➡';
            acCard.style.display = 'block';
            document.querySelector('#appealCategoryMappingSection .progress-container').style.display = 'none';
            document.querySelector('#appealCategoryMappingSection h2').style.display = 'none';
            return;
        }
        var appeal = giftAppeals[appealCategoryCurrentIndex]; var cm = appealCategoryMappings[appeal] || null;
        var html = '<div class="mapping-card"><div class="appeal-label">Gift Appeal ' + (appealCategoryCurrentIndex+1) + ' of ' + giftAppeals.length + '</div><div class="appeal-name">' + appeal + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select an appeal category:</div><div class="category-buttons allow-wrap">';
        for (var i = 0; i < appealCategories.length; i++) html += '<button class="category-btn" data-appeal="' + appeal + '" data-category="' + appealCategories[i] + '" data-mapping-type="appealcategory">' + appealCategories[i] + '</button>';
        html += '<button class="category-btn non-event-btn" data-appeal="' + appeal + '" data-category="Skip" data-mapping-type="appealcategory">Skip</button></div>';
        html += '<div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="appealcategory"' + (appealCategoryCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="appealCategoryNextBtn" data-action="next" data-mapping-type="appealcategory"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { if (cm === 'Skip') { btns[j].style.background = '#999'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#999'; } else { btns[j].style.background = themeColor; btns[j].style.color = 'white'; btns[j].style.borderColor = themeColor; } } } }
        var nb = container.querySelector('#appealCategoryNextBtn'); if (nb && appealCategoryHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectAppealCategory(appeal, category) {
        var prevValue = appealCategoryMappings[appeal] || null;
        appealCategoryMappings[appeal] = category; updateAppealCategoryProgress();
        var btns = document.querySelectorAll('#appealCategoryMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { var bc = btns[i].getAttribute('data-category'); if (bc === category) { if (category === 'Skip') { btns[i].style.background = '#999'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = themeColor; btns[i].style.color = 'white'; btns[i].style.borderColor = themeColor; } } else { if (btns[i].classList.contains('non-event-btn')) { btns[i].style.background = 'white'; btns[i].style.color = '#666'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = 'white'; btns[i].style.color = themeColor; btns[i].style.borderColor = themeColor; } } }
        var nb = document.querySelector('#appealCategoryNextBtn'); if (nb && appealCategoryHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!appealCategoryHasUsedPrevious || (appealCategoryHasUsedPrevious && prevValue !== null && prevValue !== category)) nextAppealCategory(); }, 500);
    }

    function nextAppealCategory() { if (appealCategoryCurrentIndex < giftAppeals.length) { appealCategoryCurrentIndex++; appealCategoryHasUsedPrevious = false; showCurrentAppealCategory(); updateAppealCategoryProgress(); } }
    function previousAppealCategory() { if (appealCategoryCurrentIndex > 0) { appealCategoryCurrentIndex--; appealCategoryHasUsedPrevious = true; showCurrentAppealCategory(); updateAppealCategoryProgress(); } }

    function updateAppealCategoryProgress() {
        var mapped = Object.keys(appealCategoryMappings).length; var total = giftAppeals.length;
        var pct = total > 0 ? Math.round((mapped/total)*100) : 0;
        document.getElementById('appealCategoryProgressBar').style.width = pct + '%';
        document.getElementById('appealCategoryProgressBarText').textContent = pct === 0 ? '' : pct + '%';
        document.getElementById('appealCategoryProgressText').textContent = mapped + ' of ' + total + ' Appeals Mapped';
    }

    function startConstituentMapping() {
        if (constituentMappingSkipped) { startGiftTypeMapping(); return; }
        updateStepTracker(getStepIndex('Constituent Type Mapping')); constituentCurrentIndex = 0; constituentHasUsedPrevious = false;
        document.getElementById('constituentMappingSection').style.display = 'block'; showCurrentConstituentType(); updateConstituentProgress();
        ['mappingSection','spotlightMappingSection','pledgeStatusMappingSection','appealCategoryMappingSection','solicitorSelectionSection'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentConstituentType() {
        var container = document.getElementById('constituentMappingContainer');
        if (constituentCurrentIndex >= constituentTypes.length) { container.innerHTML = ''; if (giftTypeMappingSkipped) { startGiftTypeMapping(); return; } updateStepTracker(getStepIndex('Gift Type Mapping')); document.getElementById('constituentCompletionCard').style.display = 'block'; document.querySelector('#constituentMappingSection .progress-container').style.display = 'none'; document.querySelector('#constituentMappingSection h2').style.display = 'none'; return; }
        var ct = constituentTypes[constituentCurrentIndex]; var cm = constituentMappings[ct] || null;
        var html = '<div class="mapping-card"><div class="appeal-label">Constituent Type ' + (constituentCurrentIndex+1) + ' of ' + constituentTypes.length + '</div><div class="appeal-name">' + ct + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select a constituent type:</div><div class="category-buttons allow-wrap">';
        for (var i = 0; i < constituentCategories.length; i++) html += '<button class="category-btn" data-appeal="' + ct + '" data-category="' + constituentCategories[i] + '" data-mapping-type="constituent">' + constituentCategories[i] + '</button>';
        html += '</div><div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="constituent"' + (constituentCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="constituentNextBtn" data-action="next" data-mapping-type="constituent"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { btns[j].style.background = themeColor; btns[j].style.color = 'white'; btns[j].style.borderColor = themeColor; } } }
        var nb = container.querySelector('#constituentNextBtn'); if (nb && constituentHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectConstituentType(origType, mappedType) {
        var prevValue = constituentMappings[origType] || null;
        constituentMappings[origType] = mappedType; updateConstituentProgress();
        var btns = document.querySelectorAll('#constituentMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { if (btns[i].getAttribute('data-category') === mappedType) { btns[i].style.background = themeColor; btns[i].style.color = 'white'; btns[i].style.borderColor = themeColor; } else { btns[i].style.background = 'white'; btns[i].style.color = themeColor; btns[i].style.borderColor = themeColor; } }
        var nb = document.querySelector('#constituentNextBtn'); if (nb && constituentHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!constituentHasUsedPrevious || (constituentHasUsedPrevious && prevValue !== null && prevValue !== mappedType)) nextConstituentType(); }, 500);
    }

    function nextConstituentType() { if (constituentCurrentIndex < constituentTypes.length) { constituentCurrentIndex++; constituentHasUsedPrevious = false; showCurrentConstituentType(); updateConstituentProgress(); } }
    function previousConstituentType() { if (constituentCurrentIndex > 0) { constituentCurrentIndex--; constituentHasUsedPrevious = true; showCurrentConstituentType(); updateConstituentProgress(); } }

    function updateConstituentProgress() {
        var mapped = Object.keys(constituentMappings).length; var total = constituentTypes.length;
        var pct = total > 0 ? Math.round((mapped/total)*100) : 0;
        document.getElementById('constituentProgressBar').style.width = pct + '%';
        document.getElementById('constituentProgressBarText').textContent = pct === 0 ? '' : pct + '%';
        document.getElementById('constituentProgressText').textContent = mapped + ' of ' + total + ' constituent types mapped';
    }


    function showAllDoneCard() {
        ['mappingSection','spotlightMappingSection','pledgeStatusMappingSection','appealCategoryMappingSection','solicitorSelectionSection','constituentMappingSection'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
        var gts = document.getElementById('giftTypeMappingSection'); if (gts) gts.style.display = 'block';
        var h2 = gts ? gts.querySelector('h2') : null; if (h2) h2.style.display = 'none';
        var pc = gts ? gts.querySelector('.progress-container') : null; if (pc) pc.style.display = 'none';
        var gtc = document.getElementById('giftTypeCompletionCard'); if (gtc) gtc.style.display = 'none';
        var gtContainer = document.getElementById('giftTypeMappingContainer'); if (gtContainer) gtContainer.innerHTML = '';
        var adc = document.getElementById('allDoneCard'); if (adc) adc.style.display = 'block';
        var csBtn = document.getElementById('customSubmitBtn'); if (csBtn && csBtn.parentElement) csBtn.parentElement.style.display = '';
        updateStepTracker(99);
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function startGiftTypeMapping() {
        if (giftTypeMappingSkipped) {
            showAllDoneCard(); return;
        }
        updateStepTracker(getStepIndex('Gift Type Mapping')); giftTypeCurrentIndex = 0; giftTypeHasUsedPrevious = false;
        document.getElementById('giftTypeMappingSection').style.display = 'block'; showCurrentGiftType(); updateGiftTypeProgress();
        ['mappingSection','spotlightMappingSection','pledgeStatusMappingSection','appealCategoryMappingSection','solicitorSelectionSection','constituentMappingSection'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentGiftType() {
        var container = document.getElementById('giftTypeMappingContainer');
        if (giftTypeCurrentIndex >= giftTypes.length) {
            showAllDoneCard(); return;
        }
        var gt = giftTypes[giftTypeCurrentIndex]; var cm = giftTypeMappings[gt] || null;
        var gtLabel = gt === '__blank__' ? 'Gift Type Not Specified' : gt;
        var html = '<div class="mapping-card"><div class="appeal-label">Gift Type ' + (giftTypeCurrentIndex+1) + ' of ' + giftTypes.length + '</div><div class="appeal-name">' + gtLabel + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select a gift type:</div><div class="category-buttons">';
        for (var i = 0; i < giftTypeCategories.length; i++) html += '<button class="category-btn" data-appeal="' + gt + '" data-category="' + giftTypeCategories[i] + '" data-mapping-type="gifttype">' + giftTypeCategories[i] + '</button>';
        html += '<button class="category-btn non-event-btn" data-appeal="' + gt + '" data-category="Skip" data-mapping-type="gifttype">Skip</button></div>';
        html += '<div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="gifttype"' + (giftTypeCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="giftTypeNextBtn" data-action="next" data-mapping-type="gifttype"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { if (cm === 'Skip') { btns[j].style.background = '#999'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#999'; } else { btns[j].style.background = themeColor; btns[j].style.color = 'white'; btns[j].style.borderColor = themeColor; } } } }
        var nb = container.querySelector('#giftTypeNextBtn'); if (nb && giftTypeHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectGiftType(origType, mappedType) {
        var prevValue = giftTypeMappings[origType] || null;
        giftTypeMappings[origType] = mappedType; updateGiftTypeProgress();
        var btns = document.querySelectorAll('#giftTypeMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { var bc = btns[i].getAttribute('data-category'); if (bc === mappedType) { if (mappedType === 'Skip') { btns[i].style.background = '#999'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = themeColor; btns[i].style.color = 'white'; btns[i].style.borderColor = themeColor; } } else { if (btns[i].classList.contains('non-event-btn')) { btns[i].style.background = 'white'; btns[i].style.color = '#666'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = 'white'; btns[i].style.color = themeColor; btns[i].style.borderColor = themeColor; } } }
        var nb = document.querySelector('#giftTypeNextBtn'); if (nb && giftTypeHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!giftTypeHasUsedPrevious || (giftTypeHasUsedPrevious && prevValue !== null && prevValue !== mappedType)) nextGiftType(); }, 500);
    }

    function nextGiftType() { if (giftTypeCurrentIndex < giftTypes.length) { giftTypeCurrentIndex++; giftTypeHasUsedPrevious = false; showCurrentGiftType(); updateGiftTypeProgress(); } }
    function previousGiftType() { if (giftTypeCurrentIndex > 0) { giftTypeCurrentIndex--; giftTypeHasUsedPrevious = true; showCurrentGiftType(); updateGiftTypeProgress(); } }

    function updateGiftTypeProgress() {
        var mapped = Object.keys(giftTypeMappings).length; var total = giftTypes.length;
        var pct = total > 0 ? Math.round((mapped/total)*100) : 0;
        document.getElementById('giftTypeProgressBar').style.width = pct + '%';
        document.getElementById('giftTypeProgressBarText').textContent = pct === 0 ? '' : pct + '%';
        document.getElementById('giftTypeProgressText').textContent = mapped + ' of ' + total + ' gift types mapped';
    }

    function generateExcelBlob() {
        var eventOk = specialEventSkipped || Object.keys(mappings).length > 0;
        var spotlightOk = !spotlightConfig || spotlightSkipped || Object.keys(spotlightMappings).length > 0;
        var constituentOk = constituentMappingSkipped || Object.keys(constituentMappings).length > 0;
        var giftTypeOk = giftTypeMappingSkipped || Object.keys(giftTypeMappings).length > 0;
        var solicitorOk = !isStaffing || solicitors.length === 0 || solicitorSelectionDone;
        var appealCategoryOk = !isDevelopmentAssessment || appealCategories.length === 0 || Object.keys(appealCategoryMappings).length > 0;
        var pledgeStatusOk = !isCampaignCounsel || pledgeStatuses.length === 0 || pledgeStatusMappingSkipped || Object.keys(pledgeStatusMappings).length >= pledgeStatuses.length;
        console.log('generateExcelBlob check:', {specialEventSkipped: specialEventSkipped, eventOk: eventOk, spotlightOk: spotlightOk, constituentOk: constituentOk, giftTypeOk: giftTypeOk, solicitorOk: solicitorOk, appealCategoryOk: appealCategoryOk});
        if (!eventOk || !spotlightOk || !constituentOk || !giftTypeOk || !solicitorOk || !appealCategoryOk || !pledgeStatusOk) return null;

        var gd = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data'], { defval: '' });
        if (isDevelopmentAssessment) {
            // Replace Gift Appeal values in place with mapped Appeal Category (or blank if Skip)
            for (var i = 0; i < gd.length; i++) {
                if (appealCategories.length > 0 && Object.keys(appealCategoryMappings).length > 0) {
                    var mappedAC = appealCategoryMappings[gd[i]['Gift Appeal']];
                    if (mappedAC === 'Skip') gd[i]['Gift Appeal'] = '';
                    else if (mappedAC !== undefined) gd[i]['Gift Appeal'] = mappedAC;
                }
            }
        } else {
            if (!isSimpleFlow) {
                for (var i = 0; i < gd.length; i++) { var raw = specialEventSkipped ? undefined : mappings[gd[i]['Gift Appeal']]; var ev = raw === 'Skip' ? '' : (raw !== undefined ? raw : ''); gd[i]['Event'] = ev; delete gd[i]['Gift Appeal']; }
            }
            if (isCampaignCounsel && Object.keys(pledgeStatusMappings).length > 0) {
                for (var sc = 0; sc < gd.length; sc++) { var origStat = (gd[sc]['Status'] || '').toString().trim(); var mappedStat = pledgeStatusMappings[origStat]; if (mappedStat !== undefined) gd[sc]['Status'] = mappedStat; }
            }
        }

        if (!isSimpleFlow && spotlightConfig && !spotlightSkipped && Object.keys(spotlightMappings).length > 0) {
            if (spotlightConfig.type === 'giftAppeal') {
                // Always look up spotlight by original Gift Appeal name (row index -> appeal name)
                var origGd = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data'], { defval: '' });
                for (var j = 0; j < gd.length; j++) {
                    var ap = origGd[j] ? origGd[j]['Gift Appeal'] : null;
                    var raw = spotlightMappings[ap]; var sl = raw === 'Skip' ? '' : (raw !== undefined ? raw : ''); gd[j]['Spotlights'] = sl;
                }
            } else if (spotlightConfig.type === 'constituentType') {
                var cd = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], { defval: '' });
                var csm = {}; for (var m = 0; m < cd.length; m++) { var raw = spotlightMappings[cd[m]['Constituent Type']]; csm[cd[m]['Constituent ID']] = raw === 'Skip' ? '' : (raw !== undefined ? raw : ''); }
                for (var n = 0; n < gd.length; n++) { var sv = csm[gd[n]['Constituent ID']]; gd[n]['Spotlights'] = sv !== undefined ? sv : ''; }
            }
        } else if (!isSimpleFlow) {
            for (var r = 0; r < gd.length; r++) gd[r]['Spotlights'] = '';
        }

        // Apply gift type mappings - replace Gift Type values in Gift Data
        for (var gt = 0; gt < gd.length; gt++) { var ogt = (gd[gt]['Gift Type'] || '').toString().trim(); var mgt = ogt === '' ? giftTypeMappings['__blank__'] : giftTypeMappings[ogt]; gd[gt]['Gift Type'] = (mgt === 'Skip' || mgt === undefined) ? (ogt || '') : mgt; }

        var sheetCD = workbook.Sheets['Constituent Data'];
        console.log('Constituent sheet !ref:', sheetCD['!ref']);
        var cd2 = XLSX.utils.sheet_to_json(sheetCD, { defval: '' });
        console.log('Constituent rows read:', cd2.length);
        console.log('Constituent mappings defined:', Object.keys(constituentMappings));
        var unmatchedTypes = {};
        for (var p = 0; p < cd2.length; p++) {
            var ot = (cd2[p]['Constituent Type'] || '').toString().trim();
            var mapped = constituentMappings[ot];
            if (mapped) {
                cd2[p]['Constituent Type'] = mapped;
            } else if (ot === '') {
                cd2[p]['Constituent Type'] = 'Individual';
            } else if (constituentCategories.indexOf(ot) === -1) {
                unmatchedTypes[ot] = true;
            }
            if (isStaffing && cd2[p].hasOwnProperty('Solicitor')) {
                var solVal = (cd2[p]['Solicitor'] || '').toString().trim();
                if (solVal && selectedSolicitors[solVal] === false) cd2[p]['Solicitor'] = '';
            }
        }
        if (Object.keys(unmatchedTypes).length > 0) console.warn('Unmatched constituent types:', Object.keys(unmatchedTypes));

        // Preserve original column order
        var origGiftHeaders = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data'], {header: 1})[0] || [];
        var origConstHeaders = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], {header: 1})[0] || [];

                // Auto-add constituent records for any Constituent IDs in Gift Data missing from Constituent Data.
        // IDs are normalized (leading zeros stripped when purely numeric) before comparing, since Excel
        // frequently stores the same ID as a number in one sheet and a zero-padded string in the other
        // (e.g. 53036 vs "053036") — without this, an existing constituent with a real name/address gets
        // a second, blank placeholder row appended for them because the raw string comparison misses.
        var normId = function(v) {
            var s = (v == null ? '' : v).toString().trim();
            return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s;
        };
        var cdIdSet = {};
        for (var ci = 0; ci < cd2.length; ci++) cdIdSet[normId(cd2[ci]['Constituent ID'])] = true;
        var missingCids = {};
        for (var mi = 0; mi < gd.length; mi++) {
            var mcidRaw = (gd[mi]['Constituent ID'] || '').toString().trim();
            var mcidKey = normId(mcidRaw);
            if (mcidKey && !cdIdSet[mcidKey]) {
                if (!missingCids[mcidKey]) missingCids[mcidKey] = { display: mcidRaw, dates: [] };
                var gdate = gd[mi]['Gift Date'];
                if (gdate !== undefined && gdate !== '') missingCids[mcidKey].dates.push(gdate);
            }
        }
        Object.keys(missingCids).forEach(function(key) {
            var entry = missingCids[key];
            var dates = entry.dates;
            var oldest = dates.length > 0 ? dates.reduce(function(a, b) {
                var ta = typeof a === 'number' ? (a - 25569) * 86400000 : new Date(a).getTime();
                var tb = typeof b === 'number' ? (b - 25569) * 86400000 : new Date(b).getTime();
                return ta <= tb ? a : b;
            }) : '';
            var newRow = {};
            for (var h = 0; h < origConstHeaders.length; h++) newRow[origConstHeaders[h]] = '';
            newRow['Constituent ID'] = entry.display;
            newRow['Constituent Type'] = 'Individual';
            newRow['First Gift Date'] = oldest;
            cd2.push(newRow);
        });

        // UPSTREAM_COMPUTE: derive analytics columns in the mapper (Standard Variant only)
        var _ucGiftSheet = null, _ucConstSheet = null, _ucProspectSheets = null;
        if (UPSTREAM_COMPUTE && !isSimpleFlow) {
            try {
                var _ucGiftRows = gd.map(function(r) {
                    return [r['Constituent ID'], r['Gift Date'], r['Gift Amount'], r['Gift Type'], r['Event'] || '', r['Spotlights'] || ''];
                });
                var _ucGiftIds = {};
                for (var _uci = 0; _uci < _ucGiftRows.length; _uci++) { var _ucGid = String(_ucGiftRows[_uci][0] || '').trim(); if (_ucGid) _ucGiftIds[_ucGid] = true; }
                var _ucConsRows = cd2.filter(function(r) { return _ucGiftIds[String(r['Constituent ID'] || '').trim()]; }).map(function(r) {
                    return [r['Constituent ID'], r['Constituent Name'] || r['Name'] || '', r['Constituent Type'] || '', r['First Gift Date'] || '', r['Board Member?'] || r['Board Member'] || '', r['Street Address'] || r['Street'] || '', r['City'] || '', r['State'] || '', r['Zip Code'] || r['Zip'] || ''];
                });
                // Read FY Start Month — mapper's own select takes priority, fall back to GHL multiselect
                var _ucFyMonth = null;
                var _ucMapperFySel = document.getElementById('mapper-fy-start-month');
                if (_ucMapperFySel && _ucMapperFySel.value) {
                    _ucFyMonth = _ucMapperFySel.value;
                } else {
                    var _ucFyEl = document.querySelector('[name="EU5w6k8DZPkWhY1mYiGh"]');
                    if (_ucFyEl) {
                        if (_ucFyEl.classList && _ucFyEl.classList.contains('multiselect__input')) {
                            var _ucFyCont = _ucFyEl.closest('.multiselect') || _ucFyEl.parentElement;
                            var _ucFySpan = _ucFyCont ? _ucFyCont.querySelector('.multiselect__single') : null;
                            if (_ucFySpan && _ucFySpan.textContent.trim()) _ucFyMonth = _ucFySpan.textContent.trim();
                        } else if (_ucFyEl.tagName === 'INPUT' || _ucFyEl.tagName === 'SELECT') {
                            _ucFyMonth = _ucFyEl.value || null;
                        } else {
                            var _ucFySpan2 = _ucFyEl.querySelector('.multiselect__single');
                            if (_ucFySpan2 && _ucFySpan2.textContent.trim()) _ucFyMonth = _ucFySpan2.textContent.trim();
                        }
                    }
                }
                // Read Major Giving Threshold — mapper's own input takes priority, fall back to GHL input
                var _ucMapperThreshEl = document.getElementById('mapper-major-giving-threshold');
                var _ucThreshold = _ucMapperThreshEl ? parseFloat(_ucMapperThreshEl.value) : NaN;
                if (isNaN(_ucThreshold) || _ucThreshold <= 0) {
                    var _ucThreshEl = document.querySelector('[name="f7xBqOQM0lEntVHM9FbQ"]');
                    _ucThreshold = _ucThreshEl ? parseFloat(_ucThreshEl.value) : NaN;
                    if (isNaN(_ucThreshold) || _ucThreshold <= 0) _ucThreshold = 10000;
                }
                if (_ucFyMonth) {
                    var _ucResult = computeAnalytics(_ucGiftRows, _ucConsRows, { fyStartMonth: _ucFyMonth, threshold: _ucThreshold, donorJourney: !isSW });
                    _ucGiftSheet = XLSX.utils.aoa_to_sheet([_ucResult.gift.columns].concat(_ucResult.gift.rows));
                    _ucConstSheet = XLSX.utils.aoa_to_sheet([_ucResult.constituent.columns].concat(_ucResult.constituent.rows));
                    // FGD is output as an integer Excel serial to avoid SheetJS timezone fractional offset.
                    // Apply a date number format so Excel renders it as a date, not a plain integer.
                    var _ucFgdCI = _ucResult.gift.columns.indexOf('FGD');
                    if (_ucFgdCI >= 0) {
                        var _ucGiftRange = XLSX.utils.decode_range(_ucGiftSheet['!ref']);
                        for (var _ucFgdR = 1; _ucFgdR <= _ucGiftRange.e.r; _ucFgdR++) {
                            var _ucFgdAddr = XLSX.utils.encode_cell({r: _ucFgdR, c: _ucFgdCI});
                            if (_ucGiftSheet[_ucFgdAddr] && _ucGiftSheet[_ucFgdAddr].v != null) {
                                _ucGiftSheet[_ucFgdAddr].z = 'm/d/yyyy';
                            }
                        }
                    }
                    // Build donor/prospect sheets from upstream compute result
                    // Analytics sheets go to template; prospecting sheets go directly to Prospecting.xlsx
                    _ucProspectSheets = {
                        'All Donors':                XLSX.utils.aoa_to_sheet([_ucResult.allDonors.columns].concat(_ucResult.allDonors.rows)),
                        'Major Donors':              XLSX.utils.aoa_to_sheet([_ucResult.majorDonors.columns].concat(_ucResult.majorDonors.rows)),
                        'All Prospects':             XLSX.utils.aoa_to_sheet([_ucResult.allProspects.columns].concat(_ucResult.allProspects.rows)),
                        'Renewals':                  XLSX.utils.aoa_to_sheet([_ucResult.renewals.columns].concat(_ucResult.renewals.rows)),
                        'Major Gift Prospects':      XLSX.utils.aoa_to_sheet([_ucResult.majorGiftProspects.columns].concat(_ucResult.majorGiftProspects.rows)),
                        'Lapsed Major Donors':       XLSX.utils.aoa_to_sheet([_ucResult.lapsedMajorDonors.columns].concat(_ucResult.lapsedMajorDonors.rows)),
                        'Mid-Level Giving Prospects':XLSX.utils.aoa_to_sheet([_ucResult.midLevelProspects.columns].concat(_ucResult.midLevelProspects.rows)),
                        'Planned Giving Prospects':  XLSX.utils.aoa_to_sheet([_ucResult.plannedGivingProspects.columns].concat(_ucResult.plannedGivingProspects.rows)),
                        'Decreased Giving Donors':   XLSX.utils.aoa_to_sheet([_ucResult.decreasedGivingDonors.columns].concat(_ucResult.decreasedGivingDonors.rows)),
                        'Consecutive Giving Donors': XLSX.utils.aoa_to_sheet([_ucResult.consecutiveGivingDonors.columns].concat(_ucResult.consecutiveGivingDonors.rows)),
                    };
                    console.log('UPSTREAM_COMPUTE: gift rows=' + _ucResult.gift.rows.length + ' const rows=' + _ucResult.constituent.rows.length);
                } else {
                    console.warn('UPSTREAM_COMPUTE: FY Start Month not found in form, using standard output');
                }
            } catch(_ucErr) {
                console.error('UPSTREAM_COMPUTE error, falling back to standard output:', _ucErr);
            }
        }

        // Build gift data headers
        var giftHeaders = [];
        if (isSimpleFlow) {
            // Keep original column order unchanged for simple flows
            giftHeaders = origGiftHeaders.slice();
        } else {
            // Remove 'Gift Appeal', append Event and Spotlights at end
            for (var gh = 0; gh < origGiftHeaders.length; gh++) {
                if (origGiftHeaders[gh] !== 'Gift Appeal') giftHeaders.push(origGiftHeaders[gh]);
            }
            giftHeaders.push('Event');
            giftHeaders.push('Spotlights');
        }

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, _ucGiftSheet || XLSX.utils.json_to_sheet(gd, {header: giftHeaders}), 'Gift Data');
        XLSX.utils.book_append_sheet(wb, _ucConstSheet || XLSX.utils.json_to_sheet(cd2, {header: origConstHeaders}), 'Constituent Data');
        // Append pre-computed prospect/donor sheets (replaces FILTER-formula versions in template)
        var _ucProspectSheetNames = ['All Donors', 'Major Donors', 'All Prospects', 'Renewals',
            'Major Gift Prospects', 'Lapsed Major Donors', 'Mid-Level Giving Prospects',
            'Planned Giving Prospects', 'Decreased Giving Donors', 'Consecutive Giving Donors'];
        if (_ucProspectSheets) {
            for (var _psi = 0; _psi < _ucProspectSheetNames.length; _psi++) {
                var _psn = _ucProspectSheetNames[_psi];
                if (_ucProspectSheets[_psn]) XLSX.utils.book_append_sheet(wb, _ucProspectSheets[_psn], _psn);
            }
        }
        for (var q = 0; q < workbook.SheetNames.length; q++) {
            var sn = workbook.SheetNames[q];
            var _isProspectSheet = _ucProspectSheets && _ucProspectSheetNames.indexOf(sn) !== -1;
            if (sn !== 'Gift Data' && sn !== 'Constituent Data' && sn !== 'Instructions' && !_isProspectSheet) {
                try {
                    var srcSheet = workbook.Sheets[sn];
                    // For CC Campaign Data, evaluate tier formulas from direct inputs
                    // (formula cells have stale cached v:0 until opened in Excel)
                    var computedCells = {};
                    if (isCampaignCounsel && sn === 'Campaign Data') {
                        var goal = srcSheet['B4'] ? (srcSheet['B4'].v || 0) : 0;
                        if (goal > 0) {
                            // B: LOOKUP(goal*mult, standard_gift_table); C: MAX(1,ROUND(goal*coeff/B,0))
                            var ltbl = [10,25,50,100,250,500,1000,2500,5000,10000,25000,50000,100000,250000,500000,1000000,2500000,5000000,10000000,25000000,50000000,100000000,250000000,500000000,1000000000];
                            function xlLookup(v){var r=ltbl[0];for(var i=0;i<ltbl.length;i++){if(ltbl[i]<=v)r=ltbl[i];else break;}return r;}
                            var bMults  = [0.15, 0.05, 0.025, 0.0125, 0.005, 0.0025, 0.001];
                            var cCoeffs = [0.13, 0.13, 0.13,  0.13,   0.13,  0.12,   0.11];
                            var bv = [], cv = [], dv = [], cumF = 0;
                            for (var ti = 0; ti < 7; ti++) {
                                var tr = ti + 7;
                                var bCell = srcSheet['B' + tr];
                                var bIsFormula = bCell && (bCell.t === 'z' || bCell.f);
                                bv[ti] = (!bIsFormula && bCell && bCell.v !== undefined) ? bCell.v : xlLookup(goal * bMults[ti]);
                                computedCells['B' + tr] = { v: bv[ti], t: 'n', z: '"$"#,##0' };
                                var cCell = srcSheet['C' + tr];
                                var cIsFormula = cCell && (cCell.t === 'z' || cCell.f);
                                cv[ti] = (!cIsFormula && cCell && typeof cCell.v === 'number') ? cCell.v : Math.max(1, Math.round(goal * cCoeffs[ti] / bv[ti]));
                                computedCells['C' + tr] = { v: cv[ti], t: 'n', z: '#,##0' };
                                dv[ti] = bv[ti] * cv[ti];
                                computedCells['D' + tr] = { v: dv[ti], t: 'n', z: '"$"#,##0' };
                                computedCells['E' + tr] = { v: dv[ti] / goal, t: 'n', z: '0%' };
                                cumF += dv[ti] / goal;
                                computedCells['F' + tr] = { v: cumF, t: 'n', z: '0%' };
                            }
                            var sumD7_13 = dv.reduce(function(s, x) { return s + x; }, 0);
                            var d14 = goal - sumD7_13;
                            computedCells['D14'] = { v: d14, t: 'n', z: '"$"#,##0' };
                            computedCells['E14'] = { v: d14 / goal, t: 'n', z: '0%' };
                            computedCells['F14'] = { v: cumF + d14 / goal, t: 'n', z: '0%' };
                            var d15 = goal;
                            computedCells['D15'] = { v: d15, t: 'n', z: '"$"#,##0' };
                            computedCells['E15'] = { v: 1, t: 'n', z: '0%' };
                        }
                    }
                    // Clone sheet as values-only: preserve t, v, z; strip f; inject computed cells
                    var valSheet = {};
                    for (var addr in srcSheet) {
                        if (addr[0] === '!') {
                            valSheet[addr] = srcSheet[addr];
                        } else if (computedCells[addr]) {
                            valSheet[addr] = computedCells[addr];
                        } else {
                            var cell = srcSheet[addr];
                            var nc = { t: cell.t };
                            if (cell.v !== undefined) nc.v = cell.v;
                            if (cell.z !== undefined) nc.z = cell.z;
                            if (cell.f && nc.v === undefined) { nc.v = ''; nc.t = 's'; }
                            valSheet[addr] = nc;
                        }
                    }
                    for (var ca in computedCells) { if (!valSheet[ca]) valSheet[ca] = computedCells[ca]; }
                    XLSX.utils.book_append_sheet(wb, valSheet, sn);
                } catch(e) { console.warn('Could not copy sheet ' + sn + ':', e); }
            }
        }

        return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // Stub kept for backward compatibility — direct PA submit mode no longer uses GHL file input.
    window.attachToGHLForm = function() { return true; };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
