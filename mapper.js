(function() {
    'use strict';
    
    if (window.location.href.includes('page-builder') || 
        window.location.href.includes('/builder/') ||
        window.location.href.includes('app.gohighlevel.com/location/')) {
        console.log('Mapper.js: Disabled in builder/edit mode');
        return;
    }
    
    console.log('Mapper.js: Initializing on live page');
    
    var workbook = null;
    var giftAppeals = [];
    var constituentTypes = [];
    var spotlightSourceData = [];
    var categories = [];
    var mappings = {};
    var spotlightMappings = {};
    var constituentMappings = {};
    var currentIndex = 0;
    var spotlightCurrentIndex = 0;
    var constituentCurrentIndex = 0;
    var hasUsedPrevious = false;
    var spotlightHasUsedPrevious = false;
    var constituentHasUsedPrevious = false;
    var currentStep = 0;
    var selectedIndustryType = null;

    var constituentCategories = [
        'Individual', 'Organization', 'Government', 'Foundation',
        'Estate', 'Family Foundation', 'Corporation'
    ];

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

    window.addEventListener('message', function(event) {
        var data = event.data;
        if (data && data.type === 'setIndustryType' && data.value) {
            console.log('Received industry via postMessage:', data.value);
            selectedIndustryType = data.value;
            setIndustryTypeField(data.value);
        }
    });

    function setSpotlightConfig(industry) {
        if (industry === 'arts') {
            spotlightConfig = { type: 'giftAppeal', title: 'Map Gift Appeals to Spotlights', categories: ['Tickets', 'Season Ticket Holders', 'Skip'], completionText: 'You have successfully mapped all Gift Appeals to spotlight categories.' };
        } else if (industry === 'education') {
            spotlightConfig = { type: 'giftAppeal', title: 'Map Gift Appeals to Spotlights', categories: ['Alumni', 'Parent & Grandparent', 'Skip'], completionText: 'You have successfully mapped all Gift Appeals to spotlight categories.' };
        } else if (industry === 'communityfoundation') {
            spotlightConfig = { type: 'constituentType', title: 'Map Constituent Types to Spotlights', categories: ['Donor', 'Fundholder', 'Skip'], completionText: 'You have successfully mapped all Constituent Types to spotlight categories.' };
        } else if (industry === 'healthcare') {
            spotlightConfig = { type: 'constituentType', title: 'Map Constituent Types to Spotlights', categories: ['Patient', 'Physician', 'Skip'], completionText: 'You have successfully mapped all Constituent Types to spotlight categories.' };
        }
        if (spotlightConfig) console.log('✓ Spotlight config:', spotlightConfig.type, spotlightConfig.categories);
        else console.log('No spotlight config for:', industry);
    }

    function initializeStepTracker() {
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;
        var steps = spotlightConfig ?
            [{ label: 'Special Event Mapping', number: 1 }, { label: 'Spotlight Mapping', number: 2 }, { label: 'Constituent Type Mapping', number: 3 }] :
            [{ label: 'Special Event Mapping', number: 1 }, { label: 'Constituent Type Mapping', number: 2 }];
        var html = '';
        for (var i = 0; i < steps.length; i++) {
            html += '<div class="step-item"><div class="step-circle">' + steps[i].number + '</div><div class="step-label">' + steps[i].label + '</div>';
            if (i < steps.length - 1) html += '<div class="step-connector"></div>';
            html += '</div>';
        }
        stepTracker.innerHTML = html;
        document.getElementById('stepProgress').style.display = 'block';
    }

    function updateStepTracker(step) {
        currentStep = step;
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;
        var items = stepTracker.querySelectorAll('.step-item');
        var circles = stepTracker.querySelectorAll('.step-circle');
        var connectors = stepTracker.querySelectorAll('.step-connector');
        for (var i = 0; i < items.length; i++) {
            if (i === step) { items[i].classList.add('active'); circles[i].classList.add('active'); circles[i].classList.remove('completed'); circles[i].textContent = (i+1).toString(); }
            else if (i < step) { items[i].classList.remove('active'); circles[i].classList.add('completed'); circles[i].classList.remove('active'); circles[i].textContent = '✓'; }
            else { items[i].classList.remove('active'); circles[i].classList.remove('active','completed'); circles[i].textContent = (i+1).toString(); }
        }
        for (var j = 0; j < connectors.length; j++) {
            if (j < step) connectors[j].classList.add('completed');
            else connectors[j].classList.remove('completed');
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
            setSpotlightConfig(detected);
        }

        waitForElement('#uploadBox', function(el) { el.addEventListener('click', function() { document.getElementById('fileInput').click(); }); });
        waitForElement('#fileInput', function(el) { el.addEventListener('change', handleFileUpload); });

        // Create Download Template button between title and upload box
        waitForElement('#uploadTitle', function(titleEl) {
            var downloadContainer = document.createElement('div');
            downloadContainer.id = 'download-container';
            downloadContainer.style.textAlign = 'center';
            downloadContainer.style.marginBottom = '20px';
            var downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download Template File';
            downloadBtn.style.cssText = 'background:#2c5f5d;color:white;padding:12px 30px;font-size:1em;border:none;border-radius:6px;cursor:pointer;font-weight:600;transition:all 0.2s;';
            downloadBtn.onmouseover = function() { this.style.background = '#3d7672'; };
            downloadBtn.onmouseout = function() { this.style.background = '#2c5f5d'; };
            downloadBtn.addEventListener('click', function() {
                var link = document.createElement('a');
                link.href = 'https://storage.googleapis.com/msgsndr/CwIkkwa8MTjmkcKkZaGX/media/698b536eca717c30ebb62e3d.xlsx';
                link.download = 'Analytics Data Upload Template.xlsx';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
            downloadContainer.appendChild(downloadBtn);
            titleEl.parentNode.insertBefore(downloadContainer, titleEl.nextSibling);
        });
        waitForElement('#categoryInput', function(el) { el.addEventListener('keypress', function(e) { if (e.key === 'Enter') addCategory(); }); });
        waitForElement('#addCategoryBtn', function(el) { el.addEventListener('click', addCategory); });
        waitForElement('#startMappingBtn', function(el) { el.addEventListener('click', startMapping); });
        waitForElement('#startConstituentMappingBtn', function(el) { el.addEventListener('click', startConstituentMapping); });
        waitForElement('#categoriesList', function(el) { el.addEventListener('click', function(e) { if (e.target.tagName === 'BUTTON') removeCategory(parseInt(e.target.getAttribute('data-index'))); }); });

        waitForElement('#customSubmitBtn', function(btn) {
            btn.addEventListener('click', function() {
                console.log('Submit clicked');
                var attached = window.attachToGHLForm();
                if (!attached) return;
                console.log('File attached');
                if (selectedIndustryType) setIndustryTypeField(selectedIndustryType);
                setTimeout(function() {
                    var ghlBtn = document.querySelector('button[type="submit"]');
                    if (ghlBtn) { console.log('Clicking GHL submit'); ghlBtn.click(); }
                    else { var form = document.querySelector('form'); if (form) form.submit(); else alert('Could not submit. Contact support.'); }
                }, 200);
            });
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('category-btn')) {
                var appeal = e.target.getAttribute('data-appeal');
                var cat = e.target.getAttribute('data-category');
                var type = e.target.getAttribute('data-mapping-type');
                if (type === 'event') selectCategory(appeal, cat);
                else if (type === 'spotlight') selectSpotlight(appeal, cat);
                else if (type === 'constituent') selectConstituentType(appeal, cat);
            } else if (e.target.classList.contains('nav-btn')) {
                var action = e.target.getAttribute('data-action');
                var navType = e.target.getAttribute('data-mapping-type');
                if (navType === 'event') { if (action === 'previous') previousAppeal(); else if (action === 'next') nextAppeal(); }
                else if (navType === 'spotlight') { if (action === 'previous') previousSpotlight(); else if (action === 'next') nextSpotlight(); }
                else if (navType === 'constituent') { if (action === 'previous') previousConstituentType(); else if (action === 'next') nextConstituentType(); }
            }
        });
    }

    function handleFileUpload(e) {
        var file = e.target.files[0];
        if (!file) return;
        var detected = detectIndustry();
        if (detected) { setSpotlightConfig(detected); var lbl = industryDisplayLabels[detected]; if (lbl) { selectedIndustryType = lbl; setIndustryTypeField(lbl); } }
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, {type: 'array'});
                if (workbook.SheetNames.indexOf('Gift Data') === -1) { alert('Error: No Gift Data sheet found!'); return; }
                if (workbook.SheetNames.indexOf('Constituent Data') === -1) { alert('Error: No Constituent Data sheet found!'); return; }
                var giftJson = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data']);
                var ua = {};
                for (var i = 0; i < giftJson.length; i++) { if (giftJson[i]['Gift Appeal']) ua[giftJson[i]['Gift Appeal']] = true; }
                giftAppeals = Object.keys(ua).sort();
                var constJson = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data']);
                var uc = {};
                for (var j = 0; j < constJson.length; j++) { if (constJson[j]['Constituent Type']) uc[constJson[j]['Constituent Type']] = true; }
                constituentTypes = Object.keys(uc).sort();
                if (spotlightConfig) {
                    if (spotlightConfig.type === 'giftAppeal') spotlightSourceData = giftAppeals.slice();
                    else if (spotlightConfig.type === 'constituentType') spotlightSourceData = constituentTypes.slice();
                }
                initializeStepTracker(); updateStepTracker(0);
                document.getElementById('uploadBox').style.display = 'none';
                var t = document.getElementById('uploadTitle'); if (t) t.style.display = 'none';
                var n = document.getElementById('uploadNote'); if (n) n.style.display = 'none';
                var d = document.getElementById('download-container'); if (d) d.style.display = 'none';
                document.getElementById('fileInfo').innerHTML = '<div style="text-align:center;margin-bottom:25px;"><div style="margin-bottom:3px;">✅ File uploaded: <strong>' + file.name + '</strong></div><div style="margin-bottom:3px;">' + giftAppeals.length + ' unique Gift Appeals found</div><div>' + constituentTypes.length + ' unique Constituent Types found</div></div>';
                document.getElementById('categorySetup').style.display = 'block';
                setTimeout(function() { document.getElementById('categorySetup').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
            } catch (err) { alert('Error reading file: ' + err.message); }
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
        updateStepTracker(0); currentIndex = 0; hasUsedPrevious = false;
        if (spotlightConfig) { document.getElementById('completionNextStep').textContent = 'Click below to continue to spotlight mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Spotlight Mapping ➝'; document.getElementById('completionNextButton').onclick = startSpotlightMapping; }
        else { document.getElementById('completionNextStep').textContent = 'Click below to continue to Constituent Type mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Constituent Mapping ➝'; document.getElementById('completionNextButton').onclick = startConstituentMapping; }
        document.getElementById('mappingSection').style.display = 'block'; showCurrentAppeal(); updateProgress();
        document.getElementById('uploadSection').style.display = 'none'; document.getElementById('categorySetup').style.display = 'none';
        setTimeout(function() { var s = document.getElementById('mappingSection'); window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - 20, behavior: 'smooth' }); }, 50);
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
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { if (cm === 'Skip') { btns[j].style.background = '#999'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#999'; } else { btns[j].style.background = '#2c5f5d'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#2c5f5d'; } } } }
        var nb = container.querySelector('#nextBtn'); if (nb && hasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectCategory(appeal, category) {
        mappings[appeal] = category; updateProgress();
        var btns = document.querySelectorAll('#mappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { var bc = btns[i].getAttribute('data-category'); if (bc === category) { if (category === 'Skip') { btns[i].style.background = '#999'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = '#2c5f5d'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#2c5f5d'; } } else { if (btns[i].classList.contains('non-event-btn')) { btns[i].style.background = 'white'; btns[i].style.color = '#666'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = 'white'; btns[i].style.color = '#2c5f5d'; btns[i].style.borderColor = '#2c5f5d'; } } }
        var nb = document.querySelector('#nextBtn'); if (nb && hasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!hasUsedPrevious) nextAppeal(); }, 500);
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
        updateStepTracker(1); spotlightCurrentIndex = 0; spotlightHasUsedPrevious = false;
        document.getElementById('spotlightMappingTitle').textContent = spotlightConfig.title;
        document.getElementById('spotlightCompletionText').textContent = spotlightConfig.completionText;
        document.getElementById('spotlightMappingSection').style.display = 'block'; showCurrentSpotlight(); updateSpotlightProgress();
        document.getElementById('mappingSection').style.display = 'none';
        setTimeout(function() { var s = document.getElementById('spotlightMappingSection'); window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - 20, behavior: 'smooth' }); }, 50);
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
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { if (cm === 'Skip') { btns[j].style.background = '#999'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#999'; } else { btns[j].style.background = '#2c5f5d'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#2c5f5d'; } } } }
        var nb = container.querySelector('#spotlightNextBtn'); if (nb && spotlightHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectSpotlight(sv, category) {
        spotlightMappings[sv] = category; updateSpotlightProgress();
        var btns = document.querySelectorAll('#spotlightMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { var bc = btns[i].getAttribute('data-category'); if (bc === category) { if (category === 'Skip') { btns[i].style.background = '#999'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = '#2c5f5d'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#2c5f5d'; } } else { if (btns[i].classList.contains('non-event-btn')) { btns[i].style.background = 'white'; btns[i].style.color = '#666'; btns[i].style.borderColor = '#999'; } else { btns[i].style.background = 'white'; btns[i].style.color = '#2c5f5d'; btns[i].style.borderColor = '#2c5f5d'; } } }
        var nb = document.querySelector('#spotlightNextBtn'); if (nb && spotlightHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!spotlightHasUsedPrevious) nextSpotlight(); }, 500);
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

    function startConstituentMapping() {
        updateStepTracker(spotlightConfig ? 2 : 1); constituentCurrentIndex = 0; constituentHasUsedPrevious = false;
        document.getElementById('constituentMappingSection').style.display = 'block'; showCurrentConstituentType(); updateConstituentProgress();
        document.getElementById('mappingSection').style.display = 'none'; document.getElementById('spotlightMappingSection').style.display = 'none';
        setTimeout(function() { var s = document.getElementById('constituentMappingSection'); window.scrollTo({ top: s.getBoundingClientRect().top + window.pageYOffset - 20, behavior: 'smooth' }); }, 50);
    }

    function showCurrentConstituentType() {
        var container = document.getElementById('constituentMappingContainer');
        if (constituentCurrentIndex >= constituentTypes.length) { container.innerHTML = ''; updateStepTracker(spotlightConfig ? 3 : 2); document.getElementById('constituentCompletionCard').style.display = 'block'; document.querySelector('#constituentMappingSection .progress-container').style.display = 'none'; document.querySelector('#constituentMappingSection h2').style.display = 'none'; return; }
        var ct = constituentTypes[constituentCurrentIndex]; var cm = constituentMappings[ct] || null;
        var html = '<div class="mapping-card"><div class="appeal-label">Constituent Type ' + (constituentCurrentIndex+1) + ' of ' + constituentTypes.length + '</div><div class="appeal-name">' + ct + '</div><div style="text-align:center;margin-bottom:15px;color:#666;font-weight:600;">Select a constituent type:</div><div class="category-buttons allow-wrap">';
        for (var i = 0; i < constituentCategories.length; i++) html += '<button class="category-btn" data-appeal="' + ct + '" data-category="' + constituentCategories[i] + '" data-mapping-type="constituent">' + constituentCategories[i] + '</button>';
        html += '</div><div class="navigation-buttons"><button class="nav-btn" data-action="previous" data-mapping-type="constituent"' + (constituentCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button><button class="nav-btn" id="constituentNextBtn" data-action="next" data-mapping-type="constituent"' + (!cm ? ' disabled' : '') + ' style="display:none;">Next →</button></div></div>';
        container.innerHTML = html;
        if (cm) { var btns = container.querySelectorAll('.category-btn'); for (var j = 0; j < btns.length; j++) { if (btns[j].getAttribute('data-category') === cm) { btns[j].style.background = '#2c5f5d'; btns[j].style.color = 'white'; btns[j].style.borderColor = '#2c5f5d'; } } }
        var nb = container.querySelector('#constituentNextBtn'); if (nb && constituentHasUsedPrevious && cm) nb.style.display = 'block';
    }

    function selectConstituentType(origType, mappedType) {
        constituentMappings[origType] = mappedType; updateConstituentProgress();
        var btns = document.querySelectorAll('#constituentMappingContainer .category-btn');
        for (var i = 0; i < btns.length; i++) { if (btns[i].getAttribute('data-category') === mappedType) { btns[i].style.background = '#2c5f5d'; btns[i].style.color = 'white'; btns[i].style.borderColor = '#2c5f5d'; } else { btns[i].style.background = 'white'; btns[i].style.color = '#2c5f5d'; btns[i].style.borderColor = '#2c5f5d'; } }
        var nb = document.querySelector('#constituentNextBtn'); if (nb && constituentHasUsedPrevious) { nb.disabled = false; nb.style.display = 'block'; }
        setTimeout(function() { if (!constituentHasUsedPrevious) nextConstituentType(); }, 500);
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

    function generateExcelBlob() {
        var req = spotlightConfig ? 3 : 2;
        var c1 = Object.keys(mappings).length > 0 ? 1 : 0;
        var c2 = spotlightConfig ? (Object.keys(spotlightMappings).length > 0 ? 1 : 0) : 0;
        var c3 = Object.keys(constituentMappings).length > 0 ? 1 : 0;
        if ((c1 + c2 + c3) < req) return null;

        var gd = XLSX.utils.sheet_to_json(workbook.Sheets['Gift Data']);
        for (var i = 0; i < gd.length; i++) { gd[i]['Event'] = mappings[gd[i]['Gift Appeal']] || 'Unmapped'; delete gd[i]['Gift Appeal']; }

        if (spotlightConfig && Object.keys(spotlightMappings).length > 0) {
            if (spotlightConfig.type === 'giftAppeal') {
                for (var j = 0; j < gd.length; j++) { var ev = gd[j]['Event']; var ap = null; for (var k in mappings) { if (mappings.hasOwnProperty(k) && mappings[k] === ev) { ap = k; break; } } gd[j]['Spotlights'] = spotlightMappings[ap] || 'Unmapped'; }
            } else if (spotlightConfig.type === 'constituentType') {
                var cd = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data']);
                var csm = {}; for (var m = 0; m < cd.length; m++) csm[cd[m]['Constituent ID']] = spotlightMappings[cd[m]['Constituent Type']] || 'Unmapped';
                for (var n = 0; n < gd.length; n++) gd[n]['Spotlights'] = csm[gd[n]['Constituent ID']] || 'Unmapped';
            }
        }

        var cd2 = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data']);
        for (var p = 0; p < cd2.length; p++) { var ot = cd2[p]['Constituent Type']; cd2[p]['Constituent Type'] = constituentMappings[ot] || ot; }

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gd), 'Gift Data');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cd2), 'Constituent Data');
        for (var q = 0; q < workbook.SheetNames.length; q++) { var sn = workbook.SheetNames[q]; if (sn !== 'Gift Data' && sn !== 'Constituent Data' && sn !== 'Instructions') XLSX.utils.book_append_sheet(wb, workbook.Sheets[sn], sn); }

        return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    window.attachToGHLForm = function() {
        var blob = generateExcelBlob();
        if (!blob) { alert('Please complete all ' + (spotlightConfig ? 'three' : 'two') + ' mapping steps before submitting'); return false; }
        var file = new File([blob], 'Gift_Data_with_Events.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var fi = document.querySelector('input[type="file"][name*="e874762e"]') || document.querySelector('input[type="file"].file-input') || document.querySelector('input.file-input[type="file"]') || document.querySelector('input[type="file"]');
        if (fi) { var dt = new DataTransfer(); dt.items.add(file); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        else { alert('Could not attach file. Please contact support.'); return false; }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
