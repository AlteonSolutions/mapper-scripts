(function() {
    'use strict';

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
            var ccRect = cc.getBoundingClientRect();
            var btnRect = clickedBtn.getBoundingClientRect();

            // Lock container height immediately to prevent ANY reflow
            cc.style.height = ccRect.height + 'px';
            cc.style.minHeight = ccRect.height + 'px';
            cc.style.overflow = 'visible';

            // Calculate translate to top-center of container
            var containerCenterX = ccRect.left + ccRect.width / 2;
            var btnCenterX = btnRect.left + btnRect.width / 2;
            var translateX = containerCenterX - btnCenterX;
            var translateY = (ccRect.top + 20 + btnRect.height / 2) - (btnRect.top + btnRect.height / 2);

            // Fade out others + animate selected simultaneously
            allBtns.forEach(function(btn) {
                if (btn !== clickedBtn) {
                    btn.style.transition = 'opacity 0.7s ease';
                    btn.style.opacity = '0';
                    btn.style.pointerEvents = 'none';
                }
            });
            clickedBtn.style.transition = 'transform 0.8s cubic-bezier(0.4,0,0.2,1)';
            setTimeout(function() {
                clickedBtn.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px)';
            }, 30);

            // After animation: shrink container height smoothly, swap to clean clone
            setTimeout(function() {
                var finalH = btnRect.height + 40;
                cc.style.transition = 'height 0.3s ease, min-height 0.3s ease';
                cc.style.height = finalH + 'px';
                cc.style.minHeight = finalH + 'px';
                cc.style.overflow = 'hidden';
                cc.innerHTML = '';
                var cleanRow = document.createElement('div');
                cleanRow.style.cssText = 'display:flex;justify-content:center;padding:20px 0;';
                var iconClone = clickedBtn.cloneNode(true);
                iconClone.style.cssText = 'pointer-events:none;flex:0 0 auto;';
                cleanRow.appendChild(iconClone);
                cc.appendChild(cleanRow);
            }, 850);
        }

        // Load iframe
        var iframeEl = document.getElementById('ghl-form-iframe');
        var newSrc = formBase
            + '?industrytype=' + encodeURIComponent(industryLabel)
            + '&industry=' + encodeURIComponent(mapperKey)
            + (isSW ? '&brand=sw' : '');
        if (iframeEl) iframeEl.src = newSrc;

        // Show form after iframe has had time to fully load
        setTimeout(function() {
            var fc = document.getElementById('form-container');
            if (fc) fc.classList.add('show');
        }, 2500);
    };

    } // end init

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
