/* APPROVED */
(function() {
    'use strict';
    var VERSION = 'v4.2';

    // ── BRAND CONFIG ─────────────────────────────────────────────────────────
    var brands = {
        alford: {
            formId: '5GIq2FyRJrWJv32C9avI',
            icons: {
                arts_culture:       'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/6978f3a89511711212fc4e39.svg',
                environmental:      'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/6978f3a8480ea4de5ac8772a.svg',
                education:          'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/6978f3a85e933b4a1f6909d9.svg',
                family_foundation:  'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69948e0fd614c9b315f2d7d1.svg',
                healthcare:         'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/6978f3a8951171bc3cfc4e3a.svg',
                human_services:     'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/6978f3a8d119a5a3fe4cc554.svg',
                religion:           'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/6978f3a8fa89c784f91527c0.svg'
            },
            headers: {
                arts_culture:       'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf114c429b831563a0b.svg',
                environmental:      'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf11afc8e28899f9864.svg',
                education:          'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf1c086659960b05414.svg',
                family_foundation:  'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf17d68773312cb2d98.svg',
                healthcare:         'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf1899b88812265c07d.svg',
                human_services:     'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf1c086655a26b05413.svg',
                religion:           'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698f7cf1899b881f8965c07c.svg'
            }
        },
        sw: {
            formId: '5GIq2FyRJrWJv32C9avI',
            icons: {
                arts_culture:       'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931b3d5f8724c61fde2.svg',
                environmental:      'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962932f02fa40f576301c2.svg',
                education:          'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931d614c91a00646632.svg',
                family_foundation:  'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931905d476dbdbf20b2.svg',
                healthcare:         'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/699629313fd420c9de4da557.svg',
                human_services:     'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931f02fa478206301b5.svg',
                religion:           'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931419632499471805b.svg'
            },
            headers: {
                arts_culture:       'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931f02fa4784e6301b4.svg',
                environmental:      'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/699629313fd4203ade4da558.svg',
                education:          'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931dde40b5a52f767d7.svg',
                family_foundation:  'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931fa6b7b23a83ffae0.svg',
                healthcare:         'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931b3d5f8b11461fde4.svg',
                human_services:     'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962931905d47e737bf20b4.svg',
                religion:           'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/69962932905d47012fbf20b8.svg'
            }
        }
    };

    // ── INDUSTRY DEFINITIONS ──────────────────────────────────────────────────
    var industries = [
        { key: 'arts_culture',      mapperKey: 'arts',                label: 'Arts & Culture',       row: 1 },
        { key: 'environmental',     mapperKey: 'environmental',       label: 'Environmental',        row: 1 },
        { key: 'education',         mapperKey: 'education',           label: 'Education',            row: 1 },
        { key: 'family_foundation', mapperKey: 'communityfoundation', label: 'Community Foundation', row: 1 },
        { key: 'healthcare',        mapperKey: 'healthcare',          label: 'Healthcare',           row: 2 },
        { key: 'human_services',    mapperKey: 'humanservices',       label: 'Human Services',       row: 2 },
        { key: 'religion',          mapperKey: 'religion',            label: 'Religion',             row: 2 }
    ];

    // ── BRAND DETECTION ───────────────────────────────────────────────────────
    var isSW = window.location.href.includes('getdatabasey.com/sw');
    var brand = isSW ? brands.sw : brands.alford;

    // ── INIT ON DOM READY ────────────────────────────────────────────────────
    function init() {

    // ── BUILD ICON BUTTONS ────────────────────────────────────────────────────
    industries.forEach(function(ind) {
        var row = document.getElementById('row' + ind.row);
        if (!row) return;
        var btn = document.createElement('button');
        btn.className = 'category-btn-icon';
        btn.type = 'button';
        btn.onclick = function() { selectIndustry(ind.key, ind.mapperKey, ind.label); };
        btn.innerHTML = '<div class="category-icon"><img src="' + brand.icons[ind.key] + '" alt="' + ind.label + '"></div>'
                      + '<div class="category-label">' + ind.label + '</div>';
        row.appendChild(btn);
    });

    // ── SET IFRAME FORM ID ────────────────────────────────────────────────────
    var iframe = document.getElementById('ghl-form-iframe');
    var formBase = 'https://api.leadconnectorhq.com/widget/form/' + brand.formId;
    if (iframe) {
        iframe.setAttribute('data-layout-iframe-id', 'inline-' + brand.formId);
        iframe.setAttribute('data-form-id', brand.formId);
        // Do NOT rename the iframe id - GHL form_embed.js needs it as-is
    }

    // ── SELECTION HANDLER ─────────────────────────────────────────────────────
    window.selectIndustry = function(fileCategory, mapperKey, industryLabel) {
        var cc = document.querySelector('.category-container');
        var allBtns = cc ? cc.querySelectorAll('.category-btn-icon') : [];

        // Find the clicked button
        var clickedBtn = null;
        allBtns.forEach(function(btn) {
            var img = btn.querySelector('img');
            if (img && img.alt === industryLabel) clickedBtn = btn;
        });

        if (clickedBtn && cc) {
            // Snapshot ALL positions before touching anything
            var ccRect = cc.getBoundingClientRect();
            var clickedRect = clickedBtn.getBoundingClientRect();
            var btnW = clickedRect.width;
            var btnH = clickedRect.height;
            // Use ccRect.width (viewport-relative) for centering, not offsetWidth
            var endX = (ccRect.width / 2) - (btnW / 2);
            var endY = 10; // GHL column has 10px top padding

            var snapshots = [];
            allBtns.forEach(function(btn) {
                var r = btn.getBoundingClientRect();
                snapshots.push({
                    btn: btn,
                    left: r.left - ccRect.left,
                    top: r.top - ccRect.top,
                    width: r.width,
                    height: r.height
                });
            });

            // 1. Lock container height first (before any absolute positioning)
            cc.style.position = 'relative';
            cc.style.height = ccRect.height + 'px';
            cc.style.minHeight = ccRect.height + 'px';
            cc.style.overflow = 'visible';

            // 2. Now freeze all buttons using snapshots
            snapshots.forEach(function(s) {
                s.btn.style.position = 'absolute';
                s.btn.style.left = s.left + 'px';
                s.btn.style.top = s.top + 'px';
                s.btn.style.width = s.width + 'px';
                s.btn.style.height = s.height + 'px';
                s.btn.style.margin = '0';
                s.btn.style.flex = 'none';
            });

            // Disable hover animation on clicked button immediately
            clickedBtn.classList.add('selected');

            // 3. Fade out all except clicked
            allBtns.forEach(function(btn) {
                if (btn !== clickedBtn) {
                    btn.style.transition = 'opacity 0.6s ease';
                    btn.style.opacity = '0';
                    btn.style.pointerEvents = 'none';
                }
            });

            // 4. After fade, animate clicked to center
            setTimeout(function() {
                clickedBtn.style.transition = 'left 1.2s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)';
                clickedBtn.style.left = endX + 'px';
                clickedBtn.style.top = endY + 'px';
            }, 700);

            // 5. After animation: measure shift, correct it, then swap to normal flow
            setTimeout(function() {
                // Get icon's current viewport position while still absolute
                var currentViewportTop = clickedBtn.getBoundingClientRect().top;

                // Do the DOM swap
                var centerRow = document.createElement('div');
                centerRow.style.cssText = 'display:flex;justify-content:center;';
                clickedBtn.style.position = '';
                clickedBtn.style.left = '';
                clickedBtn.style.top = '';
                clickedBtn.style.width = '';
                clickedBtn.style.height = '';
                clickedBtn.style.margin = '';
                clickedBtn.style.flex = '0 0 auto';
                clickedBtn.style.zIndex = '';
                clickedBtn.style.transition = 'none';
                clickedBtn.style.pointerEvents = 'none';
                centerRow.appendChild(clickedBtn);
                cc.innerHTML = '';
                cc.style.cssText = '';
                cc.appendChild(centerRow);

                // Measure where icon landed after swap
                requestAnimationFrame(function() {
                    var newViewportTop = clickedBtn.getBoundingClientRect().top;
                    var shift = newViewportTop - currentViewportTop;

                    // If there's a shift, correct it instantly by adjusting scroll position
                    if (Math.abs(shift) > 1) {
                        window.scrollBy(0, shift);
                    }

                    // Show form
                    var fc = document.getElementById('form-container');
                    if (fc) fc.classList.add('show');

                    // Scroll 1: bring selected icon to top after form appears
                    setTimeout(function() {
                        var header = document.querySelector('.sticky-section') || document.querySelector('header') || document.querySelector('nav');
                        var headerH = header ? header.offsetHeight : 0;
                        var iconTop = clickedBtn.getBoundingClientRect().top + window.pageYOffset - headerH - 20;
                        window.scrollTo({ top: iconTop, behavior: 'smooth' });
                    }, 400);

                    // Scroll 2: after file processed, bring mapper box to top
                    window.addEventListener('message', function onMapperReady(event) {
                        if (event.data && event.data.type === 'mapperBoxReady') {
                            window.removeEventListener('message', onMapperReady);
                            setTimeout(function() {
                                var iframe = document.getElementById('ghl-form-iframe');
                                if (!iframe) return;
                                var header = document.querySelector('.sticky-section') || document.querySelector('header') || document.querySelector('nav');
                                var headerH = header ? header.offsetHeight : 0;
                                // mappingBoxLabel is inside the iframe - get iframe top + element offset
                                var iframeTop = iframe.getBoundingClientRect().top + window.pageYOffset;
                                // postMessage the iframe to get the mappingBoxLabel offset
                                iframe.contentWindow.postMessage({ type: 'getMapperBoxTop' }, '*');
                            }, 200);
                        }
                    });

                    // Receive mapper box position from iframe and scroll to it
                    window.addEventListener('message', function onMapperBoxTop(event) {
                        if (event.data && event.data.type === 'mapperBoxTop') {
                            window.removeEventListener('message', onMapperBoxTop);
                            var header = document.querySelector('.sticky-section') || document.querySelector('header') || document.querySelector('nav');
                            var headerH = header ? header.offsetHeight : 0;
                            var iframe = document.getElementById('ghl-form-iframe');
                            var iframeTop = iframe ? iframe.getBoundingClientRect().top + window.pageYOffset : 0;
                            var targetY = iframeTop + event.data.offsetTop - headerH - 10;
                            window.scrollTo({ top: targetY, behavior: 'smooth' });
                        }
                    });
                });
            }, 2000);
        }

        // Load iframe
        var iframeEl = document.getElementById('ghl-form-iframe');
        var newSrc = formBase
            + '?industrytype=' + encodeURIComponent(industryLabel)
            + '&industry=' + encodeURIComponent(mapperKey)
            + (isSW ? '&brand=sw' : '');
        if (iframeEl) iframeEl.src = newSrc;


    };

        // Version badge - shows briefly on load then fades
        var badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;bottom:10px;right:10px;background:none;color:rgba(180,180,180,0.6);'
            + 'font-size:10px;padding:4px 8px;z-index:99999;line-height:1.8;text-align:right;'
            + 'opacity:1;transition:opacity 1s ease;font-family:monospace;pointer-events:none;';
        badge.innerHTML = 'sector-selection.js ' + VERSION + '<br>mapper.js v8.12';
        document.body.appendChild(badge);
        setTimeout(function() { badge.style.opacity = '0'; }, 3000);
        setTimeout(function() { document.body.removeChild(badge); }, 4000);

        // Scroll to top on page load
        window.scrollTo({ top: 0, behavior: 'instant' });

        // Scroll to bottom of mapper iframe when sections transition
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'scrollToMapperBottom') {
                var iframe = document.getElementById('ghl-form-iframe');
                if (!iframe) return;
                setTimeout(function() {
                    var iframeBottom = iframe.getBoundingClientRect().bottom + window.pageYOffset;
                    var viewH = window.innerHeight;
                    var header = document.querySelector('.sticky-section') || document.querySelector('header') || document.querySelector('nav');
                    var headerH = header ? header.offsetHeight : 0;
                    // Scroll so the bottom of the iframe is at the bottom of the viewport
                    var targetY = iframeBottom - viewH + 40;
                    window.scrollTo({ top: targetY, behavior: 'smooth' });
                }, 200);
            }
        });

    } // end init

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
