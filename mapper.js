/* APPROVED */
(function() {
    'use strict';
    // Bumped by hand on every push. It has to be a constant baked in at build
    // time, not a new Date() at load - a runtime clock reads "now" whichever
    // build is being served, so it cannot tell a fresh file from a cached one.
    var MAPPER_BUILD   = '2026-09-22 21:02 UTC';
    var MAPPER_VERSION = '9.22.2026 FEATURE TEST b18';
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
    var isDatabasey = _urlParams.get('brand') === 'databasey'; // also the default brand when no/unmatched ?brand= is present
    var isHF = _urlParams.get('brand') === 'hf';
    var isAlford = _urlParams.get('brand') === 'alford';
    var isStaffing = _urlParams.get('variant') === 'staffing';
    var isDevelopmentAssessment = _urlParams.get('variant') === 'developmentassessment';
    var isCampaignCounsel = _urlParams.get('variant') === 'campaigncounsel';
    var isSimpleFlow = isStaffing || isDevelopmentAssessment || isCampaignCounsel;
    // Databasey is the default/fallback brand; Alford now requires an explicit ?brand=alford match.
    // Kellogg has been retired (removed as a brand entirely).
    var themeColor = isSW ? '#00386c' : isHF ? '#56153C' : isAlford ? '#2c5f5d' : '#4F788D';
    var themeColorHover = isSW ? '#004f99' : isHF ? '#79385F' : isAlford ? '#3d7672' : '#5d8fa5';
    var themeColorLight = isSW ? 'rgba(0, 56, 108, 0.1)' : isHF ? 'rgba(86, 21, 60, 0.1)' : isAlford ? 'rgba(44, 95, 93, 0.1)' : 'rgba(79, 120, 141, 0.1)';
    var themeColorShadow = isSW ? 'rgba(0, 56, 108, 0.3)' : isHF ? 'rgba(86, 21, 60, 0.3)' : isAlford ? 'rgba(44, 95, 93, 0.3)' : 'rgba(79, 120, 141, 0.3)';
    console.log('Mapper.js: Theme =', isSW ? 'SW (#00386c)' : isHF ? 'HF (#56153C)' : isAlford ? 'Alford (#2c5f5d)' : 'Databasey (#4F788D)');
    // Logged before anything else can fail, so a build that breaks on load still
    // says which build it is.
    console.log('%cmapper.js ' + MAPPER_VERSION + ' — built ' + MAPPER_BUILD,
                'background:' + themeColor + ';color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;');

    // ---- Submission diagnostics ------------------------------------------------
    // The submit button spins until the page navigates away, so a stall anywhere in
    // build -> attach -> hand off to the GHL form looks identical to "still working".
    // This records each step with timings and surfaces errors that are otherwise only
    // visible in the console. Counts, sizes and timings only - never donor data or
    // file contents, so the report is safe for a client to paste into an email.
    var MapperDiag = (function() {
        var steps = [], t0 = null, box = null, statusEl = null, listEl = null, done = false;
        function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
        function fmt(ms) { return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s'; }
        function heap() {
            try { if (window.performance && performance.memory && performance.memory.usedJSHeapSize)
                return Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB'; } catch (e) {}
            return null;
        }
        function ensureBox() {
            if (box) return box;
            var anchor = document.getElementById('customSubmitBtn');
            if (!anchor) return null;
            box = document.createElement('div');
            box.id = 'mapperDiagBox';
            box.style.cssText = 'margin:14px auto 0;max-width:640px;border:1px solid #d1d5db;border-radius:8px;'
                + 'background:#f9fafb;padding:12px 14px;font-size:13px;color:#374151;text-align:left;line-height:1.5;';
            box.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">'
                + '<strong id="mapperDiagStatus" style="font-size:13px;color:' + themeColor + ';">Starting…</strong>'
                + '<button type="button" id="mapperDiagCopy" style="border:1px solid #d1d5db;background:#fff;border-radius:6px;'
                + 'padding:4px 10px;font-size:12px;cursor:pointer;color:#374151;">Copy diagnostics</button></div>'
                + '<div id="mapperDiagList" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#4b5563;"></div>';
            (anchor.parentNode || document.body).insertBefore(box, anchor.nextSibling);
            statusEl = box.querySelector('#mapperDiagStatus');
            listEl = box.querySelector('#mapperDiagList');
            box.querySelector('#mapperDiagCopy').addEventListener('click', function() {
                var btn = this, txt = report();
                function ok() { btn.textContent = 'Copied ✓'; setTimeout(function() { btn.textContent = 'Copy diagnostics'; }, 2000); }
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
                else fallback();
                function fallback() {
                    var ta = document.createElement('textarea');
                    ta.value = txt; ta.style.cssText = 'position:fixed;top:-1000px;';
                    document.body.appendChild(ta); ta.select();
                    try { document.execCommand('copy'); ok(); } catch (e) { btn.textContent = 'Press Ctrl+C'; ta.style.cssText = 'width:100%;height:120px;'; }
                    setTimeout(function() { if (ta.parentNode) ta.parentNode.removeChild(ta); }, 100);
                }
            });
            return box;
        }
        // A clean submission has nothing worth reading, so the panel stays out of the
        // way until something goes wrong. Steps are recorded from the start either
        // way, so whatever led up to a snag is all there the moment it appears.
        var revealed = false;
        function reveal() {
            if (revealed) return;
            revealed = true;
            ensureBox();
            render();
        }
        function render() {
            if (!revealed || !ensureBox()) return;
            var html = '';
            for (var i = 0; i < steps.length; i++) {
                var s = steps[i];
                var color = s.level === 'error' ? '#b91c1c' : s.level === 'warn' ? '#b45309' : '#4b5563';
                html += '<div style="color:' + color + ';">' + (s.level === 'error' ? '✕ ' : s.level === 'warn' ? '! ' : '• ')
                      + s.label + (s.detail ? ' — ' + s.detail : '')
                      + ' <span style="color:#9ca3af;">[' + fmt(s.at) + ']</span></div>';
            }
            listEl.innerHTML = html;
        }
        function setStatus(text, level) {
            if (!revealed || !ensureBox()) return;
            statusEl.textContent = text;
            statusEl.style.color = level === 'error' ? '#b91c1c' : level === 'warn' ? '#b45309' : themeColor;
            if (level === 'error') { box.style.borderColor = '#fca5a5'; box.style.background = '#fef2f2'; }
        }
        function padLeft(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
        function add(label, detail, level) {
            if (t0 === null) t0 = now();
            steps.push({ label: label, detail: detail || '', at: now() - t0, level: level || 'info' });
            render();
        }
        function report() {
            var lines = [];
            lines.push('Mapper submission diagnostics');
            lines.push('version: ' + MAPPER_VERSION + ' (built ' + MAPPER_BUILD + ')');
            lines.push('brand: ' + (isSW ? 'SW' : isHF ? 'HF' : isAlford ? 'Alford' : 'Databasey')
                     + (isSimpleFlow ? ' / ' + (isStaffing ? 'staffing' : isDevelopmentAssessment ? 'developmentassessment' : 'campaigncounsel') : ''));
            lines.push('when: ' + new Date().toISOString());
            lines.push('browser: ' + navigator.userAgent);
            if (heap()) lines.push('js heap in use: ' + heap());
            lines.push('');
            for (var i = 0; i < steps.length; i++) {
                var s = steps[i];
                lines.push((s.level === 'error' ? 'ERROR ' : s.level === 'warn' ? 'WARN  ' : '      ')
                         + padLeft(fmt(s.at), 8) + '  ' + s.label + (s.detail ? ' - ' + s.detail : ''));
            }
            return lines.join('\n');
        }
        // Redirecting on success tears this panel off the screen before anyone can
        // read it. Mirror the report somewhere that survives the navigation first -
        // the console for a live session, sessionStorage for afterwards.
        function persist() {
            var txt = report();
            try { console.log('--- mapper diagnostics ---\n' + txt); } catch (e) {}
            try { sessionStorage.setItem('mapperDiagReport', txt); } catch (e) {}
        }
        // A clean run has nothing worth reading, so it redirects on its own. A run
        // that recorded a warning waits for a click instead, so whoever submitted
        // can read the note - or copy it - before the page goes away.
        function holdForContinue(onContinue) {
            reveal();
            if (!ensureBox()) { onContinue(); return; }
            setStatus('Submitted — review the notes below, then continue', 'warn');
            if (box.querySelector('#mapperDiagContinue')) return;
            var bar = document.createElement('div');
            bar.style.cssText = 'margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
            bar.innerHTML = '<button type="button" id="mapperDiagContinue" style="border:0;background:' + themeColor
                + ';color:#fff;border-radius:6px;padding:8px 18px;font-size:13px;cursor:pointer;">Continue</button>'
                + '<span style="font-size:12px;color:#6b7280;">Your files were received and are being processed.</span>';
            box.appendChild(bar);
            box.querySelector('#mapperDiagContinue').addEventListener('click', onContinue);
        }
        return {
            start: function() { steps = []; t0 = now(); done = false; revealed = false;
                     add('Submit clicked', heap() ? 'heap ' + heap() : ''); },
            step:  function(label, detail) { add(label, detail); setStatus(label + '…'); },
            ok:    function(label, detail) { done = true; add(label, detail); setStatus(label, 'info'); },
            warn:  function(label, detail) { add(label, detail, 'warn'); reveal(); setStatus(label, 'warn'); },
            fail:  function(label, detail) { done = true; add(label, detail, 'error'); reveal();
                     setStatus('Stopped — ' + label + '. Use "Copy diagnostics" and send it to support.', 'error');
                     persist();
                     // The panel is the message once something has gone wrong; leaving
                     // a cheerful "Uploading…" pulsing above it reads as still running.
                     try { MapperStatus.hide(); } catch (e) {} },
            isDone: function() { return done; },
            started: function() { return t0 !== null; },
            hasWarnings: function() {
                for (var i = 0; i < steps.length; i++) if (steps[i].level === 'warn') return true;
                return false;
            },
            persist: persist,
            holdForContinue: holdForContinue,
            report: report
        };
    })();

    // What the person submitting sees while they wait. Deliberately separate from
    // MapperDiag: that one records timings and sizes for support and stays hidden
    // unless something goes wrong, which leaves a spinner and no explanation on a
    // submission that takes a minute. This says roughly where things are in plain
    // terms - enough to show it has not hung, without narrating internals.
    var MapperStatus = (function() {
        var box = null, dot = null, main = null, sub = null;
        function ensure() {
            if (box) return box;
            var anchor = document.getElementById('customSubmitBtn');
            if (!anchor) return null;
            if (!document.getElementById('mapper-status-style')) {
                var st = document.createElement('style');
                st.id = 'mapper-status-style';
                st.textContent = '@keyframes mapperPulse{0%,100%{opacity:.3;transform:scale(.75)}'
                               + '50%{opacity:1;transform:scale(1)}}';
                document.head.appendChild(st);
            }
            box = document.createElement('div');
            box.id = 'mapperSubmitStatus';
            box.style.cssText = 'margin:14px auto 0;text-align:center;line-height:1.45;';
            box.innerHTML = '<div style="display:inline-flex;align-items:center;gap:9px;font-size:13.5px;'
                + 'font-weight:600;color:' + themeColor + ';">'
                + '<span id="mapperStatusDot" style="width:7px;height:7px;border-radius:50%;flex:none;'
                + 'background:' + themeColor + ';animation:mapperPulse 1.1s ease-in-out infinite;"></span>'
                + '<span id="mapperStatusMain"></span></div>'
                + '<div id="mapperStatusSub" style="font-size:12px;color:#6b7280;margin-top:4px;"></div>';
            (anchor.parentNode || document.body).insertBefore(box, anchor.nextSibling);
            dot  = box.querySelector('#mapperStatusDot');
            main = box.querySelector('#mapperStatusMain');
            sub  = box.querySelector('#mapperStatusSub');
            return box;
        }
        function write(text, detail, pulsing) {
            if (!ensure()) return;
            box.style.display = '';
            main.textContent = text;
            sub.textContent = detail || '';
            sub.style.display = detail ? '' : 'none';
            dot.style.animation = pulsing ? 'mapperPulse 1.1s ease-in-out infinite' : 'none';
            dot.style.opacity = '1';
        }
        return {
            set:  function(text, detail) { write(text, detail, true); },
            done: function(text, detail) { write(text, detail, false); },
            hide: function() { if (box) box.style.display = 'none'; }
        };
    })();

    // Surface errors that would otherwise only appear in the console. A submission that
    // dies here is exactly the case where the spinner never stops.
    window.addEventListener('error', function(e) {
        if (MapperDiag.started() && !MapperDiag.isDone())
            MapperDiag.fail('Script error', (e && e.message ? e.message : 'unknown')
                + (e && e.filename ? ' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ')' : ''));
    });
    window.addEventListener('unhandledrejection', function(e) {
        if (MapperDiag.started() && !MapperDiag.isDone())
            MapperDiag.fail('Unhandled error', (e && e.reason && e.reason.message) ? e.reason.message : String(e && e.reason));
    });

    // Client-side-only guardrail against accidental wrong-brand submissions (e.g. someone
    // on /alfordanalytics submitting with an unrelated email). NOT real access control -
    // mapper.js and this check run entirely in the visitor's browser and can be bypassed by
    // anyone with basic technical knowledge (devtools, or POSTing PA_TRIGGER_URL directly,
    // which is already embedded client-side). null = no restriction for that brand.
    var ALL_TENANT_EMAIL_DOMAINS = ['getdatabasey.com', 'heyfundraiser.com'];
    var emailDomainAllowlist = isAlford ? ['alford.com'].concat(ALL_TENANT_EMAIL_DOMAINS)
        : isSW ? ['schultzwilliams.com'].concat(ALL_TENANT_EMAIL_DOMAINS)
        : null; // Databasey, HF: any email address
    var emailGateBrandLabel = isAlford ? 'Alford' : isSW ? 'SW' : '';

    function emailGateMessage() {
        var primaryDomain = emailDomainAllowlist[0]; // brand's own domain, listed first above
        return 'This form is reserved for ' + emailGateBrandLabel + ' clients and requires an email ending in '
            + '@' + primaryDomain + '. If you think this is a mistake, click the Get Support button.';
    }

    function isEmailDomainAllowed(email) {
        if (!emailDomainAllowlist) return true;
        var domain = (email || '').trim().toLowerCase().split('@')[1] || '';
        for (var i = 0; i < emailDomainAllowlist.length; i++) {
            if (domain === emailDomainAllowlist[i].toLowerCase()) return true;
        }
        return false;
    }

    // Apply theme to CSS variables so static CSS in HTML also picks up the color.
    // Always applied now — Databasey is a real (default) brand too, not just "no theme".
    document.documentElement.style.setProperty('--theme-color', themeColor);
    document.documentElement.style.setProperty('--theme-color-hover', themeColorHover);
    
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
        'religion': 'religion', 'Religion': 'religion',
        'associations': 'associations', 'Associations & National Organizations': 'associations'
    };

    var industryDisplayLabels = {
        'arts': 'Arts & Culture', 'environmental': 'Environmental', 'education': 'Education',
        'communityfoundation': 'Community Foundation', 'healthcare': 'Healthcare',
        'humanservices': 'Human Services', 'religion': 'Religion',
        'associations': 'Associations & National Organizations'
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
            var years = []; for (var y0 = endYear - dataYears + 1; y0 <= endYear; y0++) years.push(y0);
            // Donor Journey anchors on "Year5" (the 6th slot in the reported window, matching the
            // template's positional ConstituentData[Year5] reference) - a donor active 5 years before
            // the end of the reported window, whose giving history through end-of-data can then be
            // charted. That requires a full 6-year window (indices 0..5); with fewer years there's no
            // meaningful history to show, so leave it blank for everyone rather than reaching outside
            // the reported window into fuller raw history (the PPT automation deletes the slide when
            // there's nothing to populate it with).
            var djYear = (params.donorJourneyYear != null) ? params.donorJourneyYear
                : (years.length >= 6 ? years[5] : null);
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
            if (doDJ && djYear !== null) { for (var dji = 0; dji < G.length; dji++) { var dg = G[dji]; if (dg.cid !== null && dg.fy === djYear) djSum[dg.cid] = (djSum[dg.cid] || 0) + dg.amt; } }
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
            // Constituents with at least one gift inside the reported window. Used to trim the
            // output below: the template only ever shows these `years`, and every prospect flag
            // reads window years only, so a constituent with no in-window giving carries blank
            // year columns and cannot qualify for any flag or donor sheet. Dropping them is
            // output-only - all aggregates above (Total Giving, First Gift Date fallback, gifts
            // per year) are still built from the FULL gift history, so no reported number moves.
            var windowStart = years[0];
            var windowCidSet = Object.create(null);
            for (var _wci = 0; _wci < G.length; _wci++) {
                var _wg = G[_wci];
                if (_wg.cid === null || _wg.fy === null) continue;
                if (_wg.fy >= windowStart && _wg.fy <= endYear) windowCidSet[_wg.cid] = true;
            }
            var consOut = C.filter(function(c) { return c.cid !== null && (c.cid in giftCidSet) && (c.cid in windowCidSet); }).map(function(c) {
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
                if (doDJ && djYear !== null) donorJourney = (_givingFor(cid, djYear) !== null) ? 'Yes' : '';
                var w4 = years.slice(-4), lastY = years[years.length - 1];
                // block = the 4 raw giving values for Year7:Year10, matching the template's
                // COUNTIFS(Year7:Year10, ">=500", "<"&Threshold) exactly. Lift/Loss (year-over-year
                // change) is a different metric and must NOT be mixed in here — a donor whose giving
                // merely fluctuated through this dollar range isn't the same as one who actually gave
                // at that level, and counting both inflates Major Gift Prospect / Lapsed Major Donors
                // with false positives (confirmed: was 149 vs the correct 90 on one real dataset).
                var block = [];
                for (var bi = 0; bi < w4.length; bi++) block.push(giving[w4[bi]]);
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
            // Gifts older than the reported window are dropped from the OUTPUT only. The template
            // can only ever show `years` (10 FY max), so pre-window rows are pure file weight - on a
            // real client that was 33,684 of 44,488 rows (76%), and GenerateGivingCircles copies the
            // whole workbook through a save/reopen/save cycle before deleting Gift Data from the copy.
            // Post-window (current, incomplete FY) and blank/unparseable-date rows are kept: they are
            // recent or unclassifiable, not stale. Every aggregate above was built from the full set,
            // so Total Giving stays lifetime and the First Gift Date fallback still sees old gifts.
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
            }).filter(function(row, idx) {
                // map is 1:1 with G, so idx still indexes G here.
                var _fy = G[idx].fy;
                return _fy === null || _fy >= windowStart;
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

    // Finds a page-provided file input for the organization logo. mapper.js is
    // injected into the host form's document, so the logo input belongs to the
    // surrounding page rather than to anything mapper.js builds - the only handle
    // on it is whatever the form author named it. Mirrors setIndustryTypeField's
    // DOM-search pattern above for the same reason.
    //
    // On the GHL path the form itself carried the upload, so failing to find the
    // input here was invisible. On the direct path the logo only reaches Power
    // Automate if this finds it, so it searches several ways and reports which
    // one hit - see the "Logo" line in the submission diagnostics.
    var LOGO_MAX_BYTES = 12 * 1024 * 1024;

    // Every file input mapper.js can reach, minus its own data-file upload.
    // Same-origin ancestor frames are included; cross-origin ones throw and are
    // skipped, which is the correct outcome - their files are unreachable anyway.
    function logoCandidateInputs() {
        var docs = [document];
        [window.parent, window.top].forEach(function(w) {
            try {
                if (w && w !== window && w.document && docs.indexOf(w.document) === -1) docs.push(w.document);
            } catch (e) { /* cross-origin */ }
        });
        var out = [];
        docs.forEach(function(d) {
            var inputs = d.querySelectorAll('input[type="file"]');
            for (var i = 0; i < inputs.length; i++) {
                if (inputs[i].id === 'fileInput') continue;   // the mapper's own client-data upload
                out.push(inputs[i]);
            }
        });
        return out;
    }

    // What a field calls itself: its own attributes, plus a label that points at
    // it explicitly. Nothing here can belong to a neighbouring field, so this is
    // the safe pass. GHL puts the field's label in the name attribute and repeats
    // it in the placeholder ("Enter Client Name"), which between them identify
    // every field on the brand form.
    function directHints(el) {
        var bits = [el.name, el.id, el.getAttribute('aria-label'),
                    el.getAttribute('placeholder'), el.getAttribute('title'),
                    el.getAttribute('data-q')];
        try {
            var wrapping = el.closest('label');
            if (wrapping) bits.push(wrapping.textContent);
            if (el.id) {
                var forLbl = el.ownerDocument.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
                if (forLbl) bits.push(forLbl.textContent);
            }
        } catch (e) {}
        return bits.filter(Boolean).join(' ').toLowerCase();
    }

    // Adds the nearest label found in an ancestor container. Forms that label by
    // position rather than by "for" need this, but a tightly packed layout can
    // hand back the neighbour's label - so it is only ever a second pass.
    //
    // The hop limit is generous because GHL's file uploader nests the input
    // several wrappers below the field container the label sits in; four levels
    // stopped short of it and the logo field went unstyled and unread.
    function inputHints(el) {
        var bits = [directHints(el)];
        var node = el.parentNode, hops = 0;
        while (node && node.querySelector && hops < 8) {
            var near = node.querySelector('label');
            if (near) { bits.push(near.textContent.toLowerCase()); break; }
            // Not every form titles its fields with a <label>; GHL's uploader uses
            // a plain div, which is why searching for label elements alone never
            // found the logo field. Fall back to the container's own text once it
            // is short enough to be one field's worth rather than the whole form's.
            var txt = (node.textContent || '').replace(/\s+/g, ' ').trim();
            if (txt && txt.length <= 120) { bits.push(txt.toLowerCase()); break; }
            node = node.parentNode; hops++;
        }
        return bits.join(' ');
    }

    // Finds the element that actually paints the box the user sees. Class names
    // have been the wrong handle three times running, but a drawn border is a
    // drawn border whatever GHL calls it - so walk up from the input and take the
    // first ancestor with a visible one.
    function drawnBox(el, maxHops) {
        var node = el.parentNode, hops = 0;
        while (node && node.nodeType === 1 && hops < (maxHops || 6)) {
            try {
                var cs = window.getComputedStyle(node);
                var w = parseFloat(cs.borderTopWidth) || 0;
                var style = cs.borderTopStyle;
                if (w > 0 && style && style !== 'none' && style !== 'hidden') return node;
            } catch (e) {}
            node = node.parentNode; hops++;
        }
        return null;
    }

    // Prints what the page actually contains, once, so the shape of a widget
    // mapper.js does not own can be read off a screenshot instead of guessed at.
    // Two rounds of inferring GHL's uploader markup from a picture is enough.
    var _domReported = false;
    function reportHostDom() {
        if (_domReported) return;
        _domReported = true;
        try {
            var files = document.querySelectorAll('input[type="file"]');
            if (!files.length) { console.log('Mapper DOM: no file inputs on the page yet'); return; }
            var rows = [];
            for (var i = 0; i < files.length; i++) {
                var el = files[i], chain = [], node = el.parentNode, h = 0;
                while (node && node.tagName && h < 6) {
                    chain.push(node.tagName.toLowerCase()
                        + (node.className && typeof node.className === 'string' && node.className.trim()
                           ? '.' + node.className.trim().split(/\s+/).join('.') : ''));
                    node = node.parentNode; h++;
                }
                rows.push({
                    name: el.name || '', id: el.id || '', cls: el.className || '',
                    accept: el.accept || '', hasFile: !!(el.files && el.files[0]),
                    file: el.files && el.files[0] ? el.files[0].name : '',
                    hints: inputHints(el).slice(0, 120),
                    ancestors: chain.join('  <  ')
                });
            }
            console.log('Mapper DOM: %d file input(s)', files.length);
            rows.forEach(function(r, i) { console.log('  [' + i + ']', JSON.stringify(r, null, 1)); });
        } catch (e) { console.warn('Mapper DOM report failed —', e && e.message); }
    }

    // Uses the field's own naming only. The ancestor walk in inputHints can pick
    // up a neighbour's label - on a flat form every input sees the first label in
    // it - and mistaking the logo for the data file would skip it entirely.
    function looksLikeDataFile(input) {
        var h = directHints(input);
        return h.indexOf('client data') !== -1 || h.indexOf('gift') !== -1 || h.indexOf('constituent') !== -1;
    }

    // An uploader that ships the file to its own storage on selection is free to
    // clear input.files afterwards, and GHL's does exactly that often enough that
    // reading .files at submit time cannot be relied on - by then there may be
    // nothing left to read, however good the selector.
    //
    // So take a reference the moment the file is chosen. The change event fires
    // before the uploader gets to it, the File object stays valid once captured,
    // and a listener on the document in capture phase also catches inputs GHL
    // renders after this runs.
    var _pickedFiles = [];
    document.addEventListener('change', function(e) {
        var el = e.target;
        if (!el || el.type !== 'file' || el.id === 'fileInput') return;
        if (!el.files || !el.files[0]) return;
        for (var i = 0; i < _pickedFiles.length; i++) {
            if (_pickedFiles[i].el === el) { _pickedFiles[i].file = el.files[0]; return; }
        }
        _pickedFiles.push({ el: el, file: el.files[0] });
        console.log('Mapper: file selected on a host input —', el.files[0].name,
                    '(' + Math.round(el.files[0].size / 1024) + ' KB)');
        // Swap the drop zone for the thumbnail card straight away rather than
        // waiting for the observer to notice GHL building it.
        setTimeout(function() { try { styleHostForm(); } catch (e) {} }, 60);
    }, true);

    // Returns { file, how } - file is null when nothing qualified, and how always
    // explains the outcome so the diagnostics panel can show it.
    function getLogoFile() {
        var inputs = logoCandidateInputs();

        // Pair every reachable input with its file, preferring what the input still
        // holds and falling back to what was captured when it was chosen.
        var pairs = [];
        inputs.forEach(function(el) {
            if (el.files && el.files[0]) { pairs.push({ el: el, file: el.files[0], live: true }); return; }
            for (var i = 0; i < _pickedFiles.length; i++) {
                if (_pickedFiles[i].el === el) { pairs.push({ el: el, file: _pickedFiles[i].file, live: false }); return; }
            }
        });
        // A capture whose input has since been removed from the page still counts.
        _pickedFiles.forEach(function(p) {
            for (var i = 0; i < pairs.length; i++) if (pairs[i].el === p.el) return;
            if (p.el.id !== 'fileInput') pairs.push({ el: p.el, file: p.file, live: false });
        });

        var live = pairs.filter(function(p) { return p.live; }).length;

        function firstUsable(list, how) {
            for (var i = 0; i < list.length; i++) {
                if (list[i].file.size <= LOGO_MAX_BYTES) {
                    return { file: list[i].file, how: how + (list[i].live ? '' : ', recovered from selection') };
                }
            }
            return null;
        }

        var hit = firstUsable(pairs.filter(function(p) {
            return inputHints(p.el).indexOf('logo') !== -1;
        }), 'field named "logo"');
        if (hit) return hit;

        hit = firstUsable(pairs.filter(function(p) {
            return !looksLikeDataFile(p.el)
                && ((p.el.accept || '').toLowerCase().indexOf('image') !== -1
                    || /^image\//.test(p.file.type || ''));
        }), 'image upload');
        if (hit) return hit;

        var other = pairs.filter(function(p) { return !looksLikeDataFile(p.el); });
        if (other.length === 1) {
            hit = firstUsable(other, 'only other upload on the page');
            if (hit) return hit;
        }

        // Say which of the two cases this is, since they need different answers:
        // nothing was ever chosen, or something was chosen and could not be used.
        var how;
        if (!pairs.length) {
            how = 'no file was chosen on any of the ' + inputs.length + ' upload field(s) on this page';
        } else {
            how = pairs.length + ' file(s) found (' + live + ' still on the input) but none qualified as a logo';
        }
        return { file: null, how: how };
    }

    // The brand page's "Client Information" block collects all of this before the
    // upload step, so asking for it again once the mapping is done is redundant.
    // Read it off the host form instead.
    //
    // Matching is on text mapper.js does not own, so any lookup can miss. That is
    // why this fills the mapper's own inputs rather than bypassing them: a field
    // that is found gets filled and hidden, a field that is missed stays visible
    // and goes through exactly the validation it always did. Nothing can be
    // submitted blank because a label was renamed.
    var HOST_FIELD_HINTS = {
        'mapper-client-name':            ['client name', 'organization name'],
        'mapper-email':                  ['email'],
        'mapper-fy-start-month':         ['fiscal year start month', 'fiscal year start'],
        'mapper-major-giving-threshold': ['major giving threshold'],
        'mapper-board-members':          ['# of board members', 'number of board members', 'board members']
    };
    // The host form splits the contact across two fields; the mapper has one.
    var HOST_FIRST_NAME = ['first name'];
    var HOST_LAST_NAME  = ['last name'];

    function hostFormControls() {
        var docs = [document];
        [window.parent, window.top].forEach(function(w) {
            try {
                if (w && w !== window && w.document && docs.indexOf(w.document) === -1) docs.push(w.document);
            } catch (e) { /* cross-origin */ }
        });
        var out = [];
        docs.forEach(function(d) {
            var els = d.querySelectorAll('input, select, textarea');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                if (el.type === 'file' || el.type === 'hidden') continue;
                if (el.id && el.id.indexOf('mapper-') === 0) continue;  // the mapper's own copy of the field
                out.push(el);
            }
        });
        return out;
    }

    // A custom dropdown keeps its value out of the input that carries the label.
    // GHL builds these with vue-multiselect, whose multiselect__input is only the
    // type-to-filter box - zero width, value always "" - while the chosen option
    // is the text of the .multiselect__single beside it. Read the widget's
    // rendered selection when the matched control itself comes back empty.
    function readWidgetSelection(el) {
        var node = el.parentNode, hops = 0;
        while (node && node.querySelector && hops < 4) {
            var shown = node.querySelector('.multiselect__single, [class*="__single"]')
                     || node.querySelector('.multiselect__option--selected, [aria-selected="true"]');
            if (shown) {
                var txt = (shown.textContent || '').replace(/\s+/g, ' ').trim();
                if (txt) return txt;
            }
            node = node.parentNode; hops++;
        }
        return '';
    }

    function readHostField(needles) {
        var els = hostFormControls();
        function scan(hintsOf) {
            for (var i = 0; i < els.length; i++) {
                var h = hintsOf(els[i]);
                for (var j = 0; j < needles.length; j++) {
                    if (h.indexOf(needles[j]) !== -1) {
                        var v = (els[i].value == null ? '' : String(els[i].value)).trim();
                        if (!v) v = readWidgetSelection(els[i]);
                        if (v) return v;
                    }
                }
            }
            return '';
        }
        return scan(directHints) || scan(inputHints);
    }

    // Resolves a host value to an option the select already offers, tolerating
    // case and the abbreviations some forms use ("Jan" for January). Never
    // invents a value - anything unrecognised returns empty and leaves the
    // field on screen.
    function matchSelectOption(sel, value) {
        var want = value.toLowerCase(), opts = sel.options || [], i;
        for (i = 0; i < opts.length; i++) if (String(opts[i].value).toLowerCase() === want) return opts[i].value;
        for (i = 0; i < opts.length; i++) if (String(opts[i].text).trim().toLowerCase() === want) return opts[i].value;
        for (i = 0; i < opts.length; i++) {
            var ov = String(opts[i].value).toLowerCase();
            if (ov && want.length >= 3 && ov.indexOf(want) === 0) return opts[i].value;
        }
        return '';
    }

    // Fills and hides every field the brand form already answered. Returns the
    // number of fields still left on screen for the client to complete.
    function prefillFromHostForm() {
        var card = document.getElementById('allDoneCard');
        if (!card) return -1;
        var remaining = 0, taken = [];

        function apply(id, value) {
            var el = document.getElementById(id);
            if (!el) return;
            if (value && el.tagName === 'SELECT') value = matchSelectOption(el, value);
            if (value) {
                el.value = value;
                // A <select> silently ignores a value with no matching option, and
                // hiding an empty required field is worse than showing a filled one.
                // Only hide what actually took.
                if (String(el.value).trim()) {
                    el.dispatchEvent(new Event('input',  { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    if (el.parentNode && el.parentNode !== card) el.parentNode.style.display = 'none';
                    taken.push(id.replace('mapper-', ''));
                    return;
                }
                el.value = '';
            }
            remaining++;
        }

        for (var id in HOST_FIELD_HINTS) {
            if (HOST_FIELD_HINTS.hasOwnProperty(id)) apply(id, readHostField(HOST_FIELD_HINTS[id]));
        }
        apply('mapper-contact-name', (readHostField(HOST_FIRST_NAME) + ' ' + readHostField(HOST_LAST_NAME)).trim());

        // Collapse a two-column row once both of its fields are gone.
        var rows = card.querySelectorAll('div[style*="grid-template-columns"]');
        for (var r = 0; r < rows.length; r++) {
            var kids = rows[r].children, anyVisible = false;
            for (var k = 0; k < kids.length; k++) if (kids[k].style.display !== 'none') anyVisible = true;
            if (!anyVisible) rows[r].style.display = 'none';
        }

        var heading = document.getElementById('allDoneHeading');
        if (heading) {
            heading.textContent = remaining === 0
                ? '🎉 All Done! Click Submit below to send your data.'
                : '🎉 All Done! Fill in the details below to submit.';
        }
        console.log('Mapper: carried over from the brand form [' + (taken.join(', ') || 'nothing')
                  + '] — ' + remaining + ' field(s) still shown');
        return remaining;
    }

    // The brand page's own fields are stock GHL form controls, which do not match
    // the mapper sitting directly beneath them. Restyle them in place: appearance
    // only - borders, spacing, type, focus - never layout or behaviour, so GHL's
    // own validation and its uploader keep working. Everything is applied by
    // class through one injected stylesheet rather than inline, so :focus and
    // ::placeholder come along too.
    function hostFormStyleSheet() {
        return ''
        + '.mp-field{width:100%!important;padding:11px 14px!important;border:1.5px solid #d1d5db!important;'
        +   'border-radius:10px!important;font-size:0.95rem!important;line-height:1.4!important;'
        +   'color:#111827!important;background:#fff!important;box-shadow:none!important;'
        +   'box-sizing:border-box!important;transition:border-color .15s ease,box-shadow .15s ease!important;}'
        + '.mp-field::placeholder{color:#9ca3af!important;opacity:1!important;}'
        + '.mp-field:hover{border-color:#9ca3af!important;}'
        + '.mp-field:focus,.mp-field:focus-visible{border-color:' + themeColor + '!important;'
        +   'box-shadow:0 0 0 3px ' + themeColorLight + '!important;outline:none!important;}'
        + '.mp-label{display:block!important;font-size:0.82rem!important;font-weight:600!important;'
        +   'color:#374151!important;margin-bottom:6px!important;}'
        // vue-multiselect draws its box on .multiselect__tags, not on the input,
        // so the field styling has to land there instead.
        + '.mp-select .multiselect__tags{padding:11px 14px!important;border:1.5px solid #d1d5db!important;'
        +   'border-radius:10px!important;background:#fff!important;min-height:0!important;'
        +   'font-size:0.95rem!important;transition:border-color .15s ease,box-shadow .15s ease!important;}'
        + '.mp-select:hover .multiselect__tags{border-color:#9ca3af!important;}'
        + '.mp-select.multiselect--active .multiselect__tags{border-color:' + themeColor + '!important;'
        +   'box-shadow:0 0 0 3px ' + themeColorLight + '!important;}'
        + '.mp-select .multiselect__input,.mp-select .multiselect__single{border:0!important;padding:0!important;'
        +   'margin:0!important;background:transparent!important;box-shadow:none!important;'
        +   'font-size:0.95rem!important;color:#111827!important;line-height:1.4!important;}'
        + '.mp-select .multiselect__placeholder{margin:0!important;padding:0!important;color:#9ca3af!important;'
        +   'font-size:0.95rem!important;}'
        // overflow-y stays auto. Setting overflow:hidden here to clip the rounded
        // corners also cancelled vue-multiselect's own scrolling, so a twelve-month
        // list ran off the panel with no way to reach the bottom of it.
        + '.mp-select .multiselect__content-wrapper{border:1px solid #e5e7eb!important;border-radius:10px!important;'
        +   'box-shadow:0 10px 24px rgba(17,24,39,.10)!important;margin-top:4px!important;'
        +   'max-height:260px!important;overflow-y:auto!important;overflow-x:hidden!important;}'
        + '.mp-select .multiselect__option--highlight{background:' + themeColor + '!important;color:#fff!important;}'
        + '.mp-select .multiselect__option--highlight:after{background:transparent!important;color:#fff!important;}'
        // The logo drop zone, matched to the client-data upload box above it.
        // border-style is called out separately: GHL draws this box dashed, and a
        // shorthand alone has lost to it before. Border, radius and height are set
        // inline from the client-data box's own computed style - see matchUploadBox
        // - so the two are identical rather than merely similar.
        + '.mp-drop{border-style:solid!important;box-sizing:border-box!important;'
        +   'height:auto!important;padding:0!important;display:block!important;'
        +   'position:relative!important;cursor:pointer!important;'
        +   'transition:border-color .15s ease,background .15s ease!important;}'
        // A grey hover, not the brand colour - the client-data box this is matching
        // has no coloured state, and a navy edge here reads as a different control.
        + '.mp-drop:hover{border-color:#8f8f8f!important;background:#fafbfc!important;}'
        // Centred by taking the badge out of flow entirely. Laying the zone out as a
        // flex row let GHL's own children take the space and pinned the badge left.
        + '.mp-drop .mp-drop-icon{position:absolute!important;top:0!important;right:0!important;'
        +   'bottom:0!important;left:0!important;margin:0!important;padding:0!important;'
        +   'display:flex!important;align-items:center!important;justify-content:center!important;'
        +   'pointer-events:none!important;}'
        + '.mp-drop-hide{display:none!important;}'
        // With a file chosen the badge goes and the card, moved inside, sets the height.
        + '.mp-drop.mp-has-file{cursor:default!important;padding:10px!important;}'
        + '.mp-drop.mp-has-file .mp-drop-icon{display:none!important;}'
        // The label is keyboard-focusable, and GHL paints a heavy dark border on
        // focus. Suppress that but keep a visible ring, or tabbing through the form
        // lands somewhere with no indication.
        + '.mp-drop:focus,.mp-drop:focus-visible{outline:none!important;}'
        + '.mp-drop:focus-visible{box-shadow:0 0 0 3px ' + themeColorLight + '!important;}'
        + '.mp-hide{display:none!important;}'
        // The card keeps GHL's own layout - thumbnail, name, size, progress bar - but
        // loses its grey fill and edge: it now sits inside the drop zone, so its own
        // background reads as a second panel within the box.
        + '.mp-preview{background:transparent!important;background-color:transparent!important;'
        +   'border:0!important;box-shadow:none!important;margin:0!important;}';
    }

    // Walks up from a control looking for the element that draws the widget.
    function closestMatching(el, re, maxHops) {
        var node = el, hops = 0;
        while (node && hops <= (maxHops || 5)) {
            var cls = (node.className && node.className.baseVal !== undefined)
                    ? node.className.baseVal : String(node.className || '');
            if (re.test(cls)) return node;
            node = node.parentNode; hops++;
        }
        return null;
    }

    // Copies the client-data box's own measurements onto the logo box. Asked to make
    // one control look exactly like another, read the one you are matching rather
    // than hard-coding numbers off a screenshot - #uploadBox is styled a few hundred
    // lines above and would otherwise drift out of step with this.
    function matchUploadBox(zone) {
        var src = document.getElementById('uploadBox');
        if (!src) return;
        try {
            var cs = window.getComputedStyle(src);
            var h = parseFloat(cs.height) || 0;
            if (h < 40) return;   // not laid out yet
            zone.style.setProperty('min-height', Math.round(h) + 'px', 'important');
            zone.style.setProperty('border-width', cs.borderTopWidth, 'important');
            zone.style.setProperty('border-color', cs.borderTopColor, 'important');
            if ((parseFloat(cs.borderTopLeftRadius) || 0) > 0) {
                zone.style.setProperty('border-radius', cs.borderTopLeftRadius, 'important');
            }
            zone.style.setProperty('background-color', cs.backgroundColor, 'important');
        } catch (e) {}
    }

    function styleHostForm() {
        var tagged = { fields: 0, selects: 0, labels: 0, drop: 0, preview: 0 };
        try {
            reportHostDom();
            if (!document.getElementById('mapperHostFormStyle')) {
                var st = document.createElement('style');
                st.id = 'mapperHostFormStyle';
                st.textContent = hostFormStyleSheet();
                (document.head || document.documentElement).appendChild(st);
            }

            hostFormControls().forEach(function(el) {
                // The wrapper's class is exactly "multiselect"; its children are
                // "multiselect__input" and "multiselect__tags", which a loose match
                // would catch first - and the styling has to land on the wrapper.
                var ms = closestMatching(el, /(^|\s)multiselect(\s|$)/, 4);
                if (ms) {
                    if (ms.className.indexOf('mp-select') === -1) { ms.className += ' mp-select'; tagged.selects++; }
                } else if (el.className.indexOf('mp-field') === -1) {
                    el.className += ' mp-field'; tagged.fields++;
                }
                // Label the field owns, or the nearest one above it.
                var lbl = null;
                try {
                    if (el.id) lbl = document.querySelector('label[for="' + el.id.replace(/"/g, '\\"') + '"]');
                } catch (e) {}
                if (!lbl) {
                    var node = (ms || el).parentNode, hops = 0;
                    while (node && node.querySelector && hops < 3) {
                        lbl = node.querySelector('label');
                        if (lbl) break;
                        node = node.parentNode; hops++;
                    }
                }
                if (lbl && lbl.className.indexOf('mp-label') === -1) { lbl.className += ' mp-label'; tagged.labels++; }
            });

            // The logo uploader: style its drop zone like the client-data box and
            // swap GHL's icon for the mapper's, leaving the preview card - the part
            // that shows the logo thumbnail - in place.
            logoCandidateInputs().forEach(function(input) {
                if (inputHints(input).indexOf('logo') === -1) return;

                // The field's own wrapper: the nearest ancestor whose text names it.
                // Everything below is scoped to this, so nothing here can reach a
                // neighbouring field.
                var field = null, node = input.parentNode, hops = 0;
                while (node && node.nodeType === 1 && hops < 8) {
                    var t = (node.textContent || '').replace(/\s+/g, ' ').trim();
                    if (t.toLowerCase().indexOf('logo') !== -1 && t.length <= 400) { field = node; break; }
                    node = node.parentNode; hops++;
                }
                if (!field) return;

                // Once a zone has been chosen, keep it. The search below identifies the
                // box by its dashed border, and .mp-drop replaces that with a solid
                // one - so on the next pass the search missed the label it had just
                // styled, fell through to the class-name fallback and tagged
                // div.file-upload, an ancestor. That second box was the stray border
                // around the whole field.
                var zone = field.querySelector('.mp-drop');
                if (!zone) {
                    // GHL draws the drop area dashed and draws nothing else that way.
                    // It is a descendant of the field, not an ancestor of the input -
                    // walking up from the input lands on the wrapper holding the title
                    // as well, which is how the label ended up inside the box.
                    var all = field.querySelectorAll('*');
                    for (var z = 0; z < all.length; z++) {
                        try {
                            var zs = window.getComputedStyle(all[z]);
                            if (zs.borderTopStyle === 'dashed' && (parseFloat(zs.borderTopWidth) || 0) > 0) { zone = all[z]; break; }
                        } catch (e) {}
                    }
                    if (!zone) zone = closestMatching(input, /drop|upload|dropzone/i, 4);
                }
                if (!zone) return;

                // Tagging and the icon happen once; the chosen/not-chosen state has to
                // be re-evaluated on every pass. Returning early when the class was
                // already present meant the state below never ran after the first
                // paint, so the box stayed put once a file was picked.
                if (String(zone.className).indexOf('mp-drop') === -1) {
                    console.log('Mapper: logo drop zone →', zone.tagName.toLowerCase()
                              + '.' + (String(zone.className).trim().split(/\s+/).join('.') || '(no class)'));
                    zone.className += ' mp-drop';
                    tagged.drop++;
                }

                // The card GHL builds for the chosen file - the one holding the
                // thumbnail. Identified by the image rather than by class, and kept
                // out of everything that follows.
                // The whole card, not just the thumbnail's own container: it has to be
                // identified before the icon sweep below, because once the card has
                // been moved inside the zone the sweep would otherwise hide its delete
                // button along with GHL's decoration. The climb stops at the last
                // ancestor that is still purely the card, and gives the same answer
                // whether the card is still a sibling of the box or already inside it.
                var thumb = field.querySelector('img');
                // GHL names the card section.upload-card, which beats inferring it from
                // the thumbnail: the card is built progressively during the upload, so
                // a pass that runs mid-render can latch onto a part of it and - being
                // cached from then on - never correct itself.
                var preview = field.querySelector('[class*="upload-card"]');
                if (preview) {
                    var stale = field.querySelectorAll('.mp-preview');
                    for (var s = 0; s < stale.length; s++) {
                        if (stale[s] !== preview) stale[s].classList.remove('mp-preview');
                    }
                } else {
                    preview = field.querySelector('.mp-preview');
                }
                if (!preview && thumb) {
                    // Climb to the card, and no further. Two stop conditions, because
                    // GHL renders the card beside the box in some states and inside it
                    // in others: stop at the block sitting next to the box, or - once
                    // already inside it - as soon as the node has the card's own
                    // several children. Over-climbing swallowed the "1 file selected"
                    // counter, which then escaped being hidden.
                    preview = thumb;
                    while (preview.parentNode && preview.parentNode !== field
                           && !preview.parentNode.contains(zone)) {
                        if (zone.contains(preview) && preview.children && preview.children.length > 1) break;
                        preview = preview.parentNode;
                    }
                    if (preview === zone || preview.contains(zone)) preview = thumb.parentNode;
                }
                if (preview && preview !== zone && String(preview.className).indexOf('mp-preview') === -1) {
                    preview.className += ' mp-preview'; tagged.preview++;
                }

                // Skip the badge's own svg. This loop runs on every pass, so once the
                // badge had been inserted the next pass hid it along with GHL's and
                // left an empty box.
                var svgs = zone.querySelectorAll('svg');
                for (var i = 0; i < svgs.length; i++) {
                    // Skip the badge's own svg: this loop runs on every pass, so once
                    // the badge was inserted the next pass hid it along with GHL's and
                    // left an empty box.
                    if (svgs[i].closest && svgs[i].closest('.mp-drop-icon')) continue;
                    // And skip the card's, which sits inside the zone too - its delete
                    // button is the only way to swap the logo out.
                    if (preview && preview.contains(svgs[i])) continue;
                    if (svgs[i].closest && svgs[i].closest('[class*="placeholder"]')) continue;
                    svgs[i].classList.add('mp-drop-hide');
                }
                if (!zone.querySelector('.mp-drop-icon')) {
                    var icon = document.createElement('div');
                    icon.className = 'mp-drop-icon';
                    icon.innerHTML = uploadIconSvg;
                    zone.insertBefore(icon, zone.firstChild);
                }

                matchUploadBox(zone);

                // GHL renders the chosen file's card as a sibling below the box. Move
                // it inside, so the logo sits in its own field the way the client-data
                // file does rather than floating underneath it.
                if (preview && !zone.contains(preview) && !preview.contains(zone)) zone.appendChild(preview);
                zone.classList.toggle('mp-has-file', !!thumb);

                // GHL's "File selected / 1 file selected" counter goes regardless of
                // state - it restates what the card below it already shows, and the
                // card shows it better.
                var kids = field.querySelectorAll('div,span,p');
                for (var k = 0; k < kids.length; k++) {
                    var el = kids[k];
                    if (el === preview || (preview && preview.contains(el))) continue;
                    var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    if (/file selected/i.test(txt) && txt.length <= 60) el.classList.add('mp-hide');
                }
            });

            // The thumbnail card is tagged inside the logo block above, by the image it
            // contains. A page-wide sweep for "preview"/"uploaded" class names used to
            // do it here and matched one of GHL's outer wrappers, which is where the
            // second border around the whole field came from.
        } catch (e) {
            console.warn('Mapper: could not restyle the brand form —', e && e.message);
        }
        // Only when something was tagged, so the DOM-change re-runs stay quiet.
        if (tagged.fields || tagged.selects || tagged.labels || tagged.drop || tagged.preview) {
            console.log('Mapper: restyled ' + tagged.fields + ' field(s), ' + tagged.selects + ' dropdown(s), '
                      + tagged.labels + ' label(s), ' + tagged.drop + ' drop zone(s), '
                      + tagged.preview + ' preview(s)');
            // Name every element carrying a class of ours. A border appearing where
            // none was asked for is otherwise a guessing game about which rule found
            // which wrapper.
            try {
                var mine = document.querySelectorAll('.mp-field,.mp-select,.mp-drop,.mp-preview');
                for (var m = 0; m < mine.length; m++) {
                    var t = mine[m];
                    console.log('  tagged →', t.tagName.toLowerCase()
                        + '.' + String(t.className).trim().split(/\s+/).join('.')
                        + '  [' + Math.round(t.getBoundingClientRect().width) + '×'
                        + Math.round(t.getBoundingClientRect().height) + ']');
                }
            } catch (e) {}
        }
        return tagged;
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
        } else if (industry === 'associations') {
            spotlightConfig = { type: 'constituentType', title: 'Map Spotlights', categories: ['Members', 'Chapters', 'Skip'], completionText: 'You have successfully mapped all Constituent Types to spotlight categories.' };
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

        // Restyle the brand form. GHL renders it asynchronously and adds the logo
        // preview card only once a file is chosen, so re-run on a few timers and
        // on DOM changes rather than once at load. Tagging is idempotent - an
        // element already carrying its class is skipped.
        (function styleHostFormWhenReady() {
            styleHostForm();
            var tries = 0;
            var timer = setInterval(function() {
                styleHostForm();
                if (++tries >= 8) clearInterval(timer);
            }, 600);
            if (window.MutationObserver) {
                var pending = null;
                new MutationObserver(function() {
                    if (pending) return;
                    pending = setTimeout(function() { pending = null; styleHostForm(); }, 150);
                }).observe(document.body, { childList: true, subtree: true });
            }
        })();

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
                    + '<div id="allDoneHeading" style="font-size:1.3rem;font-weight:700;color:#111827;margin-bottom:6px;">🎉 All Done! Fill in the details below to submit.</div>'
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
                if (!isEmailDomainAllowed(email)) {
                    alert(emailGateMessage());
                    return;
                }
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
                // "Working" rather than "Uploading": nothing is uploaded for the first
                // several seconds, and on a large file the compute below is most of the
                // wait. The status line underneath says which part it is actually on.
                btn.innerHTML = '<div style="display:inline-flex;align-items:center;gap:10px;"><div style="width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);border-top:3px solid #ffffff;border-radius:50%;animation:mapperSpin 0.8s linear infinite;"></div><span>Working...</span></div>';
                MapperDiag.start();
                MapperStatus.set('Checking your entries');

                setTimeout(function() {
                    MapperDiag.step('Building the data file', 'computing and packaging - the slow step on large files');
                    MapperStatus.set('Reviewing your data', 'this is the longest step on a large file');
                    var blob;
                    try {
                        blob = generateExcelBlob();
                    } catch (buildErr) {
                        MapperDiag.fail('Building the file failed', buildErr && buildErr.message ? buildErr.message : String(buildErr));
                        btn.disabled = false; btn.innerHTML = originalHTML;
                        return;
                    }
                    if (!blob) { MapperDiag.fail('Mapping steps are incomplete', 'finish every mapping step, then submit'); btn.disabled = false; btn.innerHTML = originalHTML; return; }
                    MapperDiag.step('Data file built', (blob.size / 1048576).toFixed(1) + ' MB');
                    MapperStatus.set('Packaging your analysis');

                    // HF runs through the same downstream pipeline/macro template as Databasey — only Alford and SW are distinct.
                    var formSource   = isSW ? 'SW' : (isAlford ? 'Alford' : 'Databasey');
                    var analysisType = isStaffing ? 'Interim Staffing' : (isDevelopmentAssessment ? 'Development Assessment' : (isCampaignCounsel ? 'Campaign Counsel' : 'Analytics'));
                    var logoLookup = getLogoFile();
                    var logoFile   = logoLookup.file;
                    if (logoFile) {
                        MapperDiag.step('Logo found', logoFile.name + ' — '
                            + Math.round(logoFile.size / 1024) + ' KB, via ' + logoLookup.how);
                        MapperStatus.set('Adding your logo', logoFile.name);
                    } else {
                        MapperDiag.warn('No logo attached', logoLookup.how
                            + ' — submitting without one');
                    }

                    function submitPayload(logoBase64, logoFilename) {
                        var reader = new FileReader();
                        MapperDiag.step('Encoding for upload', 'base64 - roughly a third larger than the file');
                        reader.readAsDataURL(blob);
                        reader.onloadend = function() {
                            var base64 = reader.result.split(',')[1];
                            MapperDiag.step('Encoded', (base64.length / 1048576).toFixed(1) + ' MB to send'
                                + (logoBase64 ? ', logo ' + Math.round(logoBase64.length / 1024) + ' KB'
                                              : ', no logo'));
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
                            MapperDiag.step('Uploading', 'sending to the processing service');
                            MapperStatus.set('Uploading client data',
                                (base64.length / 1048576).toFixed(1) + ' MB — please keep this page open');
                            fetch(PA_TRIGGER_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            })
                            .then(function(res) {
                                if (res.ok || res.status === 202) {
                                    // mapper.js runs inside an iframe on the brand page, so
                                    // window.location would navigate the frame and render the
                                    // confirmation page *inside* the host page - Databasey
                                    // branding embedded in an SW layout. Navigate the top frame.
                                    var goToConfirmation = function() {
                                        try { window.top.location.href = 'https://getdatabasey.com/submitted'; }
                                        catch (e) { window.location.href = 'https://getdatabasey.com/submitted'; }
                                    };
                                    var held = MapperDiag.hasWarnings();
                                    MapperDiag.ok('Submitted successfully', held ? 'with notes - see below' : 'redirecting');
                                    MapperDiag.persist();
                                    MapperStatus.done('Submitted', 'taking you to the confirmation page');
                                    if (held) MapperDiag.holdForContinue(goToConfirmation);
                                    else setTimeout(goToConfirmation, 2500);
                                } else {
                                    throw new Error('Server returned ' + res.status);
                                }
                            })
                            .catch(function(err) {
                                console.error('PA submit error:', err);
                                MapperDiag.fail('Upload failed', err && err.message ? err.message : String(err));
                                btn.disabled = false;
                                btn.innerHTML = originalHTML;
                                alert('Submission failed — please try again or contact support.\n\nError: ' + err.message);
                            });
                        };
                        reader.onerror = function() {
                            MapperDiag.fail('Could not encode the file for upload', 'the browser may have run out of memory');
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
                            MapperDiag.warn('Logo could not be read', 'submitting without it');
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
        // 6-year minimum data range check (all non-SW brands)
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
        var adc = document.getElementById('allDoneCard');
        if (adc) {
            // Read the brand form now rather than when the card was built - the
            // client fills it in before uploading, so the values are only
            // guaranteed to be there by the time the card is about to be shown.
            prefillFromHostForm();
            adc.style.display = 'block';
        }
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
            // computeAnalytics returns '' for a blank cell, and SheetJS materializes that as a
            // full <c r="E2" t="str"><v></v></c> element - ~30 bytes of nothing per cell. null
            // is omitted from the sheet XML entirely. On a real client (Montpelier) that padding
            // was 399,555 cells / ~11MB of the 57MB of sheet XML, most of it three Gift Data
            // columns that are blank on every single row. Swap '' -> null on the way out; the
            // values are identical to Excel either way (a blank cell still satisfies ="").
            function _ucAoaSheet(columns, rows) {
                var blanked = rows.map(function(r) {
                    var o = new Array(r.length);
                    for (var i = 0; i < r.length; i++) o[i] = (r[i] === '' ? null : r[i]);
                    return o;
                });
                return XLSX.utils.aoa_to_sheet([columns].concat(blanked));
            }
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
                    _ucGiftSheet = _ucAoaSheet(_ucResult.gift.columns, _ucResult.gift.rows);
                    _ucConstSheet = _ucAoaSheet(_ucResult.constituent.columns, _ucResult.constituent.rows);
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
                        'All Donors':                _ucAoaSheet(_ucResult.allDonors.columns, _ucResult.allDonors.rows),
                        'Major Donors':              _ucAoaSheet(_ucResult.majorDonors.columns, _ucResult.majorDonors.rows),
                        'All Prospects':             _ucAoaSheet(_ucResult.allProspects.columns, _ucResult.allProspects.rows),
                        'Renewals':                  _ucAoaSheet(_ucResult.renewals.columns, _ucResult.renewals.rows),
                        'Major Gift Prospects':      _ucAoaSheet(_ucResult.majorGiftProspects.columns, _ucResult.majorGiftProspects.rows),
                        'Lapsed Major Donors':       _ucAoaSheet(_ucResult.lapsedMajorDonors.columns, _ucResult.lapsedMajorDonors.rows),
                        'Mid-Level Giving Prospects':_ucAoaSheet(_ucResult.midLevelProspects.columns, _ucResult.midLevelProspects.rows),
                        'Planned Giving Prospects':  _ucAoaSheet(_ucResult.plannedGivingProspects.columns, _ucResult.plannedGivingProspects.rows),
                        'Decreased Giving Donors':   _ucAoaSheet(_ucResult.decreasedGivingDonors.columns, _ucResult.decreasedGivingDonors.rows),
                        'Consecutive Giving Donors': _ucAoaSheet(_ucResult.consecutiveGivingDonors.columns, _ucResult.consecutiveGivingDonors.rows),
                    };
                    console.log('UPSTREAM_COMPUTE: gift rows=' + _ucResult.gift.rows.length + ' const rows=' + _ucResult.constituent.rows.length);
                    MapperDiag.step('Analytics computed', _ucResult.gift.rows.length.toLocaleString() + ' gift rows, ' + _ucResult.constituent.rows.length.toLocaleString() + ' constituents');
                } else {
                    console.warn('UPSTREAM_COMPUTE: FY Start Month not found in form, using standard output');
                    MapperDiag.warn('Fiscal Year Start Month not found', 'submitting without the computed analytics columns');
                }
            } catch(_ucErr) {
                console.error('UPSTREAM_COMPUTE error, falling back to standard output:', _ucErr);
                MapperDiag.warn('Analytics computation failed', (_ucErr && _ucErr.message ? _ucErr.message : String(_ucErr)) + ' - falling back to standard output');
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

        // Trailing reference copies of the untouched, as-uploaded Gift Data / Constituent Data —
        // for manual comparison against the processed sheets above if something looks off downstream.
        // workbook.Sheets[...] is never mutated in place anywhere in this function (only the
        // sheet_to_json()-derived gd/cd2 arrays are), so these are genuinely pre-mapper snapshots.
        // Named distinctly so the macro/flow (which only ever reads 'Gift Data'/'Constituent Data'
        // by exact name) ignores them entirely — no separate submission or flow branch needed.
        function cloneSheetValuesOnly(srcSheet) {
            var out = {};
            for (var addr in srcSheet) {
                if (addr[0] === '!') { out[addr] = srcSheet[addr]; continue; }
                var cell = srcSheet[addr];
                var nc = { t: cell.t };
                if (cell.v !== undefined) nc.v = cell.v;
                if (cell.z !== undefined) nc.z = cell.z;
                if (cell.f && nc.v === undefined) { nc.v = ''; nc.t = 's'; }
                out[addr] = nc;
            }
            return out;
        }
        // Untrimmed reference copies of what was uploaded. They are never read by the PAD flow
        // or any macro - they exist purely so the original rows can be inspected after the fact.
        // On Montpelier they were 21.6MB of the 57MB of sheet XML (38%), which is payload the
        // submitter's browser has to build, zip, base64 and POST. Off by default; flip to true
        // if someone needs the raw rows round-tripped again.
        var INCLUDE_ORIGINAL_SHEETS = false;
        if (INCLUDE_ORIGINAL_SHEETS) {
            if (workbook.Sheets['Gift Data']) XLSX.utils.book_append_sheet(wb, cloneSheetValuesOnly(workbook.Sheets['Gift Data']), 'Gift Data (Original)');
            if (workbook.Sheets['Constituent Data']) XLSX.utils.book_append_sheet(wb, cloneSheetValuesOnly(workbook.Sheets['Constituent Data']), 'Constituent Data (Original)');
        }

        // bookSST writes repeated strings once into a shared-string table and references them by
        // index, instead of inlining every occurrence. Excel itself writes files this way - it is
        // why the 4MB source expands to 21MB here. On Montpelier's Gift Data alone, "Cash" and
        // "Individuals" were each written out ~40,700 times.
        return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true, bookSST: true })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    // Stub kept for backward compatibility — direct PA submit mode no longer uses GHL file input.
    window.attachToGHLForm = function() { return true; };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
