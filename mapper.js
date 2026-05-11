/* APPROVED */
(function() {
    'use strict';
    var MAPPER_VERSION = '5.11.2026 10:55';
    
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
    var isStaffing = _urlParams.get('variant') === 'staffing';
    var isDevelopmentAssessment = _urlParams.get('variant') === 'developmentassessment';
    var isCampaignCounsel = _urlParams.get('variant') === 'campaigncounsel';
    var isSimpleFlow = isStaffing || isDevelopmentAssessment || isCampaignCounsel;
    var themeColor = isSW ? '#00386c' : '#2c5f5d';
    var themeColorHover = isSW ? '#004f99' : '#3d7672';
    var themeColorLight = isSW ? 'rgba(0, 56, 108, 0.1)' : 'rgba(44, 95, 93, 0.1)';
    var themeColorShadow = isSW ? 'rgba(0, 56, 108, 0.3)' : 'rgba(44, 95, 93, 0.3)';
    console.log('Mapper.js: Theme =', isSW ? 'SW (#00386c)' : 'Default (#2c5f5d)');

    // Apply theme to CSS variables so static CSS in HTML also picks up the color
    if (isSW) {
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
        var steps;
        if (isSimpleFlow) {
            if (isStaffing && solicitors.length > 0)
                steps = constituentMappingSkipped ?
                    [{ label: 'Solicitor Selection', number: 1 }, { label: 'Gift Type Mapping', number: 2 }] :
                    [{ label: 'Solicitor Selection', number: 1 }, { label: 'Constituent Type Mapping', number: 2 }, { label: 'Gift Type Mapping', number: 3 }];
            else if (isDevelopmentAssessment && appealCategories.length > 0)
                steps = constituentMappingSkipped ?
                    [{ label: 'Appeals Category Mapping', number: 1 }, { label: 'Gift Type Mapping', number: 2 }] :
                    [{ label: 'Appeals Category Mapping', number: 1 }, { label: 'Constituent Type Mapping', number: 2 }, { label: 'Gift Type Mapping', number: 3 }];
            else if (isCampaignCounsel && pledgeStatuses.length > 0)
                steps = constituentMappingSkipped ?
                    [{ label: 'Pledge Status Mapping', number: 1 }, { label: 'Gift Type Mapping', number: 2 }] :
                    [{ label: 'Pledge Status Mapping', number: 1 }, { label: 'Constituent Type Mapping', number: 2 }, { label: 'Gift Type Mapping', number: 3 }];
            else
                steps = constituentMappingSkipped ?
                    [{ label: 'Gift Type Mapping', number: 1 }] :
                    [{ label: 'Constituent Type Mapping', number: 1 }, { label: 'Gift Type Mapping', number: 2 }];
        } else {
            steps = spotlightConfig ?
                (constituentMappingSkipped ?
                    [{ label: 'Special Event Mapping', number: 1 }, { label: 'Spotlight Mapping', number: 2 }, { label: 'Gift Type Mapping', number: 3 }] :
                    [{ label: 'Special Event Mapping', number: 1 }, { label: 'Spotlight Mapping', number: 2 }, { label: 'Constituent Type Mapping', number: 3 }, { label: 'Gift Type Mapping', number: 4 }]) :
                (constituentMappingSkipped ?
                    [{ label: 'Special Event Mapping', number: 1 }, { label: 'Gift Type Mapping', number: 2 }] :
                    [{ label: 'Special Event Mapping', number: 1 }, { label: 'Constituent Type Mapping', number: 2 }, { label: 'Gift Type Mapping', number: 3 }]);
        }
        var html = '';
        for (var i = 0; i < steps.length; i++) {
            html += '<div class="step-item"><div class="step-circle">' + steps[i].number + '</div><div class="step-label">' + steps[i].label + '</div></div>';
            if (i < steps.length - 1) html += '<div class="step-connector"></div>';
        }
        stepTracker.innerHTML = html;
        // Set line offset based on number of steps so line doesn't extend past first/last circle
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
        // Build list of skipped step indices
        var skipped = [];
        if (specialEventSkipped) skipped.push(0);
        if (spotlightSkipped && spotlightConfig) skipped.push(1);
        for (var i = 0; i < items.length; i++) {
            var isSkipped = skipped.indexOf(i) !== -1;
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
                var wrapper = submitBtn.closest('.form-field-wrapper');
                if (wrapper) wrapper.style.display = 'none';
            }
            if (!allFound) setTimeout(hideGHLElements, 500);
        })();

        // uploadTitle pre-styled in HTML

        // uploadBox pre-styled in HTML - just attach click listener
        waitForElement('#uploadBox', function(el) {
            el.style.border = '1px solid #ACACACFF';
            el.style.borderRadius = '8px';
            el.style.minHeight = '74px';
            el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:14px 0;">' + uploadIconSvg + '</div>';
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
        waitForElement('#startMappingBtn', function(el) { el.addEventListener('click', startMapping); });
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
            box.style.cssText = 'border:1px solid #ccc;border-radius:4px;padding:20px;background:white;width:100%;box-sizing:border-box;display:none;';
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
                    if (selectedIndustryType) setIndustryTypeField(selectedIndustryType);
                    setTimeout(function() {
                        var ghlBtn = document.querySelector('button[type="submit"]');
                        if (ghlBtn) { console.log('Clicking GHL submit'); ghlBtn.click(); }
                        else { var form = document.querySelector('form'); if (form) form.submit(); else { btn.disabled = false; btn.textContent = originalText; alert('Could not submit. Contact support.'); } }
                    }, 200);
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
        updateStepTracker(0);
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

    function handleFileUpload(e) {
        var file = e.target.files[0];
        if (!file) return;
        var detected = detectIndustry();
        if (detected) { if (!isSimpleFlow) setSpotlightConfig(detected); var lbl = industryDisplayLabels[detected]; if (lbl) { selectedIndustryType = lbl; setIndustryTypeField(lbl); } }

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
                var ua = {};
                for (var i = 0; i < giftJson.length; i++) { if (giftJson[i]['Gift Appeal']) ua[giftJson[i]['Gift Appeal']] = true; }
                giftAppeals = Object.keys(ua).sort();
                var constJson = XLSX.utils.sheet_to_json(workbook.Sheets['Constituent Data'], { defval: '' });
                var uc = {};
                for (var j = 0; j < constJson.length; j++) { var ct = (constJson[j]['Constituent Type'] || '').toString().trim(); if (ct) uc[ct] = true; }
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
                    pledgeStatuses = Object.keys(uPS).sort();
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
                giftTypes = Object.keys(ug).sort();
                var hasBlankGiftType = giftJson.some(function(row) { return !row['Gift Type']; });
                if (hasBlankGiftType) giftTypes.push('__blank__');
                if (spotlightConfig) {
                    if (spotlightConfig.type === 'giftAppeal') spotlightSourceData = giftAppeals.slice();
                    else if (spotlightConfig.type === 'constituentType') spotlightSourceData = constituentTypes.slice();
                }
                initializeStepTracker(); updateStepTracker(0);
                if (constituentMappingSkipped) {
                    ['solicitorDoneBtn','startConstituentFromPledgeBtn','startConstituentFromAppealBtn','startConstituentMappingBtn'].forEach(function(id) {
                        var el = document.getElementById(id); if (el) el.textContent = 'Continue to Gift Type Mapping ➡';
                    });
                }
                // Update upload box to show file info like GHL style
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.innerHTML = uploadIconSvg
                    + '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:8px 0 0 0;border-top:1px solid #eee;margin-top:8px;">'
                    + '<div style="text-align:left;font-size:13px;color:#333;">✓ ' + file.name + '</div>'
                    + '<div style="text-align:center;font-size:12px;color:#666;">' + (isStaffing ? solicitors.length + ' Solicitors &middot; ' : isSimpleFlow ? '' : giftAppeals.length + ' Appeals &middot; ') + constituentTypes.length + ' Constituent Types &middot; ' + giftTypes.length + ' Gift Types</div>'
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
                    document.getElementById('categorySetup').style.display = 'block';
                }

            } catch (err) {
                // Reset upload box on error
                var uploadBox = document.getElementById('uploadBox');
                uploadBox.style.cursor = 'pointer';
                uploadBox.innerHTML = uploadIconSvg;
                var dn = document.getElementById('uploadNote'); if (dn) dn.style.display = '';
                var dd = document.getElementById('download-container'); if (dd) dd.style.display = '';
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
        updateStepTracker(0); currentIndex = 0; hasUsedPrevious = false;
        if (spotlightConfig) { document.getElementById('completionNextStep').textContent = 'Click below to continue to spotlight mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Spotlight Mapping ➝'; document.getElementById('completionNextButton').onclick = startSpotlightMapping; }
        else if (constituentMappingSkipped) { document.getElementById('completionNextStep').textContent = 'Click below to continue to Gift Type mapping.'; document.getElementById('completionNextButton').textContent = 'Continue to Gift Type Mapping ➝'; document.getElementById('completionNextButton').onclick = startGiftTypeMapping; }
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
        updateStepTracker(1); spotlightCurrentIndex = 0; spotlightHasUsedPrevious = false;
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
        updateStepTracker(0); pledgeStatusCurrentIndex = 0; pledgeStatusHasUsedPrevious = false;
        document.getElementById('pledgeStatusMappingSection').style.display = 'block';
        showCurrentPledgeStatus(); updatePledgeStatusProgress();
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentPledgeStatus() {
        var container = document.getElementById('pledgeStatusMappingContainer');
        if (pledgeStatusCurrentIndex >= pledgeStatuses.length) {
            container.innerHTML = '';
            document.getElementById('pledgeStatusCompletionCard').style.display = 'block';
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
        updateStepTracker(0); appealCategoryCurrentIndex = 0; appealCategoryHasUsedPrevious = false;
        document.getElementById('appealCategoryMappingSection').style.display = 'block';
        showCurrentAppealCategory(); updateAppealCategoryProgress();
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentAppealCategory() {
        var container = document.getElementById('appealCategoryMappingContainer');
        if (appealCategoryCurrentIndex >= giftAppeals.length) {
            container.innerHTML = '';
            document.getElementById('appealCategoryCompletionCard').style.display = 'block';
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
        updateStepTracker(isSimpleFlow ? ((isStaffing && solicitors.length > 0) || (isDevelopmentAssessment && appealCategories.length > 0) || (isCampaignCounsel && pledgeStatuses.length > 0) ? 1 : 0) : spotlightConfig ? 2 : 1); constituentCurrentIndex = 0; constituentHasUsedPrevious = false;
        document.getElementById('constituentMappingSection').style.display = 'block'; showCurrentConstituentType(); updateConstituentProgress();
        ['mappingSection','spotlightMappingSection','pledgeStatusMappingSection','appealCategoryMappingSection','solicitorSelectionSection'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentConstituentType() {
        var container = document.getElementById('constituentMappingContainer');
        if (constituentCurrentIndex >= constituentTypes.length) { container.innerHTML = ''; updateStepTracker(isSimpleFlow ? ((isStaffing && solicitors.length > 0) || (isDevelopmentAssessment && appealCategories.length > 0) || (isCampaignCounsel && pledgeStatuses.length > 0) ? 2 : 1) : spotlightConfig ? 3 : 2); document.getElementById('constituentCompletionCard').style.display = 'block'; document.querySelector('#constituentMappingSection .progress-container').style.display = 'none'; document.querySelector('#constituentMappingSection h2').style.display = 'none'; return; }
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
        var _cs = constituentMappingSkipped ? 1 : 0;
        updateStepTracker(isSimpleFlow ? ((isStaffing && solicitors.length > 0) || (isDevelopmentAssessment && appealCategories.length > 0) || (isCampaignCounsel && pledgeStatuses.length > 0) ? 2 - _cs : 1 - _cs) : spotlightConfig ? 3 - _cs : 2 - _cs); giftTypeCurrentIndex = 0; giftTypeHasUsedPrevious = false;
        document.getElementById('giftTypeMappingSection').style.display = 'block'; showCurrentGiftType(); updateGiftTypeProgress();
        ['mappingSection','spotlightMappingSection','pledgeStatusMappingSection','appealCategoryMappingSection','solicitorSelectionSection','constituentMappingSection'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
        setTimeout(function() { window.parent.postMessage({ type: 'scrollToMapperBottom' }, '*'); }, 100);
    }

    function showCurrentGiftType() {
        var container = document.getElementById('giftTypeMappingContainer');
        if (giftTypeCurrentIndex >= giftTypes.length) {
            container.innerHTML = '';
            var _cs = constituentMappingSkipped ? 1 : 0;
            updateStepTracker(isSimpleFlow ? ((isStaffing && solicitors.length > 0) || (isDevelopmentAssessment && appealCategories.length > 0) || (isCampaignCounsel && pledgeStatuses.length > 0) ? 3 - _cs : 2 - _cs) : spotlightConfig ? 4 - _cs : 3 - _cs);
            document.getElementById('giftTypeCompletionCard').style.display = 'block';
            document.querySelector('#giftTypeMappingSection .progress-container').style.display = 'none';
            document.querySelector('#giftTypeMappingSection h2').style.display = 'none';
            var csBtn = document.getElementById('customSubmitBtn'); if (csBtn && csBtn.parentElement) csBtn.parentElement.style.display = '';
            return;
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
        var giftTypeOk = Object.keys(giftTypeMappings).length > 0;
        var solicitorOk = !isStaffing || solicitors.length === 0 || solicitorSelectionDone;
        var appealCategoryOk = !isDevelopmentAssessment || appealCategories.length === 0 || Object.keys(appealCategoryMappings).length > 0;
        var pledgeStatusOk = !isCampaignCounsel || pledgeStatuses.length === 0 || Object.keys(pledgeStatusMappings).length >= pledgeStatuses.length;
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

                // Auto-add constituent records for any Constituent IDs in Gift Data missing from Constituent Data
        var cdIdSet = {};
        for (var ci = 0; ci < cd2.length; ci++) cdIdSet[(cd2[ci]['Constituent ID'] || '').toString().trim()] = true;
        var missingCids = {};
        for (var mi = 0; mi < gd.length; mi++) {
            var mcid = (gd[mi]['Constituent ID'] || '').toString().trim();
            if (mcid && !cdIdSet[mcid]) {
                if (!missingCids[mcid]) missingCids[mcid] = [];
                var gdate = gd[mi]['Gift Date'];
                if (gdate !== undefined && gdate !== '') missingCids[mcid].push(gdate);
            }
        }
        Object.keys(missingCids).forEach(function(cid) {
            var dates = missingCids[cid];
            var oldest = dates.length > 0 ? dates.reduce(function(a, b) {
                var ta = typeof a === 'number' ? (a - 25569) * 86400000 : new Date(a).getTime();
                var tb = typeof b === 'number' ? (b - 25569) * 86400000 : new Date(b).getTime();
                return ta <= tb ? a : b;
            }) : '';
            var newRow = {};
            for (var h = 0; h < origConstHeaders.length; h++) newRow[origConstHeaders[h]] = '';
            newRow['Constituent ID'] = cid;
            newRow['Constituent Type'] = 'Individual';
            newRow['First Gift Date'] = oldest;
            cd2.push(newRow);
        });
        
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
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gd, {header: giftHeaders}), 'Gift Data');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cd2, {header: origConstHeaders}), 'Constituent Data');
        for (var q = 0; q < workbook.SheetNames.length; q++) {
            var sn = workbook.SheetNames[q];
            if (sn !== 'Gift Data' && sn !== 'Constituent Data' && sn !== 'Instructions') {
                var srcSheet = workbook.Sheets[sn];
                var valSheet = {};
                var cellKeys = Object.keys(srcSheet);
                for (var ck = 0; ck < cellKeys.length; ck++) {
                    var ck2 = cellKeys[ck];
                    if (ck2[0] === '!') { valSheet[ck2] = srcSheet[ck2]; continue; }
                    var srcCell = srcSheet[ck2];
                    valSheet[ck2] = { v: srcCell.v, t: srcCell.t };
                    if (srcCell.w) valSheet[ck2].w = srcCell.w;
                }
                XLSX.utils.book_append_sheet(wb, valSheet, sn);
            }
        }

        return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    window.attachToGHLForm = function() {
        var blob = generateExcelBlob();
        if (!blob) { alert('Please complete all ' + (isSimpleFlow ? ((isStaffing && solicitors.length > 0) || (isDevelopmentAssessment && appealCategories.length > 0) || (isCampaignCounsel && pledgeStatuses.length > 0) ? 'three' : 'two') : spotlightConfig ? 'four' : 'three') + ' mapping steps before submitting'); return false; }
        var file = new File([blob], 'Gift_Data_with_Events.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        var fi = document.querySelector('input[type="file"][name="  Client Data File"]') || document.querySelector('input[type="file"][name*="Client Data File"]') || document.querySelector('input[type="file"][name*="e874762e"]') || document.querySelector('#el_5GIq2FyRJrWJv32C9avI_btJHfCz265PqHT9D7m9S_13 input[type="file"]');
        if (fi) { var dt = new DataTransfer(); dt.items.add(file); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true })); return true; }
        else { alert('Could not attach file. Please contact support.'); return false; }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
