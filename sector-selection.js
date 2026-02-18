<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Category Selection & Data Mapper</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Roboto', sans-serif;
            padding: 40px 20px;
            background-color: #f5f5f5;
        }

        .category-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 10px;
            max-height: 2000px;
            opacity: 1;
            transition: max-height 0.6s ease, opacity 0.4s ease, margin 0.6s ease, padding 0.6s ease;
        }

        .category-container.hide {
            max-height: 0;
            opacity: 0;
            margin: 0 auto;
            overflow: hidden;
            padding: 0 10px;
        }

        .category-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 32px;
            margin-bottom: 32px;
        }

        .category-btn-icon {
            width: 224px;
            height: 224px;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            padding: 0;
            background: transparent;
            flex: 0 0 224px;
        }

        .category-btn-icon:hover {
            transform: translateY(-5px);
            filter: brightness(1.1);
        }

        .category-btn-icon:active {
            transform: translateY(-2px);
        }

        .category-icon {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .category-icon img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }

        .category-label {
            display: none;
        }

        #industry-header {
            display: none;
            text-align: center;
            padding: 0;
            margin: 0 auto;
            max-width: 1000px;
        }

        #industry-header.show {
            display: block;
        }

        #industry-header img {
            width: 224px;
            height: 224px;
            object-fit: contain;
            display: block;
            margin: 0 auto;
        }

        #form-container {
            max-width: 1000px;
            margin: 20px auto 0;
            padding: 0 20px;
            visibility: hidden;
            opacity: 0;
            height: 0;
            overflow: hidden;
            transition: opacity 0.4s ease;
        }

        #form-container.show {
            visibility: visible;
            opacity: 1;
            height: auto;
            overflow: visible;
        }

        #form-container iframe {
            width: 100%;
            min-height: 1654px;
            border: none;
            border-radius: 3px;
        }

        @media (max-width: 1200px) {
            .category-btn-icon {
                width: 192px;
                height: 192px;
                flex: 0 0 192px;
            }
        }

        @media (max-width: 768px) {
            .category-row {
                flex-wrap: wrap;
                gap: 16px;
            }
            .category-btn-icon {
                width: 128px;
                height: 128px;
                flex: 0 0 128px;
            }
        }

        @media (max-width: 480px) {
            .category-btn-icon {
                width: 112px;
                height: 112px;
                flex: 0 0 112px;
            }
        }
    </style>
</head>
<body>

    <!-- SECTION 1: CATEGORY ICON BUTTONS -->
    <div class="category-container">
        <div class="category-row" id="row1"></div>
        <div class="category-row" id="row2"></div>
    </div>

    <!-- INDUSTRY HEADER IMAGE (shown after icon selection) -->
    <div id="industry-header">
        <img id="industry-header-img" src="" alt="">
    </div>

    <!-- SECTION 2: GHL FORM (hidden until icon click) -->
    <div id="form-container">
        <iframe
            src=""
            style="width:100%;height:100%;border:none;border-radius:3px"
            id="ghl-form-iframe"
            data-layout="{'id':'INLINE'}"
            data-trigger-type="alwaysShow"
            data-trigger-value=""
            data-activation-type="alwaysActivated"
            data-activation-value=""
            data-deactivation-type="neverDeactivate"
            data-deactivation-value=""
            data-form-name="Client Data Submission Form"
            data-height="1654"
            title="Client Data Submission Form"
        ></iframe>
    </div>

    <!-- GHL form embed script -->
    <script src="https://link.msgsndr.com/js/form_embed.js"></script>

    <script>
        // ── BRAND CONFIG ─────────────────────────────────────────────────────
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

        // ── INDUSTRY DEFINITIONS ──────────────────────────────────────────────
        var industries = [
            // Row 1
            { key: 'arts_culture',      mapperKey: 'arts',                label: 'Arts & Culture',      row: 1 },
            { key: 'environmental',     mapperKey: 'environmental',       label: 'Environmental',       row: 1 },
            { key: 'education',         mapperKey: 'education',           label: 'Education',           row: 1 },
            { key: 'family_foundation', mapperKey: 'communityfoundation', label: 'Community Foundation',row: 1 },
            // Row 2
            { key: 'healthcare',        mapperKey: 'healthcare',          label: 'Healthcare',          row: 2 },
            { key: 'human_services',    mapperKey: 'humanservices',       label: 'Human Services',      row: 2 },
            { key: 'religion',          mapperKey: 'religion',            label: 'Religion',            row: 2 }
        ];

        // ── BRAND DETECTION ───────────────────────────────────────────────────
        var isSW = window.location.href.includes('getdatabasey.com/sw');
        var brand = isSW ? brands.sw : brands.alford;

        // ── BUILD ICON BUTTONS ────────────────────────────────────────────────
        industries.forEach(function(ind) {
            var row = document.getElementById('row' + ind.row);
            var btn = document.createElement('button');
            btn.className = 'category-btn-icon';
            btn.type = 'button';
            btn.onclick = function() { selectIndustry(ind.key, ind.mapperKey, ind.label); };
            btn.innerHTML = '<div class="category-icon"><img src="' + brand.icons[ind.key] + '" alt="' + ind.label + '"></div>'
                          + '<div class="category-label">' + ind.label + '</div>';
            row.appendChild(btn);
        });

        // Update iframe data attributes with correct form ID
        var iframe = document.getElementById('ghl-form-iframe');
        var formBase = 'https://api.leadconnectorhq.com/widget/form/' + brand.formId;
        iframe.setAttribute('data-layout-iframe-id', 'inline-' + brand.formId);
        iframe.setAttribute('data-form-id', brand.formId);
        iframe.id = 'inline-' + brand.formId;

        // ── SELECTION HANDLER ─────────────────────────────────────────────────
        function selectIndustry(fileCategory, mapperKey, industryLabel) {
            var headerImg = document.getElementById('industry-header-img');
            var header = document.getElementById('industry-header');
            headerImg.src = brand.headers[fileCategory] || '';
            headerImg.alt = industryLabel;
            header.classList.add('show');

            var newSrc = formBase
                + '?industrytype=' + encodeURIComponent(industryLabel)
                + '&industry=' + encodeURIComponent(mapperKey)
                + (isSW ? '&brand=sw' : '');

            if (iframe.src !== newSrc) {
                iframe.src = newSrc;
            }

            document.getElementById('form-container').classList.add('show');
            document.querySelector('.category-container').classList.add('hide');
        }
    </script>

</body>
</html>
