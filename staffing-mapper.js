/* APPROVED */
(function() {
    'use strict';
    var MAPPER_VERSION = 'v8.3';
    
    if (window.location.href.includes('page-builder') || 
        window.location.href.includes('/builder/') ||
        window.location.href.includes('app.gohighlevel.com/location/')) {
        console.log('Staffing Mapper: Disabled in builder/edit mode');
        return;
    }
    
    console.log('Staffing Mapper: Initializing on live page');

    var themeColor = '#00386c';
    var themeColorHover = '#004f99';
    var themeColorLight = 'rgba(0, 56, 108, 0.1)';
    var themeColorShadow = 'rgba(0, 56, 108, 0.3)';
    document.documentElement.style.setProperty('--theme-color', themeColor);
    document.documentElement.style.setProperty('--theme-color-hover', themeColorHover);
    
    var workbook = null;
    var constituentTypes = [];
    var constituentMappings = {};
    var giftTypeMappings = {};
    var constituentCurrentIndex = 0;
    var giftTypeCurrentIndex = 0;
    var constituentHasUsedPrevious = false;
    var giftTypeHasUsedPrevious = false;
    var currentStep = 0;

    var constituentCategories = [
        'Individual', 'Organization', 'Government', 'Foundation',
        'Estate', 'Family Foundation', 'Corporation'
    ];

    var giftTypeCategories = ['Cash', 'Pledge', 'Pledge Payment'];
    var giftTypes = [];

    window.addEventListener('message', function(event) {
        var data = event.data;
        // Respond with mappingBoxLabel position for outer page scroll
        if (data && data.type === 'getMapperBoxTop') {
            var el = document.getElementById('uploadTitle') || document.getElementById('mappingBoxLabel') || document.getElementById('mappingBox');
            if (el) {
                var offsetTop = el.getBoundingClientRect().top + window.pageYOffset;
                window.parent.postMessage({ type: 'mapperBoxTop', offsetTop: offsetTop }, '*');
            }
        }
    });

    function initializeStepTracker() {
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;
        var steps = [
            { label: 'Constituent Type Mapping', number: 1 },
            { label: 'Gift Type Mapping', number: 2 }
        ];
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

    function updateStepTracker(step) {
        currentStep = step;
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;
        var items = stepTracker.querySelectorAll('.step-item');
        var circles = stepTracker.querySelectorAll('.step-circle');
        for (var i = 0; i < items.length; i++) {
            if (i === step) {
                items[i].classList.add('active'); items[i].classList.remove('completed');
                circles[i].classList.add('active'); circles[i].classList.remove('completed');
                circles[i].textContent = (i+1).toString();
            } else if (i < step) {
                items[i].classList.remove('active'); items[i].classList.add('completed');
                circles[i].classList.add('completed'); circles[i].classList.remove('active');
                circles[i].textContent = '✓';
            } else {
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
                var wrapper = submitBtn.closest('.form-field-wrapper');
                if (wrapper) wrapper.style.display = 'none';
            }
            if (!allFound) setTimeout(hideGHLElements, 500);
        })();

        // uploadTitle pre-styled in HTML

        // uploadBox pre-styled in HTML - just attach click listener
        waitForElement('#uploadBox', function(el) {
            el.addEventListener('click', function() { document.getElementById('fileInput').click(); });
        });

        // uploadSection pre-styled in HTML

        // Reveal mapper-container once JS is ready, then signal parent to show iframe
        waitForElement('#mapper-container', function(mc) {
            var menuWrap = mc.closest('.menu-field-wrap');
            if (menuWrap) { menuWrap.style.paddingLeft = '0'; menuWrap.style.paddingRight = '0'; }
            mc.style.visibility = 'visible';
            // Signal parent page that mapper is ready to be shown
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'mapperReady' }, '*');
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
                var templateUrl = 'https://assets.cdn.filesafe.space/CwIkkwa8MTjmkcKkZaGX/media/699de24d52a4028ce9b402d1.xlsx';
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
        waitForElement('#startConstituentMappingBtn', function(el) { el.addEventListener('click', startConstituentMapping); });
        waitForElement('#startGiftTypeMappingBtn', function(el) { el.addEventListener('click', startGiftTypeMapping); });

        // Wrap mapping sections in a GHL-style box with label
        waitForElement('#constituentMappingSection', function(constSection) {
            var parent = constSection.parentNode;
            // Create label
            var label = document.createElement('div');
            label.id = 'mappingBoxLabel';
            label.textContent = 'Client Data File Mapping';
            label.style.cssText = 'margin-bottom:10px;margin-top:15px;color:#2c3345;text-align:left;font-family:Inter,sans-serif;font-size:14px;font-weight:500;display:none;';
            // Create wrapper box
            var box = document.createElement('div');
            box.id = 'mappingBox';
            box.style.cssText = 'border:1px solid #ccc;border-radius:4px;padding:20px;background:white;width:100%;box-sizing:border-box;display:none;';
            // Insert label and box before constituentMappingSection
            parent.insertBefore(label, constSection);
            parent.insertBefore(box, constSection);
            // Move mapping sections into the box
            var sections = ['constituentMappingSection', 'giftTypeMappingSection', 'stepProgress'];
            sections.forEach(function(id) {
                var el = document.getElementById(id);
                if (el) box.appendChild(el);
            });
        });

        waitForElement('#customSubmitBtn', function(btn) {
            btn.addEventListener('click', function() {
                // Show spinner on submit button
                var originalText = btn.textContent;
                btn.disabled = true;
                btn.innerHTML = '<div style="display:inline-flex;align-items:center;gap:10px;"><div style="width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);border-top:3px solid #ffffff;border-radius:50%;animation:mapperSpin 0.8s linear infinite;"></div><span>Submitting...</span></div>';
                // Inject spinner keyframes if not already present
                if (!document.getElementById('mapper-spinner-style')) {
                    var spinStyle = document.createElement('style');
                    spinStyle.id = 'mapper-spinner-style';
                    spinStyle.textContent = '@keyframes mapperSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
                    document.head.appendChild(spinStyle);
                }
                console.log('Submit clicked');
                setTimeout(function() {
                    var attached = window.attachToGHLForm();
                    if (!attached) {
                        btn.disabled = false;
                        btn.textContent = originalText;
                        return;
                    }
                    console.log('File attached');
                    setTimeout(function() {
                        var ghlBtn = document.querySelector('button[type="submit"]');
                        if (ghlBtn) { console.log('Clicking GHL submit'); ghlBtn.click(); }
                        else { var form = document.querySelector('form'); if (form) form.submit(); else { btn.disabled = false; btn.textContent = originalText; alert('Could not submit. Contact support.'); } }
                    }, 200);
                }, 50);
            });
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('category-btn')) {
                var appeal = e.target.getAttribute('data-appeal');
                var cat = e.target.getAttribute('data-category');
                var type = e.target.getAttribute('data-mapping-type');
                if (type === 'constituent') selectConstituentType(appeal, cat);
                else if (type === 'gifttype') selectGiftType(appeal, cat);
            } else if (e.target.classList.contains('nav-btn')) {
                var action = e.target.getAttribute('data-action');
                var navType = e.target.getAttribute('data-mapping-type');
                if (navType === 'constituent') { if (action === 'previous') previousConstituentType(); else if (action === 'next') nextConstituentType(); }
                else if (navType === 'gifttype') { if (action === 'previous') previousGiftType(); else if (action === 'next') nextGiftType(); }
            }
        });
    }

    function handleFileUpload(e) {
        var file = e.target.files[0];
        if (!file) return;

        // Show loading state
        var uploadBox = document.getElementById('uploadBox');
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
                var constJson = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], { defval: '' });
                var uc = {};
                for (var j = 0; j < constJson.length; j++) { var ct = (constJson[j]['Constituent Type'] || '').toString().trim(); if (ct) uc[ct] = true; }
                constituentTypes = Object.keys(uc).sort();
                var ug = {};
                for (var g = 0; g < giftJson.length; g++) { if (giftJson[g]['Gift Type']) ug[giftJson[g]['Gift Type']] = true; }
                giftTypes = Object.keys(ug).sort();
                initializeStepTracker(); updateStepTracker(0);
                // Update upload box to show file info like GHL style
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.innerHTML = '<svg width="1em" height="2em" viewBox="0 0 16 16" class="bi bi-upload" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:5px auto;width:30px;color:#000000;"><path fill-rule="evenodd" d="M.5 8a.5.5 0 0 1 .5.5V12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5a.5.5 0 0 1 1 0V12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V8.5A.5.5 0 0 1 .5 8zM5 4.854a.5.5 0 0 0 .707 0L8 2.56l2.293 2.293A.5.5 0 1 0 11 4.146L8.354 1.5a.5.5 0 0 0-.708 0L5 4.146a.5.5 0 0 0 0 .708z"></path><path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0v-8A.5.5 0 0 1 8 2z"></path></svg>'
                    + '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 0 0 0;border-top:1px solid #eee;margin-top:8px;">'
                    + '<div style="text-align:left;font-size:13px;color:#333;">✓ ' + file.name + '</div>'
                    + '<div style="text-align:center;font-size:12px;color:#666;">' + constituentTypes.length + ' Constituent Types &middot; ' + giftTypes.length + ' Gift Types</div>'
                    + '</div>';
                document.getElementById('fileInfo').innerHTML = '';
                var mb = document.getElementById('mappingBox'); if (mb) mb.style.display = 'block';
                var ml = document.getElementById('mappingBoxLabel'); if (ml) ml.style.display = 'block';
                // Notify outer shell page to scroll mappingBox into view
                window.parent.postMessage({ type: 'mapperBoxReady' }, '*');

            } catch (err) {
                // Reset upload box on error
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.style.cursor = 'pointer';
                uploadBox.innerHTML = '<svg width="1em" height="2em" viewBox="0 0 16 16" class="bi bi-upload" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:5px auto;width:30px;color:#000000;"><path fill-rule="evenodd" d="M.5 8a.5.5 0 0 1 .5.5V12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5a.5.5 0 0 1 1 0V12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V8.5A.5.5 0 0 1 .5 8zM5 4.854a.5.5 0 0 0 .707 0L8 2.56l2.293 2.293A.5.5 0 1 0 11 4.146L8.354 1.5a.5.5 0 0 0-.708 0L5 4.146a.5.5 0 0 0 0 .708z"></path><path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0v-8A.5.5 0 0 1 8 2z"></path></svg>';
                var dn = document.getElementById('uploadNote'); if (dn) dn.style.display = '';
                var dd = document.getElementById('download-container'); if (dd) dd.style.display = '';
                alert('Error reading file: ' + err.message);
            }
            }, 50);
        };
        reader.readAsArrayBuffer(file);
    }

    function startConstituentMapping() {
        updateStepTracker(0); constituentCurrentIndex = 0; constituentHasUsedPrevious = false;
        document.getElementById('constituentMappingSection').style.display = 'block'; showCurrentConstituentType(); updateConstituentProgress();
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentConstituentType() {
        var container = document.getElementById('constituentMappingContainer');
        if (constituentCurrentIndex >= constituentTypes.length) { container.innerHTML = ''; updateStepTracker(1); document.getElementById('constituentCompletionCard').style.display = 'block'; document.querySelector('#constituentMappingSection .progress-container').style.display = 'none'; document.querySelector('#constituentMappingSection h2').style.display = 'none'; return; }
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


    function startGiftTypeMapping() {
        updateStepTracker(1); giftTypeCurrentIndex = 0; giftTypeHasUsedPrevious = false;
        document.getElementById('giftTypeMappingSection').style.display = 'block'; showCurrentGiftType(); updateGiftTypeProgress();
        document.getElementById('constituentMappingSection').style.display = 'none';
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentGiftType() {
        var container = document.getElementById('giftTypeMappingContainer');
        if (giftTypeCurrentIndex >= giftTypes.length) {
            container.innerHTML = '';
            updateStepTracker(1);
            document.getElementById('giftTypeCompletionCard').style.display = 'block';
            document.querySelector('#giftTypeMappingSection .progress-container').style.display = 'none';
            document.querySelector('#giftTypeMappingSection h2').style.display = 'none';
            var csBtn = document.getElementById('customSubmitBtn'); if (csBtn && csBtn.parentElement) csBtn.parentElement.style.display = '';
            return;
        }
        var gt = giftTypes[giftTypeCurrentIndex]; var cm = giftTypeMappings[gt] || null;
        var html = '<div class="mapping-card"><div class="appeal-label">Gift Type ' + (giftTypeCurrentIndex+1) + ' of ' + giftTypes.length + '</div><div class="appeal-name">' + gt + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select a gift type:</div><div class="category-buttons">';
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
        var constituentOk = Object.keys(constituentMappings).length > 0;
        var giftTypeOk = Object.keys(giftTypeMappings).length > 0;
        console.log('generateExcelBlob check:', {constituentOk: constituentOk, giftTypeOk: giftTypeOk});
        if (!constituentOk || !giftTypeOk) return null;

        var gd = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data'], { defval: '' });

        // Apply gift type mappings - replace Gift Type values in Gift Data
        for (var gt = 0; gt < gd.length; gt++) { var ogt = gd[gt]['Gift Type']; if (ogt !== undefined) { var mgt = giftTypeMappings[ogt]; gd[gt]['Gift Type'] = (mgt === 'Skip' || mgt === undefined) ? ogt : mgt; } }

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
            } else if (ot !== '') {
                unmatchedTypes[ot] = true;
                // keep original
            }
        }
        if (Object.keys(unmatchedTypes).length > 0) console.warn('Unmatched constituent types:', Object.keys(unmatchedTypes));

        var giftHeaders = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data'], {header: 1})[0] || [];
        var origConstHeaders = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], {header: 1})[0] || [];

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gd, {header: giftHeaders}), 'Gift Data');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cd2, {header: origConstHeaders}), 'Constituent Data');
        for (var q = 0; q < workbook.SheetNames.length; q++) { var sn = workbook.SheetNames[q]; if (sn !== 'Gift Data' && sn !== 'Constituent Data' && sn !== 'Instructions') XLSX.utils.book_append_sheet(wb, workbook.Sheets[sn], sn); }

        return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    window.attachToGHLForm = function() {
        var blob = generateExcelBlob();
        if (!blob) { alert('Please complete all mapping steps before submitting'); return false; }
        var file = new File([blob], 'Gift_Data_with_Events.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var fi = document.querySelector('input[type="file"][name="  Client Data File"]') || document.querySelector('input[type="file"][name*="Client Data File"]') || document.querySelector('input[type="file"][name*="e874762e"]') || document.querySelector('#el_5GIq2FyRJrWJv32C9avI_btJHfCz265PqHT9D7m9S_13 input[type="file"]');
        if (fi) { var dt = new DataTransfer(); dt.items.add(file); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        else { alert('Could not attach file. Please contact support.'); return false; }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
