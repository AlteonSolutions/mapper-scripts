/* APPROVED */
(function() {
    'use strict';
    // The console showed the whole script initialising twice in one document, which
    // means two MutationObservers, two change listeners and two of every timer
    // working the same DOM. Whichever copy gets here first does the work.
    if (window.__mapperLoaded) {
        console.warn('mapper.js: already loaded in this document — second copy stood down');
        return;
    }
    window.__mapperLoaded = true;
    // Bumped by hand on every push. It has to be a constant baked in at build
    // time, not a new Date() at load - a runtime clock reads "now" whichever
    // build is being served, so it cannot tell a fresh file from a cached one.
    var MAPPER_BUILD   = '2026-09-24 13:30 UTC';
    var MAPPER_VERSION = '9.23.2026 STANDALONE s15';
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

    // Brand and variant come from the URL. The query params are what the GHL form
    // iframe was handed; running inline on the brand page there are none, so fall
    // back to the path - the same rule sector-selection.js has always used. Query
    // param wins where present, so an explicit ?brand= still overrides for testing.
    var _urlParams = new URLSearchParams(window.location.search);
    var _href = window.location.href;
    function _brandIs(name, pathBit) {
        var q = _urlParams.get('brand');
        if (q) return q === name;
        return _href.indexOf(pathBit) !== -1;
    }
    function _variantIs(name, pathBit) {
        var q = _urlParams.get('variant');
        if (q) return q === name;
        return _href.indexOf(pathBit) !== -1;
    }
    var isSW = _brandIs('sw', 'getdatabasey.com/sw');
    var isDatabasey = _brandIs('databasey', 'getdatabasey.com/analytics'); // also the default brand when nothing matches
    var isHF = _brandIs('hf', 'getdatabasey.com/heyfundraiser');
    var isAlford = _brandIs('alford', 'getdatabasey.com/alfordanalytics');
    var isStaffing = _variantIs('staffing', 'getdatabasey.com/sw/staffing');
    var isDevelopmentAssessment = _variantIs('developmentassessment', 'getdatabasey.com/sw/developmentassessment');
    var isCampaignCounsel = _variantIs('campaigncounsel', 'getdatabasey.com/sw/campaigncounsel');
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
    var _frameTag = (function() {
        try {
            var where = window.top === window ? 'top' : 'frame';
            return where + ' ' + (location.pathname || '/') + (location.search || '');
        } catch (e) { return 'frame ?'; }
    })();
    console.log('mapper.js: running in [' + _frameTag + ']'
        + (window.top === window ? '' : ' — this page is framed'));
    console.log('%cmapper.js ' + MAPPER_VERSION + ' — built ' + MAPPER_BUILD,
                'background:' + themeColor + ';color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;');

    // ---- Submission diagnostics ------------------------------------------------
    // The submit button spins until the page navigates away, so a stall anywhere in
    // build -> encode -> POST looks identical to "still working".
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
    // submission that takes a minute. One line, no detail beneath it - enough to
    // show it has not hung, without narrating internals.
    var MapperStatus = (function() {
        var box = null, dot = null, main = null;
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
                + '<span id="mapperStatusMain"></span></div>';
            (anchor.parentNode || document.body).insertBefore(box, anchor.nextSibling);
            dot  = box.querySelector('#mapperStatusDot');
            main = box.querySelector('#mapperStatusMain');
            return box;
        }
        function write(text, pulsing) {
            if (!ensure()) return;
            box.style.display = '';
            main.textContent = text;
            dot.style.animation = pulsing ? 'mapperPulse 1.1s ease-in-out infinite' : 'none';
            dot.style.opacity = '1';
        }
        // Most of these steps take milliseconds - only the compute and the POST take
        // real time - so written straight to the page they would flash past unread
        // and the line would look like it was glitching rather than progressing.
        // Queue them and hold each one long enough to be read. This delays only the
        // display; the work carries on underneath at full speed.
        var MIN_DWELL = 650, queue = [], draining = false;
        function pump() {
            if (!queue.length) { draining = false; return; }
            draining = true;
            write(queue.shift(), true);
            setTimeout(pump, MIN_DWELL);
        }
        return {
            set:  function(text) { queue.push(text); if (!draining) pump(); },
            // The final state jumps the queue: it is followed by a redirect, and
            // anything still waiting to be shown would be cut off by it anyway.
            done: function(text) { queue = []; draining = false; write(text, false); },
            hide: function() { queue = []; draining = false; if (box) box.style.display = 'none'; }
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
    // Recorded as the workbook is read, so the All Done card can say what is about
    // to be sent without re-walking the data.
    var uploadedGiftCount = 0, uploadedConstituentCount = 0;
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


    // A logo larger than this is almost certainly the wrong file.
    var LOGO_MAX_BYTES = 12 * 1024 * 1024;


    // The logo now comes from an input mapper.js renders and owns, so there is
    // nothing to hunt for: read it, or say plainly that none was chosen. The
    // capture-on-change listener is gone with it - our input is never cleared out
    // from under us the way GHL's uploader cleared its own.
    function getLogoFile() {
        var input = document.getElementById('mapper-logo');
        var file = input && input.files && input.files[0];
        if (!file) return { file: null, how: 'no logo was chosen' };
        if (file.size > LOGO_MAX_BYTES) {
            return { file: null, how: 'the chosen file is ' + Math.round(file.size / 1048576) + ' MB, too large for a logo' };
        }
        return { file: file, how: 'from the logo field' };
    }


    window.addEventListener('message', function(event) {
        var data = event.data;
        if (data && data.type === 'setIndustryType' && data.value) {
            console.log('Received industry via postMessage:', data.value);
            selectedIndustryType = data.value;
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
        renderShell();
        // Check URL params on load - if industry param exists, detect and set field
        var urlParams = new URLSearchParams(window.location.search);
        var industryParam = urlParams.get('industry');
        if (industryParam && industryParamMap[industryParam]) {
            var detected = industryParamMap[industryParam];
            selectedIndustryType = industryDisplayLabels[detected] || null;
            console.log('✓ Industry from URL on init:', detected, '(' + selectedIndustryType + ')');
            if (!isSimpleFlow) setSpotlightConfig(detected);
        }

        // Hide custom submit button until all mapping is complete
        waitForElement('#customSubmitBtn', function(btn) {
            btn.parentElement.style.display = 'none';
        });


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
            renderClientPanel();
            el.style.cssText += ';' + UPLOAD_BOX_CSS;
            if (el.className.indexOf('mp-upload-box') === -1) el.className += ' mp-upload-box';
            dressUploadBox(el);
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

        // Wrap mapping sections in a bordered box with a label
        waitForElement('#categorySetup', function(catSetup) {
            var parent = catSetup.parentNode;
            // Create label
            var label = document.createElement('div');
            label.id = 'mappingBoxLabel';
            label.textContent = 'Client Data File Mapping';
            // Matches the panel's section headings, so the page reads as four
            // sections rather than three and a caption.
            label.style.cssText = 'margin:30px 0 16px;color:#2c3345;text-align:left;'
                + 'font-size:17px;font-weight:600;display:none;';
            // Create wrapper box
            var box = document.createElement('div');
            box.id = 'mappingBox';
            box.style.cssText = 'border:none;padding:0;background:#fff;width:100%;'
                + 'box-sizing:border-box;display:none;';
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
                var _chk = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" '
                    + 'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                    + '<path d="m5 12 5 5L20 7"></path></svg>';
                allDoneCard.innerHTML = ''
                    + '<div id="allDoneCheck" style="width:44px;height:44px;border-radius:50%;margin:0 auto 14px;'
                    +   'display:flex;align-items:center;justify-content:center;background:' + themeColor + ';">' + _chk + '</div>'
                    + '<div id="allDoneHeading" style="font-size:1.12rem;font-weight:700;color:#111827;margin-bottom:5px;">Mapping Complete</div>'
                    + '<div id="allDoneSummary" style="font-size:0.87rem;color:#6b7280;margin-bottom:2px;"></div>'
                    + '<div id="allDoneError" style="display:none;margin-top:14px;padding:10px 14px;'
                    +   'background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#b91c1c;'
                    +   'font-size:0.87rem;font-weight:500;text-align:left;"></div>'
                    ;
                giftTypeSec.appendChild(allDoneCard);
            }
        });

        waitForElement('#customSubmitBtn', function(btn) {
            btn.addEventListener('click', function() {
                // Validate submission fields
                var clientName  = (document.getElementById('mapper-client-name')             || {}).value || '';
                var firstName   = (document.getElementById('mapper-first-name')              || {}).value || '';
                var lastName    = (document.getElementById('mapper-last-name')               || {}).value || '';
                var contactName = (firstName.trim() + ' ' + lastName.trim()).trim();
                var email       = (document.getElementById('mapper-email')                   || {}).value || '';
                var fyMonth     = (document.getElementById('mapper-fy-start-month')          || {}).value || '';
                var threshRaw   = (document.getElementById('mapper-major-giving-threshold')  || {}).value || '';
                var threshold   = parseFloat(threshRaw);
                var boardMembers = (document.getElementById('mapper-board-members')          || {}).value || '';

                // These come from the panel at the top of the page, not from anything
                // on this card - so name what is missing and point back up there.
                var missing = [];
                if (!clientName.trim())  missing.push('Client Name');
                if (!firstName.trim() || !lastName.trim()) missing.push('First and Last Name');
                if (!email.trim() || email.indexOf('@') < 0) missing.push('Email');
                if (!fyMonth)            missing.push('Fiscal Year Start Month');
                if (isNaN(threshold) || threshold <= 0) missing.push('Major Giving Threshold');
                if (missing.length) {
                    showAllDoneError('Almost there — please complete ' + listToSentence(missing)
                        + ' at the top of this page, then submit again.');
                    return;
                }
                if (!isEmailDomainAllowed(email)) { showAllDoneError(emailGateMessage()); return; }
                if (!PA_TRIGGER_URL) { showAllDoneError('Submission endpoint not configured. Please contact support.'); return; }
                showAllDoneError('');

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
                MapperStatus.set('Checking Your Entries');

                setTimeout(function() {
                    MapperDiag.step('Building the data file', 'computing and packaging - the slow step on large files');
                    MapperStatus.set('Uploading Client Data File');
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

                    // HF runs through the same downstream pipeline/macro template as Databasey — only Alford and SW are distinct.
                    var formSource   = isSW ? 'SW' : (isAlford ? 'Alford' : 'Databasey');
                    var analysisType = isStaffing ? 'Interim Staffing' : (isDevelopmentAssessment ? 'Development Assessment' : (isCampaignCounsel ? 'Campaign Counsel' : 'Analytics'));
                    var logoLookup = getLogoFile();
                    var logoFile   = logoLookup.file;
                    if (logoFile) {
                        MapperDiag.step('Logo found', logoFile.name + ' — '
                            + Math.round(logoFile.size / 1024) + ' KB, via ' + logoLookup.how);
                    } else {
                        MapperDiag.warn('No logo attached', logoLookup.how
                            + ' — submitting without one');
                    }
                    // Queued together so they read in sequence. The logo line is
                    // skipped when there is no logo rather than claiming one was sent.
                    if (logoFile) MapperStatus.set('Uploading Client Logo');
                    MapperStatus.set('Reviewing Client Data File');

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
                            MapperStatus.set('Formatting Client Data File');
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
                                    MapperStatus.done('Submitted');
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
        startSlowWatch();
        var detected = detectIndustry();
        if (detected) { if (!isSimpleFlow) setSpotlightConfig(detected); var lbl = industryDisplayLabels[detected]; if (lbl) selectedIndustryType = lbl; }

        // Show loading state
        var uploadBox = document.getElementById('uploadBox');
        uploadBox.style.border = '1px solid #ACACACFF';
        uploadBox.style.cursor = 'default';
        // The same card it will show when finished, so the box does not change
        // shape when the file lands - the phase sits where the name will be, and
        // the bar is already in place.
        uploadBox.className = (uploadBox.className.replace(/\bmp-has-file\b/g, '') + ' mp-has-file').trim();
        uploadBox.innerHTML = uploadCardHtml({
            visual: dataFileIcon(), pct: 0, clearable: false,
            titleId: 'mapperReadStatus', detailId: 'mapperReadDetail',
            fillId: 'mapperReadFill', pctId: 'mapperReadPct'
        });
        uploadBox.querySelector('#mapperReadStatus').textContent = 'Reading Your File…';
        uploadBox.querySelector('#mapperReadDetail').textContent = file.name;
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
            // Parsing a large workbook used to run as one synchronous stretch - read,
            // two sheet_to_json passes, then validation - which is what produced
            // Chrome's "page unresponsive" prompt. The work itself is unavoidable, but
            // it does not have to happen without letting the page breathe. Each phase
            // gets its own turn of the event loop, so the browser stays responsive and
            // the line under the spinner keeps up with where things are.
            var giftJson = null, constJson = null;
            function say(text) {
                var el = document.getElementById('mapperReadStatus');
                if (el) el.textContent = text;
            }
            // Reading the bytes is the first fifth of the bar; the five parse phases
            // divide the rest. Both are real work, so the number is not invented.
            function setRead(n) {
                n = Math.max(0, Math.min(100, Math.round(n)));
                var fill = document.getElementById('mapperReadFill');
                var pct  = document.getElementById('mapperReadPct');
                if (fill) fill.style.width = n + '%';
                if (pct)  pct.textContent = n + '%';
            }
            function bail(err) {
                console.error('Mapper: reading the workbook failed —', err);
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.style.cursor = 'pointer';
                uploadBox.innerHTML = uploadIconSvg;
                var dn = document.getElementById('uploadNote'); if (dn) dn.style.display = '';
                var dd = document.getElementById('download-container'); if (dd) dd.style.display = 'flex';
                alert('Error reading file: ' + err.message);
            }
            var phases = [
                ['Reading Your File', function() {
                    var data = new Uint8Array(e.target.result);
                    // dense stores each row as an array rather than a map of cell
                    // addresses. On a 100k-row file that is about 20% off the read -
                    // the single biggest cost of opening a file - and sheet_to_json
                    // reads either shape, so nothing downstream notices. Verified
                    // value-identical across all twelve sheets of a real data file.
                    workbook = XLSX.read(data, { type: 'array', dense: true,
                        cellFormula: false, cellHTML: false, cellNF: false });
                    if (workbook.SheetNames.indexOf('Gift Data') === -1) { alert('Error: No Gift Data sheet found!'); return false; }
                    if (workbook.SheetNames.indexOf('Constituent Data') === -1) { alert('Error: No Constituent Data sheet found!'); return false; }
                }],
                ['Reading Gift Data', function() {
                    giftJson = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data']);
                    uploadedGiftCount = giftJson.length;
                    var ua = {};
                    for (var i = 0; i < giftJson.length; i++) { if (giftJson[i]['Gift Appeal']) ua[giftJson[i]['Gift Appeal']] = true; }
                    giftAppeals = Object.keys(ua).sort();
                }],
                ['Reading Constituent Data', function() {
                    constJson = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], { defval: '' });
                    uploadedConstituentCount = constJson.length;
                }],
                ['Checking Your Data', function() {
                    var valErrors = validateWorkbook(workbook, giftJson, constJson);
                    if (valErrors.length > 0) { showUploadValidationError(valErrors); return false; }
                }],
                ['Preparing Your Mapping', function() {

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
                    // Laid out like the logo card, since they are a pair: mark on the
                    // left, name and detail stacked beside it, a full bar, and a
                    // control to swap the file out.
                    clearSlowWatch();
                    showDataFileCard(file.name, (isStaffing ? solicitors.length + ' Solicitors &middot; '
                        : isSimpleFlow ? '' : giftAppeals.length + ' Appeals &middot; ')
                        + allConstituentTypeCount + ' Constituent Types &middot; ' + allGiftTypeCount + ' Gift Types');
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

                }]
            ];
            (function step(i) {
                if (i >= phases.length) return;
                say(phases[i][0] + '…');
                setRead(20 + (i / phases.length) * 80);
                // 16ms rather than 0, so the new label has actually painted before the
                // next blocking stretch begins.
                setTimeout(function() {
                    var ok;
                    try { ok = phases[i][1](); }
                    catch (err) { bail(err); return; }
                    if (ok === false) return;
                    setRead(20 + ((i + 1) / phases.length) * 80);
                    step(i + 1);
                }, 16);
            })(0);
        };
        // The read is genuinely measurable on a large file, so show it rather than
        // sitting at zero until parsing starts.
        reader.onprogress = function(e) {
            if (!e.lengthComputable) return;
            var fill = document.getElementById('mapperReadFill');
            var pct  = document.getElementById('mapperReadPct');
            var n = Math.round((e.loaded / e.total) * 20);
            if (fill) fill.style.width = n + '%';
            if (pct)  pct.textContent = n + '%';
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


    function listToSentence(items) {
        if (items.length === 1) return items[0];
        if (items.length === 2) return items[0] + ' and ' + items[1];
        return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
    }

    // Shown in the card rather than an alert: an alert has to be dismissed before
    // the form it is talking about can be reached, and it does not survive long
    // enough to read while scrolling back up.
    function showAllDoneError(message) {
        var el = document.getElementById('allDoneError');
        if (!el) { if (message) alert(message); return; }
        el.textContent = message || '';
        el.style.display = message ? 'block' : 'none';
        if (message) {
            try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        }
    }

    // ── THE MAPPER'S OWN UI ───────────────────────────────────────────────────
    // This markup used to live in a custom-code block inside each brand's GHL form,
    // which meant one copy per brand and per variant, each free to drift - the
    // theme colour in them was a hard-coded literal rather than the brand's. It is
    // rendered here instead, so there is one copy and it is version-controlled.
    //
    // Rendering is skipped when the page already carries the shell, so this file
    // works unchanged on the existing GHL-form pages and on a standalone page.
    function shellStyles() {
        return [
        '#mapper-container{--theme-color:' + themeColor + ';--theme-color-hover:' + themeColorHover + ';',
        '  font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;padding:0 20px;',
        '  color:var(--theme-color);max-width:1200px;margin:0 auto;}',
        '#mapper-container *{margin:0;padding:0;box-sizing:border-box;}',
        '#customSubmitBtn{display:none;}',

        '#mapper-container .step-progress{display:none;padding:20px;margin:20px 0;}',
        '#mapper-container .step-tracker{display:flex;flex-direction:row;justify-content:center;',
        '  align-items:flex-start;max-width:560px;margin:0 auto;}',
        '#mapper-container .step-item{display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;}',
        '#mapper-container .step-circle{width:40px;height:40px;border-radius:50%;background:#e0e0e0;',
        '  border:3px solid #e0e0e0;display:flex;align-items:center;justify-content:center;font-weight:bold;',
        '  font-size:1em;color:#999;transition:all .3s ease;z-index:2;position:relative;flex-shrink:0;}',
        '#mapper-container .step-circle.active{background:var(--theme-color);border-color:var(--theme-color);',
        '  color:#fff;box-shadow:0 2px 8px ' + themeColorShadow + ';}',
        '#mapper-container .step-circle.completed{background:var(--theme-color);border-color:var(--theme-color);color:#fff;}',
        '#mapper-container .step-label{margin-top:8px;font-size:.75em;text-align:center;color:#666;',
        '  font-weight:600;line-height:1.2;word-break:break-word;}',
        '#mapper-container .step-item.active .step-label{color:var(--theme-color);font-weight:700;}',
        '#mapper-container .step-connector{flex:1;height:3px;background:#e0e0e0;margin-top:20px;min-width:10px;}',
        '@media (max-width:500px){',
        '  #mapper-container .step-tracker{flex-direction:column;align-items:flex-start;max-width:200px;padding-left:4px;}',
        '  #mapper-container .step-item{flex-direction:row;align-items:center;flex:none;width:100%;gap:12px;padding:4px 0;}',
        '  #mapper-container .step-label{margin-top:0;text-align:left;}',
        '  #mapper-container .step-connector{width:3px;height:24px;min-width:unset;margin-top:0;margin-left:18px;flex:none;}}',

        // Both upload boxes carry .mp-upload-box, so they hover the same way: the
        // edge darkens and nothing fills. A tint on one of a matched pair was the
        // difference showing.
        '.mp-upload-box:hover{border-color:#8f8f8f;}',
        '.mp-upload-box.mp-has-file:hover{border-color:#ACACACFF;}',
        '#mapper-container .upload-section{text-align:center;padding:0;margin:0;}',
        '#mapper-container .upload-section h2{margin-top:30px;}',
        '#mapper-container .upload-section input[type="file"]{display:none;}',
        '#mapper-container .upload-btn{background:var(--theme-color);color:#fff;padding:15px 40px;font-size:1.1em;',
        '  border:none;border-radius:6px;cursor:pointer;transition:all .2s;font-weight:600;}',
        '#mapper-container .upload-btn:hover{background:var(--theme-color-hover);}',
        '#mapper-container .file-info{margin-top:15px;color:var(--theme-color);font-weight:600;}',
        '#mapper-container .upload-note{margin:10px auto 0;max-width:400px;color:#666;font-size:.9em;text-align:center;}',
        '#mapper-container .upload-note strong{font-weight:700;color:#333;}',

        '#mapper-container .category-setup{display:none;animation:mapperFadeIn .5s ease;margin-bottom:20px;padding:0;}',
        '@keyframes mapperFadeIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}',
        '#mapper-container .category-input{display:flex;gap:10px;margin-bottom:20px;}',
        '#mapper-container .category-input input{flex:1;padding:12px;border:2px solid #e0e0e0;border-radius:6px;font-size:1em;}',
        '#mapper-container .category-input button{padding:12px 25px;background:var(--theme-color);color:#fff;',
        '  border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:background .2s;}',
        '#mapper-container .category-input button:hover{background:var(--theme-color-hover);}',
        '#mapper-container .category-input button:disabled{background:#999;cursor:not-allowed;}',
        '#mapper-container .categories-list{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;}',
        '#mapper-container .category-tag{background:var(--theme-color);color:#fff;padding:8px 15px;border-radius:20px;',
        '  display:flex;align-items:center;gap:8px;font-weight:500;}',
        '#mapper-container .category-tag button{background:rgba(255,255,255,.3);border:none;color:#fff;',
        '  border-radius:50%;width:20px;height:20px;cursor:pointer;font-weight:bold;line-height:1;}',
        '#mapper-container .continue-button-wrapper{display:flex;justify-content:center;align-items:center;',
        '  gap:12px;margin-top:20px;flex-wrap:wrap;}',
        '#mapper-container .skip-btn{background:transparent;color:#999;border:2px solid #ddd;border-radius:8px;',
        '  padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;transition:color .2s,border-color .2s;}',
        '#mapper-container .skip-btn:hover{color:#666;border-color:#bbb;}',

        '#mapper-container .mapping-section,#mapper-container .spotlight-mapping-section,',
        '#mapper-container .constituent-mapping-section,#mapper-container .gift-type-mapping-section,',
        '#mapper-container .pledge-status-mapping-section,#mapper-container .appeal-category-mapping-section,',
        '#mapper-container .solicitor-selection-section{display:none;animation:mapperFadeIn .5s ease;}',

        '#mapper-container .progress-container{margin-bottom:20px;}',
        '#mapper-container .progress-bar-wrapper{background:#e0e0e0;border-radius:50px;height:30px;overflow:hidden;',
        '  margin-bottom:10px;box-shadow:inset 0 2px 4px rgba(0,0,0,.1);}',
        '#mapper-container .progress-bar-fill{height:100%;background:var(--theme-color);border-radius:50px;',
        '  transition:width .3s ease;display:flex;align-items:center;justify-content:center;color:#fff;',
        '  font-weight:600;font-size:.9em;}',
        '#mapper-container .progress-text{text-align:center;color:var(--theme-color);font-weight:600;font-size:1.1em;}',

        '#mapper-container .mapping-card{background:#f8f9fa;padding:30px;border-radius:12px;margin-bottom:20px;',
        '  border:2px solid var(--theme-color);box-shadow:0 2px 8px ' + themeColorLight + ';}',
        '#mapper-container .appeal-label{font-size:.9em;color:#666;margin-bottom:10px;text-transform:uppercase;',
        '  letter-spacing:1px;font-weight:600;}',
        '#mapper-container .appeal-name{font-size:1.8em;font-weight:700;color:#333;margin-bottom:20px;',
        '  text-align:center;padding:15px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.05);}',
        '#mapper-container .category-buttons{display:flex;justify-content:center;gap:15px;margin-top:15px;',
        '  align-items:stretch;flex-wrap:nowrap;}',
        '#mapper-container .category-buttons.allow-wrap{flex-wrap:wrap;justify-content:center;}',
        '#mapper-container .category-btn{padding:15px;font-size:1em;border:2px solid var(--theme-color);',
        '  border-radius:6px;cursor:pointer;font-weight:600;transition:all .2s ease;background:#fff;',
        '  color:var(--theme-color);flex:1 1 0;}',
        '#mapper-container .category-buttons.allow-wrap .category-btn{flex:0 1 auto;min-width:180px;max-width:200px;}',
        '#mapper-container .category-btn.non-event-btn{border-color:#999;color:#666;flex:0 0 auto;width:auto;padding:15px 30px;}',
        '#mapper-container .category-btn.non-event-btn:hover{background:#999;color:#fff;border-color:#999;}',
        '#mapper-container .category-btn:hover{background:var(--theme-color);color:#fff;transform:translateY(-2px);',
        '  box-shadow:0 4px 12px ' + themeColorShadow + ';}',
        '#mapper-container .category-btn:active{transform:translateY(0);}',

        '#mapper-container .navigation-buttons{display:flex;justify-content:space-between;margin-top:20px;gap:10px;}',
        '#mapper-container .nav-btn{padding:12px 25px;border:2px solid var(--theme-color);border-radius:6px;',
        '  cursor:pointer;font-weight:600;transition:all .2s;background:#fff;color:var(--theme-color);font-size:1em;}',
        '#mapper-container .nav-btn:hover:not(:disabled){background:var(--theme-color);color:#fff;}',
        '#mapper-container .nav-btn:disabled{opacity:.3;cursor:not-allowed;}',

        '#mapper-container .completion-card{display:none;background:#fff;color:var(--theme-color);padding:40px;',
        '  border-radius:12px;text-align:center;margin-bottom:20px;border:2px solid var(--theme-color);}',
        '#mapper-container .completion-card h2{font-size:2.5em;margin-bottom:15px;}',
        '#mapper-container .completion-card p{font-size:1.2em;color:#666;}',

        '@media (max-width:768px){',
        '  #mapper-container .category-input{flex-direction:column;}',
        '  #mapper-container .category-buttons{flex-wrap:wrap;}',
        '  #mapper-container .step-tracker{flex-direction:column;gap:20px;}',
        '  #mapper-container .step-connector{display:none;}}'
        ].join('\n');
    }

    // One mapping stage. Every flow below is the same four parts - a heading, a
    // progress bar, a completion card and a container - so they are built from one
    // description rather than six near-identical blocks of markup.
    function shellStage(o) {
        return ''
        + '<div class="' + o.cls + '" id="' + o.id + '">'
        +   '<h2 style="margin-bottom:20px;color:var(--theme-color);"' + (o.titleId ? ' id="' + o.titleId + '"' : '') + '>'
        +     (o.title || '') + '</h2>'
        +   '<div class="progress-container"><div class="progress-bar-wrapper">'
        +     '<div class="progress-bar-fill" id="' + o.bar + '" style="width:0%;">'
        +       '<span id="' + o.barText + '"></span></div></div>'
        +     '<div class="progress-text" id="' + o.text + '">0 of 0 mapped</div></div>'
        +   '<div class="completion-card" id="' + o.card + '">'
        +     '<h2>🎉 ' + o.cardTitle + '</h2>'
        +     '<p' + (o.cardTextId ? ' id="' + o.cardTextId + '"' : '') + '>' + (o.cardText || '') + '</p>'
        +     (o.cardNextId ? '<p style="margin-top:10px;" id="' + o.cardNextId + '"></p>' : '')
        +     (o.cardNote ? '<p style="margin-top:10px;">' + o.cardNote + '</p>' : '')
        +     (o.btnId ? '<div class="continue-button-wrapper" style="margin-top:20px;">'
        +                  '<button class="upload-btn" id="' + o.btnId + '">' + o.btnText + '</button></div>' : '')
        +   '</div>'
        +   '<div id="' + o.container + '"></div>'
        +   (o.skipId ? '<div id="' + o.skipWrapId + '" style="text-align:center;margin-top:16px;display:none;">'
        +                 '<button class="skip-btn" id="' + o.skipId + '">Skip Mapping</button></div>' : '')
        + '</div>';
    }

    function shellMarkup() {
        return ''
        + '<div id="mapperClientDetails"></div>'

        + '<div class="upload-section" id="uploadSection" style="text-align:left;padding:0;margin:0;">'
        +   '<h2 id="uploadTitle" style="margin-bottom:10px;margin-top:0;color:#2c3345;text-align:left;'
        +     'font-family:Inter,sans-serif;font-size:14px;font-weight:500;">Client Data File Upload</h2>'
        +   '<input type="file" id="fileInput" accept=".xlsx,.xls">'
        +   '<div id="uploadBox" class="mp-upload-box" style="' + UPLOAD_BOX_CSS + '"></div>'
        +   '<div class="file-info" id="fileInfo"></div>'
        +   '<div class="upload-note" id="uploadNote">Note: the Client Data file <strong>must</strong> use the '
        +     'designated template.<br>Click the link at the top of the page to download the template.</div>'
        + '</div>'

        + '<div class="category-setup" id="categorySetup">'
        +   '<h2 style="margin-bottom:5px;color:var(--theme-color);text-align:center;">Define Your Special Events</h2>'
        +   '<div style="text-align:center;color:#999;font-size:.85em;margin-bottom:20px;">(Maximum 3)</div>'
        +   '<div class="category-input">'
        +     '<input type="text" id="categoryInput" placeholder="Enter event name (e.g., Gala, Golf Tournament, Annual Auction)">'
        +     '<button id="addCategoryBtn">+ Add Event</button></div>'
        +   '<div class="categories-list" id="categoriesList"></div>'
        +   '<div class="continue-button-wrapper">'
        +     '<button class="upload-btn" id="startMappingBtn">Continue to Mapping ➝</button></div>'
        +   '<div id="specialEventSkipWrapper" style="text-align:center;margin-top:16px;">'
        +     '<button class="skip-btn" id="skipSpecialEventBtn">Skip Mapping</button></div>'
        + '</div>'

        + shellStage({ cls:'mapping-section', id:'mappingSection', title:'Map Gift Appeals to Events',
            bar:'progressBar', barText:'progressBarText', text:'progressText',
            card:'completionCard', cardTitle:'Step 1 Complete!',
            cardText:"You've successfully mapped all Gift Appeals to events.",
            cardNextId:'completionNextStep', btnId:'completionNextButton', btnText:'Continue ➝',
            container:'mappingContainer' })

        + shellStage({ cls:'spotlight-mapping-section', id:'spotlightMappingSection', titleId:'spotlightMappingTitle',
            bar:'spotlightProgressBar', barText:'spotlightProgressBarText', text:'spotlightProgressText',
            card:'spotlightCompletionCard', cardTitle:'Step 2 Complete!', cardTextId:'spotlightCompletionText',
            cardNote:'Click below to continue to Constituent Type mapping.',
            btnId:'startConstituentMappingBtn', btnText:'Continue to Constituent Mapping ➝',
            container:'spotlightMappingContainer', skipId:'skipSpotlightBtn', skipWrapId:'spotlightSkipWrapper' })

        + shellStage({ cls:'pledge-status-mapping-section', id:'pledgeStatusMappingSection', title:'Map Pledge Statuses',
            bar:'pledgeStatusProgressBar', barText:'pledgeStatusProgressBarText', text:'pledgeStatusProgressText',
            card:'pledgeStatusCompletionCard', cardTitle:'Pledge Status Mapping Complete!',
            cardText:"You've successfully mapped all Pledge Statuses.",
            cardNote:'Click below to continue to Constituent Type mapping.',
            btnId:'startConstituentFromPledgeBtn', btnText:'Continue to Constituent Mapping ➝',
            container:'pledgeStatusMappingContainer' })

        + shellStage({ cls:'appeal-category-mapping-section', id:'appealCategoryMappingSection', title:'Map Appeal Categories',
            bar:'appealCategoryProgressBar', barText:'appealCategoryProgressBarText', text:'appealCategoryProgressText',
            card:'appealCategoryCompletionCard', cardTitle:'Appeals Mapping Complete!',
            cardText:"You've successfully mapped all Appeal Categories.",
            cardNote:'Click below to continue to Constituent Type mapping.',
            btnId:'startConstituentFromAppealBtn', btnText:'Continue to Constituent Mapping ➝',
            container:'appealCategoryMappingContainer' })

        + '<div class="solicitor-selection-section" id="solicitorSelectionSection">'
        +   '<h2 style="margin-bottom:20px;color:var(--theme-color);">Select Solicitors</h2>'
        +   '<div id="solicitorButtonsContainer"></div>'
        +   '<div class="continue-button-wrapper">'
        +     '<button class="upload-btn" id="solicitorDoneBtn">Continue ➝</button></div>'
        + '</div>'

        + shellStage({ cls:'constituent-mapping-section', id:'constituentMappingSection', title:'Map Constituent Types',
            bar:'constituentProgressBar', barText:'constituentProgressBarText', text:'constituentProgressText',
            card:'constituentCompletionCard', cardTitle:'Constituent Mapping Complete!',
            cardText:"You've successfully mapped all Constituent Types.",
            cardNote:'Click below to continue to Gift Type mapping.',
            btnId:'startGiftTypeMappingBtn', btnText:'Continue to Gift Type Mapping ➝',
            container:'constituentMappingContainer' })

        + shellStage({ cls:'gift-type-mapping-section', id:'giftTypeMappingSection', title:'Map Gift Types',
            bar:'giftTypeProgressBar', barText:'giftTypeProgressBarText', text:'giftTypeProgressText',
            card:'giftTypeCompletionCard', cardTitle:'All Done!',
            cardText:"You've successfully mapped all Gift Types.",
            cardNote:'Your data is ready to submit.',
            container:'giftTypeMappingContainer' })

        + '<div class="step-progress" id="stepProgress"><div class="step-tracker" id="stepTracker"></div></div>'

        + '<div style="text-align:center;margin-top:20px;">'
        +   '<button type="button" id="customSubmitBtn" style="background:' + themeColor + ';color:#fff;'
        +     'padding:15px 40px;font-size:1.1em;border:none;border-radius:6px;cursor:pointer;font-weight:600;'
        +     'width:50%;margin:0 auto;display:inline-block;">Submit</button></div>';
    }

    function renderShell() {
        // The GHL-form pages already carry this markup in a custom-code block.
        // Leave them alone; only build it where it is missing.
        if (document.getElementById('uploadBox')) return false;

        var root = document.getElementById('mapper-root')
                || document.getElementById('mapper-container');
        if (!root) {
            root = document.createElement('div');
            root.id = 'mapper-container';
            document.body.appendChild(root);
        }
        root.id = 'mapper-container';

        if (!document.getElementById('mapper-shell-style')) {
            var st = document.createElement('style');
            st.id = 'mapper-shell-style';
            st.textContent = shellStyles();
            (document.head || document.documentElement).appendChild(st);
        }
        root.innerHTML = shellMarkup();
        console.log('Mapper.js: rendered its own UI shell');
        return true;
    }

    // The one card both upload boxes use, in every state they have. Everything that
    // differs between them is an argument.
    function uploadCardHtml(o) {
        var trash = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            + 'stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14">'
            + '</path></svg>';
        return ''
        + '<div class="mp-card">'
        +   '<span class="mp-card-visual">' + (o.visual || '') + '</span>'
        +   '<span class="mp-card-meta">'
        +     '<b' + (o.titleId ? ' id="' + o.titleId + '"' : '') + '></b>'
        +     '<span class="mp-card-detail"' + (o.detailId ? ' id="' + o.detailId + '"' : '') + '></span>'
        +     '<span class="mp-card-bar">'
        +       '<span class="mp-card-track"><i' + (o.fillId ? ' id="' + o.fillId + '"' : '')
        +         ' style="width:' + (o.pct || 0) + '%;"></i></span>'
        +       '<span class="mp-card-pct"' + (o.pctId ? ' id="' + o.pctId + '"' : '') + '>'
        +         (o.pct || 0) + '%</span>'
        +     '</span>'
        +   '</span>'
        // The button keeps its space even when there is nothing to remove yet, so
        // the bar does not shift sideways when the card changes state.
        +   '<button type="button" class="mp-card-clear"' + (o.clearId ? ' id="' + o.clearId + '"' : '')
        +     (o.clearable ? '' : ' hidden') + ' aria-label="' + (o.clearLabel || 'Remove') + '">'
        +     trash + '</button>'
        + '</div>';
    }

    // The icon the client-data box shows in place of a thumbnail.
    function dataFileIcon() {
        return '<svg width="86" height="86" viewBox="0 0 24 24" fill="none" stroke="' + themeColor + '" '
            + 'stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            + '<path d="M3 14h4l1.5 3h7L17 14h4"></path>'
            + '<path d="M5 14 6.8 6.4A2 2 0 0 1 8.7 5h6.6a2 2 0 0 1 1.9 1.4L19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"></path>'
            + '<circle cx="17.5" cy="7.5" r="4.6" fill="#fff"></circle>'
            + '<path d="m15.6 7.6 1.4 1.4 2.6-3"></path></svg>';
    }

    // The client-data box once a file is in, mirroring the logo card. Kept next to
    // the reset it depends on, because the two have to agree about what "empty"
    // means or the box ends up half-populated.
    function showDataFileCard(name, detail) {
        var box = document.getElementById('uploadBox');
        if (!box) return;
        box.className = (box.className.replace(/\bmp-has-file\b/g, '') + ' mp-has-file').trim();
        box.style.cursor = 'default';
        box.innerHTML = uploadCardHtml({
            visual: dataFileIcon(), pct: 100, clearable: true,
            titleId: 'mapperDataName', detailId: 'mapperDataDetail',
            clearId: 'mapperDataClear', clearLabel: 'Remove this file'
        });
        box.querySelector('#mapperDataName').textContent = name;
        box.querySelector('#mapperDataDetail').innerHTML = detail;
        box.querySelector('#mapperDataClear').addEventListener('click', function(e) {
            e.stopPropagation();
            resetDataFile();
        });
    }

    // Putting the file back means putting the whole flow back: every list derived
    // from it, every section it revealed, and the mapping choices made against it.
    // Anything left behind would be mapped against a file that is no longer there.
    function resetDataFile() {
        workbook = null;
        giftAppeals = []; constituentTypes = []; giftTypes = [];
        pledgeStatuses = []; appealCategories = []; solicitors = [];
        categories = []; mappings = {}; spotlightMappings = {}; constituentMappings = {};
        giftTypeMappings = {}; pledgeStatusMappings = {}; appealCategoryMappings = {};
        selectedSolicitors = {}; spotlightSourceData = [];
        currentIndex = 0; spotlightCurrentIndex = 0; constituentCurrentIndex = 0;
        giftTypeCurrentIndex = 0; pledgeStatusCurrentIndex = 0; appealCategoryCurrentIndex = 0;
        uploadedGiftCount = 0; uploadedConstituentCount = 0;

        ['mappingSection','spotlightMappingSection','constituentMappingSection','giftTypeMappingSection',
         'pledgeStatusMappingSection','appealCategoryMappingSection','solicitorSelectionSection',
         'categorySetup','allDoneCard','mappingBox','mappingBoxLabel','stepProgress'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        ['mappingContainer','spotlightMappingContainer','constituentMappingContainer',
         'giftTypeMappingContainer','pledgeStatusMappingContainer','appealCategoryMappingContainer',
         'categoriesList','fileInfo'].forEach(function(id) {
            var el = document.getElementById(id); if (el) el.innerHTML = '';
        });
        var csBtn = document.getElementById('customSubmitBtn');
        if (csBtn && csBtn.parentElement) csBtn.parentElement.style.display = 'none';

        var fi = document.getElementById('fileInput'); if (fi) fi.value = '';
        var note = document.getElementById('uploadNote'); if (note) note.style.display = '';
        var dl = document.getElementById('download-container'); if (dl) dl.style.display = 'flex';
        clearSlowWatch();

        var box = document.getElementById('uploadBox');
        if (box) {
            box.className = box.className.replace(/\bmp-has-file\b/g, '').trim();
            box.style.cursor = 'pointer';
            box.style.border = '1px solid #ACACACFF';
            box.innerHTML = '';
            dressUploadBox(box);
        }
    }

    // A warning tied to file size fires on a fast machine that would never have
    // needed it - the AAS file is 8.5MB and loads in about three seconds on a good
    // laptop. Tie it to the clock instead: if the read is still going after five
    // seconds it is genuinely slow here, whatever the file weighs, and that is the
    // only case worth interrupting for.
    var SLOW_READ_MS = 5000;
    var _slowTimer = null;

    function slowNoteEl(create) {
        var note = document.getElementById('mapperSlowNote');
        if (note || !create) return note;
        var box = document.getElementById('uploadBox');
        if (!box || !box.parentNode) return null;
        note = document.createElement('div');
        note.id = 'mapperSlowNote';
        // The page's own palette rather than a warning colour: this is a note about
        // timing, not a problem, and amber made it read as one.
        note.style.cssText = 'margin-top:10px;padding:10px 14px;border-radius:8px;'
            + 'background:#f8f9fa;border:1px solid #e3e7ec;border-left:3px solid ' + themeColor + ';'
            + 'color:#4b5563;font-size:0.85rem;line-height:1.45;text-align:left;';
        box.parentNode.insertBefore(note, box.nextSibling);
        return note;
    }

    function startSlowWatch() {
        clearSlowWatch();
        _slowTimer = setTimeout(function() {
            var note = slowNoteEl(true);
            if (!note) return;
            note.textContent = 'Still working — a large file can take a minute or two to '
                + 'read and prepare. Please keep this page open.';
            note.style.display = 'block';
        }, SLOW_READ_MS);
    }

    function clearSlowWatch() {
        if (_slowTimer) { clearTimeout(_slowTimer); _slowTimer = null; }
        var note = slowNoteEl(false);
        if (note) note.style.display = 'none';
    }

    // Both upload boxes are ours, so they come from one definition rather than two
    // that drift. This is the client-data box's finished appearance - the styles
    // init() applies to it and the badge icon it ends up with.
    var UPLOAD_BOX_CSS = 'border:1px solid #ACACACFF;border-radius:8px;min-height:112px;'
        + 'background:#fff;cursor:pointer;text-align:center;display:flex;flex-direction:column;'
        + 'align-items:center;justify-content:center;width:100%;box-sizing:border-box;'
        + 'transition:border-color .15s ease,background .15s ease;';

    function dressUploadBox(el) {
        if (!el || el.querySelector('.mp-upload-icon')) return;
        var kids = Array.prototype.slice.call(el.children);
        for (var k = 0; k < kids.length; k++) if (kids[k].tagName !== 'INPUT') el.removeChild(kids[k]);
        var wrap = document.createElement('div');
        wrap.className = 'mp-upload-icon';
        wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;'
            + 'padding:14px 0;pointer-events:none;';
        wrap.innerHTML = uploadIconSvg;
        el.insertBefore(wrap, el.firstChild);
    }

    // The client details, rendered and owned by mapper.js. They used to be GHL form
    // fields that this file read, restyled and fought with; nothing on the page is a
    // form control we do not own any more.
    //
    // Laid out to match the form these replace: two titled sections, bold labels,
    // an envelope in the email field and a $ in the threshold, and the month picker
    // and logo box behaving the way the originals did rather than the way the
    // browser's defaults do.
    //
    // Placement: the page marks the spot with <div id="mapperClientDetails"></div>.
    // Without it the panel goes in above the upload box.
    function clientPanelStyles() {
        return [
        '#mapperClientPanel{max-width:760px;margin:0 auto 26px;text-align:left;}',
        '#mapperClientPanel .mp-sec{font-size:17px;font-weight:600;color:#2c3345;margin:30px 0 16px;}',
        '#mapperClientPanel .mp-sec:first-child{margin-top:0;}',
        '#mapperClientPanel .mp-f{margin-bottom:16px;min-width:0;}',
        '#mapperClientPanel label{display:block;font-size:13.5px;font-weight:700;color:#2c3345;margin-bottom:6px;}',
        '#mapperClientPanel label i{color:#b0b7c2;font-style:normal;font-weight:600;}',
        '#mapperClientPanel .mp-row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}',
        '@media(max-width:560px){#mapperClientPanel .mp-row2{grid-template-columns:1fr;}}',
        '#mapperClientPanel input[type="text"],#mapperClientPanel input[type="email"],',
        '#mapperClientPanel input[type="number"],#mapperClientPanel .mp-select{',
        '  width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #d0d5dd;',
        '  border-radius:8px;font-size:14px;font-family:inherit;line-height:1.45;color:#12181f;',
        '  background:#fff;outline:none;transition:border-color .15s ease,box-shadow .15s ease;}',
        '#mapperClientPanel input::placeholder{color:#98a2b3;opacity:1;}',
        '#mapperClientPanel input:hover,#mapperClientPanel .mp-select:hover{border-color:#98a2b3;}',
        '#mapperClientPanel input:focus,#mapperClientPanel .mp-select.mp-open{',
        '  border-color:' + themeColor + ';box-shadow:0 0 0 3px ' + themeColorLight + ';}',
        // Number fields carry a spinner that crowds the text; the value is typed.
        '#mapperClientPanel input[type="number"]{-moz-appearance:textfield;}',
        '#mapperClientPanel input[type="number"]::-webkit-outer-spin-button,',
        '#mapperClientPanel input[type="number"]::-webkit-inner-spin-button{',
        '  -webkit-appearance:none;margin:0;}',

        '#mapperClientPanel .mp-holder{position:relative;}',
        '#mapperClientPanel .mp-affix{position:absolute;left:13px;top:50%;transform:translateY(-50%);',
        '  color:#98a2b3;display:flex;align-items:center;pointer-events:none;font-size:14px;}',
        '#mapperClientPanel input.mp-pad{padding-left:38px;}',

        // A dropdown of our own. A native <select> cannot colour its own option
        // highlight, so the month list lost the brand colour the original had.
        '#mapperClientPanel .mp-select{display:flex;align-items:center;justify-content:space-between;',
        '  cursor:pointer;user-select:none;}',
        '#mapperClientPanel .mp-val{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '#mapperClientPanel .mp-val.mp-ph{color:#98a2b3;}',
        '#mapperClientPanel .mp-caret{flex:none;margin-left:8px;color:#98a2b3;display:flex;}',
        '#mapperClientPanel .mp-options{position:absolute;z-index:60;left:0;right:0;top:calc(100% + 4px);',
        '  background:#fff;border:1px solid #e5e7eb;border-radius:8px;',
        '  box-shadow:0 10px 24px rgba(17,24,39,.10);max-height:220px;overflow-y:auto;display:none;}',
        '#mapperClientPanel .mp-options.mp-open{display:block;}',
        '#mapperClientPanel .mp-opt{padding:9px 14px;font-size:14px;cursor:pointer;color:#12181f;}',
        '#mapperClientPanel .mp-opt:hover,#mapperClientPanel .mp-opt.mp-hi{',
        '  background:' + themeColor + ';color:#fff;}',
        '#mapperClientPanel select.mp-hidden{position:absolute;opacity:0;pointer-events:none;height:0;width:0;}',

        // The logo box is the client-data upload box: same border, radius, height
        // and icon, so the two read as one pair of controls.
        '#mapperClientPanel #mapper-logo{display:none;}',
        '#mapperClientPanel .mp-logo-box{' + UPLOAD_BOX_CSS + '}',
        '#mapperClientPanel .mp-logo-box.mp-has-file{cursor:default;padding:8px 16px;}',
        // The client-data box sits in this section too, so its own heading becomes a
        // field label like the logo's and the two read as one pair.
        '#mapperClientPanel #uploadSection{margin:0;}',
        '#mapperClientPanel #uploadTitle{font-size:13.5px!important;font-weight:700!important;',
        '  color:#2c3345!important;margin:0 0 6px!important;font-family:inherit!important;}',
        '#mapperClientPanel .upload-note{margin-top:10px;}',
        // One card, used by both boxes and by the data box's loading state. They
        // match because they are the same markup, not because two copies agree.
        '#mapperClientPanel .mp-card{display:flex;align-items:center;gap:16px;width:100%;text-align:left;}',
        '#mapperClientPanel .mp-card-visual{flex:none;width:200px;display:flex;align-items:center;',
        '  justify-content:center;}',
        '@media(max-width:560px){#mapperClientPanel .mp-card-visual{width:104px;}}',
        '#mapperClientPanel .mp-card-meta{min-width:0;flex:1;}',
        '#mapperClientPanel .mp-card-meta b{display:block;font-size:14px;font-weight:600;color:#12181f;',
        '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '#mapperClientPanel .mp-card-detail{display:block;font-size:12.5px;color:#6b7280;min-height:17px;}',
        '#mapperClientPanel .mp-card-bar{display:flex;align-items:center;gap:9px;margin-top:8px;}',
        '#mapperClientPanel .mp-card-track{flex:1;height:5px;border-radius:3px;background:#e5e7eb;overflow:hidden;}',
        '#mapperClientPanel .mp-card-track i{display:block;height:100%;width:0;border-radius:3px;',
        '  background:' + themeColor + ';transition:width .4s ease;}',
        '#mapperClientPanel .mp-card-pct{font-size:11px;color:#6b7280;flex:none;min-width:32px;',
        '  text-align:right;font-variant-numeric:tabular-nums;}',
        '#mapperClientPanel .mp-card-clear{border:0;background:transparent;cursor:pointer;color:#9ca3af;',
        '  padding:6px;line-height:0;flex:none;}',
        '#mapperClientPanel .mp-card-clear:hover{color:#b91c1c;}',
        '#mapperClientPanel .mp-card-clear[hidden]{visibility:hidden;display:block;}',
        '#mapperClientPanel .mp-logo-card{display:flex;align-items:center;gap:14px;width:100%;text-align:left;}',
        // Height-constrained with the width left to follow. A square box letterboxes
        // a wide lockup - most logos are wider than they are tall, so the image ended
        // up sized to the width of the square and a third of its height.
        '#mapperClientPanel .mp-card-visual img{height:94px;width:auto;max-width:100%;',
        '  object-fit:contain;border-radius:4px;background:#fff;}',
        '#mapperClientPanel .mp-logo-meta{min-width:0;flex:1;}',
        '#mapperClientPanel .mp-logo-meta b{display:block;font-size:13px;font-weight:600;color:#12181f;',
        '  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '#mapperClientPanel .mp-logo-meta span{font-size:12px;color:#6b7280;}',
        '#mapperClientPanel .mp-logo-bar{display:flex;align-items:center;gap:9px;margin-top:7px;}',
        '#mapperClientPanel .mp-logo-track{flex:1;height:5px;border-radius:3px;background:#e5e7eb;overflow:hidden;}',
        '#mapperClientPanel .mp-logo-track i{display:block;height:100%;width:0;border-radius:3px;',
        '  background:' + themeColor + ';transition:width .45s ease;}',
        '#mapperClientPanel .mp-logo-pct{font-size:11px;color:#6b7280;flex:none;min-width:30px;',
        '  text-align:right;font-variant-numeric:tabular-nums;}',
        '#mapperClientPanel .mp-logo-clear{border:0;background:transparent;cursor:pointer;color:#9ca3af;',
        '  padding:6px;line-height:0;flex:none;}',
        '#mapperClientPanel .mp-logo-clear:hover{color:#b91c1c;}'
        ].join('\n');
    }

    function renderClientPanel() {
        if (document.getElementById('mapper-client-name')) return;   // already built
        var slot = document.getElementById('mapperClientDetails');
        var uploadBox = document.getElementById('uploadBox');
        if (!slot && !uploadBox) return;

        var req = ' <i>*</i>';
        var envelope = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            + 'stroke-width="1.8" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"></rect>'
            + '<path d="m2 7 10 6 10-6"></path></svg>';
        var caret = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            + 'stroke-width="2.4" aria-hidden="true"><path d="m5 8 7 8 7-8"></path></svg>';
        var months = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

        var panel = document.createElement('div');
        panel.id = 'mapperClientPanel';
        panel.innerHTML = ''
            + '<div class="mp-sec">Internal Contact Information</div>'
            + '<div class="mp-row2">'
            +   '<div class="mp-f"><label for="mapper-first-name">First Name' + req + '</label>'
            +     '<input id="mapper-first-name" type="text" placeholder="Enter First Name"></div>'
            +   '<div class="mp-f"><label for="mapper-last-name">Last Name' + req + '</label>'
            +     '<input id="mapper-last-name" type="text" placeholder="Enter Last Name"></div>'
            + '</div>'
            + '<div class="mp-f"><label for="mapper-email">Email' + req + '</label>'
            +   '<div class="mp-holder"><span class="mp-affix">' + envelope + '</span>'
            +   '<input id="mapper-email" type="email" class="mp-pad" placeholder="Enter Email"></div></div>'

            + '<div class="mp-sec">Client Information</div>'
            + '<div class="mp-f"><label for="mapper-client-name">Client Name' + req + '</label>'
            +   '<input id="mapper-client-name" type="text" placeholder="Enter Client Name"></div>'
            + '<div class="mp-row2">'
            +   '<div class="mp-f"><label for="mapper-board-members"># of Board Members</label>'
            +     '<input id="mapper-board-members" type="number" min="0" placeholder="Enter # of Board Members"></div>'
            +   '<div class="mp-f"><label id="mapper-fy-label">Fiscal Year Start Month' + req + '</label>'
            +     '<div class="mp-holder">'
            +       '<div class="mp-select" id="mapper-fy-display" tabindex="0" role="combobox"'
            +         ' aria-expanded="false" aria-haspopup="listbox" aria-labelledby="mapper-fy-label">'
            +         '<span class="mp-val mp-ph">Select Fiscal Year Start Month</span>'
            +         '<span class="mp-caret">' + caret + '</span></div>'
            +       '<div class="mp-options" id="mapper-fy-options" role="listbox">'
            +         months.map(function(m) {
                        return '<div class="mp-opt" role="option" data-v="' + m + '">' + m + '</div>'; }).join('')
            +       '</div>'
            +       '<select id="mapper-fy-start-month" class="mp-hidden" tabindex="-1" aria-hidden="true">'
            +         '<option value=""></option>'
            +         months.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('')
            +       '</select>'
            +     '</div></div>'
            + '</div>'
            + '<div class="mp-row2">'
            +   '<div class="mp-f"><label for="mapper-major-giving-threshold">Major Giving Threshold' + req + '</label>'
            +     '<div class="mp-holder"><span class="mp-affix">$</span>'
            +     '<input id="mapper-major-giving-threshold" type="number" min="1" class="mp-pad"'
            +       ' placeholder="Enter Major Giving Threshold"></div></div>'
            +   '<div></div>'
            + '</div>'
            + '<div class="mp-sec">File Uploads</div>'
            + '<div class="mp-f"><label for="mapper-logo">Client Logo File Upload</label>'
            +   '<input id="mapper-logo" type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml">'
            +   '<div class="mp-logo-box mp-upload-box" id="mapper-logo-box" role="button" tabindex="0"></div></div>';

        if (slot) slot.appendChild(panel);
        else uploadBox.parentNode.insertBefore(panel, uploadBox);

        if (!document.getElementById('mapper-panel-style')) {
            var st = document.createElement('style');
            st.id = 'mapper-panel-style';
            st.textContent = clientPanelStyles();
            (document.head || document.documentElement).appendChild(st);
        }
        // The client-data upload belongs in this section beside the logo. It is part
        // of the shell rather than the panel, so move it in rather than duplicate it.
        var section = document.getElementById('uploadSection');
        if (section) panel.appendChild(section);

        wireMonthPicker();
        wireLogoBox();
    }

    // The visible list sets a real <select>, so everything downstream keeps reading
    // one ordinary form value.
    function wireMonthPicker() {
        var display = document.getElementById('mapper-fy-display');
        var list    = document.getElementById('mapper-fy-options');
        var select  = document.getElementById('mapper-fy-start-month');
        if (!display || !list || !select) return;
        var val = display.querySelector('.mp-val');

        function close() {
            list.classList.remove('mp-open');
            display.classList.remove('mp-open');
            display.setAttribute('aria-expanded', 'false');
        }
        function open() {
            list.classList.add('mp-open');
            display.classList.add('mp-open');
            display.setAttribute('aria-expanded', 'true');
            var hi = list.querySelector('.mp-hi');
            if (hi && hi.scrollIntoView) hi.scrollIntoView({ block: 'nearest' });
        }
        function choose(month) {
            select.value = month;
            val.textContent = month;
            val.classList.remove('mp-ph');
            var opts = list.querySelectorAll('.mp-opt');
            for (var i = 0; i < opts.length; i++) {
                opts[i].classList.toggle('mp-hi', opts[i].getAttribute('data-v') === month);
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
            close();
        }

        display.addEventListener('click', function() {
            list.classList.contains('mp-open') ? close() : open();
        });
        display.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
            else if (e.key === 'Escape') close();
        });
        list.addEventListener('click', function(e) {
            var opt = e.target.closest('.mp-opt');
            if (opt) choose(opt.getAttribute('data-v'));
        });
        document.addEventListener('click', function(e) {
            if (!display.contains(e.target) && !list.contains(e.target)) close();
        });
    }

    function wireLogoBox() {
        var input = document.getElementById('mapper-logo');
        var box   = document.getElementById('mapper-logo-box');
        if (!input || !box) return;

        function reset() {
            box.innerHTML = '';
            box.classList.remove('mp-has-file');
            dressUploadBox(box);
        }
        reset();
        function show(file) {
            var size = file.size < 1048576
                ? Math.round(file.size / 1024) + ' kB'
                : (file.size / 1048576).toFixed(2) + ' MB';
            // Straight into the box: a wrapper around the card would sit between it
            // and the box's own flex layout, and the two boxes would stop matching.
            box.classList.add('mp-has-file');
            box.innerHTML = uploadCardHtml({
                visual: '<img alt="">', pct: 0, clearable: true,
                titleId: 'mapperLogoName', detailId: 'mapperLogoSize',
                fillId: 'mapperLogoFill', pctId: 'mapperLogoPct',
                clearId: 'mapperLogoClear', clearLabel: 'Remove logo'
            });
            var card = box;
            card.querySelector('#mapperLogoName').textContent = file.name;
            card.querySelector('#mapperLogoSize').textContent = size;

            // Read it here rather than at submit: the thumbnail is the confirmation
            // that the right file was picked, and the file object is already in hand.
            // The bar is the read's own progress rather than a decoration - though a
            // logo is small enough that it usually arrives in one event, so it is
            // the transition that makes the travel visible.
            var fill = card.querySelector('#mapperLogoFill');
            var pct  = card.querySelector('#mapperLogoPct');
            function setPct(n) {
                n = Math.max(0, Math.min(100, Math.round(n)));
                fill.style.width = n + '%';
                pct.textContent = n + '%';
            }
            var reader = new FileReader();
            reader.onprogress = function(e) {
                if (e.lengthComputable) setPct((e.loaded / e.total) * 100);
            };
            reader.onload = function() {
                card.querySelector('img').src = reader.result;
                setTimeout(function() { setPct(100); }, 120);
            };
            reader.onerror = function() {
                pct.textContent = 'failed';
                fill.style.background = '#b91c1c';
                setPct(100);
            };
            card.querySelector('#mapperLogoClear').addEventListener('click', function(e) {
                e.stopPropagation();
                input.value = '';
                reset();
            });


            // Start the read only once the bar is on the page and has been laid out.
            // A width set on a detached element, or in the same frame it was inserted,
            // has nothing to transition from - the bar would snap to full instead of
            // travelling, which is the whole point of showing it.
            void fill.offsetWidth;
            reader.readAsDataURL(file);
        }

        box.addEventListener('click', function(e) {
            if (e.target.closest('.mp-logo-clear') || e.target.closest('.mp-logo-card')) return;
            input.click();
        });
        box.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
        });
        input.addEventListener('change', function() {
            var f = input.files && input.files[0];
            if (f) show(f); else reset();
        });
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
            var sum = document.getElementById('allDoneSummary');
            if (sum) {
                // One line of context, so the last screen before an irreversible step
                // is not purely decorative. Counts come from the parse; if for any
                // reason they are missing, say nothing rather than "0 gifts".
                var g = uploadedGiftCount, c = uploadedConstituentCount;
                sum.textContent = (g && c)
                    ? (g.toLocaleString() + ' gifts and ' + c.toLocaleString() + ' constituents, ready to send.')
                    : 'Ready to send.';
            }
            adc.style.display = 'block';
        }
        var csBtn = document.getElementById('customSubmitBtn');
        if (csBtn) {
            // The button is near-black by default, which matches nothing else on the
            // page - every mapping button above it is already themed.
            csBtn.style.setProperty('background', themeColor, 'important');
            csBtn.style.setProperty('border-color', themeColor, 'important');
            // Move it inside the card, centred at the foot of it, so the card reads as
            // one object rather than a message with a button loose underneath. The
            // status line and the diagnostics panel both anchor to this button, so
            // they follow it in and sit inside the card too.
            if (adc && !adc.contains(csBtn)) {
                var wasIn = csBtn.parentElement;
                var holder = document.createElement('div');
                holder.id = 'allDoneSubmitHolder';
                holder.style.cssText = 'margin-top:22px;text-align:center;';
                adc.appendChild(holder);
                holder.appendChild(csBtn);
                if (wasIn && !wasIn.children.length) wasIn.style.display = 'none';
            } else if (csBtn.parentElement) {
                csBtn.parentElement.style.display = '';
            }
        }
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
                // Both come from the panel this file renders. The fallbacks that used to
                // read GHL's multiselect and its threshold input are gone, along with
                // the hard-coded field GUIDs they searched for - and so is the silent
                // default of 10,000, which could substitute a made-up threshold for the
                // client's real one without anything being said.
                var _ucFyEl = document.getElementById('mapper-fy-start-month');
                var _ucFyMonth = (_ucFyEl && _ucFyEl.value) ? _ucFyEl.value : null;
                var _ucThreshEl = document.getElementById('mapper-major-giving-threshold');
                var _ucThreshold = _ucThreshEl ? parseFloat(_ucThreshEl.value) : NaN;
                if (isNaN(_ucThreshold) || _ucThreshold <= 0) _ucThreshold = NaN;
                if (_ucFyMonth && !isNaN(_ucThreshold)) {
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
