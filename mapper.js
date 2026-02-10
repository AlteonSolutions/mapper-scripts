(function() {
    'use strict';
    
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

    var constituentCategories = [
        'Individual',
        'Organization',
        'Government',
        'Foundation',
        'Estate',
        'Family Foundation',
        'Corporation'
    ];

    var spotlightConfig = null;

    var industryImageIds = {
        'image-FRdTKXvCKw': 'arts',
        'image-jmRsaBRUt0': 'environmental',
        'image-mPaKkFsRIc': 'education',
        'image-LAJZMp0Uz7': 'communityfoundation',
        'image-I9s-xC-hNO': 'healthcare',
        'image-Ki-dn13age': 'humanservices',
        'image-7Zvkl8xveW': 'religion'
    };

    function detectIndustry() {
        console.log('=== Starting Industry Detection ===');
        
        for (var imageId in industryImageIds) {
            if (industryImageIds.hasOwnProperty(imageId)) {
                var img = document.getElementById(imageId);
                if (img) {
                    var style = window.getComputedStyle(img);
                    var rect = img.getBoundingClientRect();
                    
                    console.log('Checking image:', imageId, {
                        display: style.display,
                        visibility: style.visibility,
                        opacity: style.opacity,
                        width: rect.width,
                        height: rect.height
                    });
                    
                    if (style.display !== 'none' && 
                        style.visibility !== 'hidden' && 
                        parseFloat(style.opacity) > 0 &&
                        rect.width > 0 && 
                        rect.height > 0) {
                        
                        console.log('✓ DETECTED INDUSTRY:', industryImageIds[imageId]);
                        return industryImageIds[imageId];
                    }
                }
            }
        }
        
        console.log('✗ No visible industry image found');
        return null;
    }

    function setSpotlightConfig(industry) {
        console.log('Setting spotlight config for:', industry);
        
        if (industry === 'arts') {
            spotlightConfig = {
                type: 'giftAppeal',
                title: 'Map Gift Appeals to Spotlights',
                categories: ['Tickets', 'Season Ticket Holders', 'Skip'],
                completionText: 'You have successfully mapped all Gift Appeals to spotlight categories.'
            };
        } else if (industry === 'education') {
            spotlightConfig = {
                type: 'giftAppeal',
                title: 'Map Gift Appeals to Spotlights',
                categories: ['Alumni', 'Parent & Grandparent', 'Skip'],
                completionText: 'You have successfully mapped all Gift Appeals to spotlight categories.'
            };
        } else if (industry === 'communityfoundation') {
            spotlightConfig = {
                type: 'constituentType',
                title: 'Map Constituent Types to Spotlights',
                categories: ['Donor', 'Fundholder', 'Skip'],
                completionText: 'You have successfully mapped all Constituent Types to spotlight categories.'
            };
        } else if (industry === 'healthcare') {
            spotlightConfig = {
                type: 'constituentType',
                title: 'Map Constituent Types to Spotlights',
                categories: ['Patient', 'Physician', 'Skip'],
                completionText: 'You have successfully mapped all Constituent Types to spotlight categories.'
            };
        }
        
        if (spotlightConfig) {
            console.log('✓ Spotlight config set:', spotlightConfig.type, spotlightConfig.categories);
        } else {
            console.log('No spotlight config needed for:', industry);
        }
    }

    function initializeStepTracker() {
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;

        var steps = [];
        if (spotlightConfig) {
            steps = [
                { label: 'Special Event Mapping', number: 1 },
                { label: 'Spotlight Mapping', number: 2 },
                { label: 'Constituent Type Mapping', number: 3 }
            ];
        } else {
            steps = [
                { label: 'Special Event Mapping', number: 1 },
                { label: 'Constituent Type Mapping', number: 2 }
            ];
        }

        var html = '';
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            
            html += '<div class="step-item">';
            html += '<div class="step-circle">';
            html += step.number;
            html += '</div>';
            html += '<div class="step-label">' + step.label + '</div>';
            if (i < steps.length - 1) {
                html += '<div class="step-connector"></div>';
            }
            html += '</div>';
        }
        
        stepTracker.innerHTML = html;
        document.getElementById('stepProgress').style.display = 'block';
    }

    function updateStepTracker(step) {
        currentStep = step;
        var stepTracker = document.getElementById('stepTracker');
        if (!stepTracker) return;

        var stepItems = stepTracker.querySelectorAll('.step-item');
        var stepCircles = stepTracker.querySelectorAll('.step-circle');
        var stepConnectors = stepTracker.querySelectorAll('.step-connector');

        for (var i = 0; i < stepItems.length; i++) {
            if (i === step) {
                stepItems[i].classList.add('active');
                stepCircles[i].classList.add('active');
                stepCircles[i].classList.remove('completed');
                stepCircles[i].textContent = (i + 1).toString();
            } else if (i < step) {
                stepItems[i].classList.remove('active');
                stepCircles[i].classList.add('completed');
                stepCircles[i].classList.remove('active');
                stepCircles[i].textContent = '✓';
            } else {
                stepItems[i].classList.remove('active');
                stepCircles[i].classList.remove('active');
                stepCircles[i].classList.remove('completed');
                stepCircles[i].textContent = (i + 1).toString();
            }
        }

        for (var j = 0; j < stepConnectors.length; j++) {
            if (j < step) {
                stepConnectors[j].classList.add('completed');
            } else {
                stepConnectors[j].classList.remove('completed');
            }
        }
    }

    function waitForElement(selector, callback) {
        var checkInterval = setInterval(function() {
            var element = document.querySelector(selector);
            if (element) {
                clearInterval(checkInterval);
                callback(element);
            }
        }, 100);
    }

    function init() {
        waitForElement('#uploadBox', function(uploadBox) {
            uploadBox.addEventListener('click', function() {
                document.getElementById('fileInput').click();
            });
        });

        waitForElement('#fileInput', function(fileInput) {
            fileInput.addEventListener('change', handleFileUpload);
        });

        waitForElement('#categoryInput', function(categoryInput) {
            categoryInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    addCategory();
                }
            });
        });

        waitForElement('#addCategoryBtn', function(btn) {
            btn.addEventListener('click', addCategory);
        });

        waitForElement('#startMappingBtn', function(btn) {
            btn.addEventListener('click', startMapping);
        });

        waitForElement('#startConstituentMappingBtn', function(btn) {
            btn.addEventListener('click', startConstituentMapping);
        });

        waitForElement('#categoriesList', function(list) {
            list.addEventListener('click', function(e) {
                if (e.target.tagName === 'BUTTON') {
                    var index = parseInt(e.target.getAttribute('data-index'));
                    removeCategory(index);
                }
            });
        });

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('category-btn')) {
                var appeal = e.target.getAttribute('data-appeal');
                var category = e.target.getAttribute('data-category');
                var mappingType = e.target.getAttribute('data-mapping-type');
                
                if (mappingType === 'event') {
                    selectCategory(appeal, category);
                } else if (mappingType === 'spotlight') {
                    selectSpotlight(appeal, category);
                } else if (mappingType === 'constituent') {
                    selectConstituentType(appeal, category);
                }
            } else if (e.target.classList.contains('nav-btn')) {
                var action = e.target.getAttribute('data-action');
                var mappingType = e.target.getAttribute('data-mapping-type');
                
                if (mappingType === 'event') {
                    if (action === 'previous') previousAppeal();
                    else if (action === 'next') nextAppeal();
                } else if (mappingType === 'spotlight') {
                    if (action === 'previous') previousSpotlight();
                    else if (action === 'next') nextSpotlight();
                } else if (mappingType === 'constituent') {
                    if (action === 'previous') previousConstituentType();
                    else if (action === 'next') nextConstituentType();
                }
            }
        });
    }

    function handleFileUpload(e) {
        var file = e.target.files[0];
        if (!file) return;

        var detectedIndustry = detectIndustry();
        if (detectedIndustry) {
            setSpotlightConfig(detectedIndustry);
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = new Uint8Array(e.target.result);
                workbook = XLSX.read(data, {type: 'array'});
                
                if (workbook.SheetNames.indexOf('Gift Data') === -1) {
                    alert('Error: No Gift Data sheet found in the Excel file!');
                    return;
                }

                if (workbook.SheetNames.indexOf('Constituent Data') === -1) {
                    alert('Error: No Constituent Data sheet found in the Excel file!');
                    return;
                }

                var giftSheet = workbook.Sheets['Gift Data'];
                var giftJsonData = XLSX.utils.sheet_to_json(giftSheet);
                
                var uniqueAppeals = {};
                for (var i = 0; i < giftJsonData.length; i++) {
                    if (giftJsonData[i]['Gift Appeal']) {
                        uniqueAppeals[giftJsonData[i]['Gift Appeal']] = true;
                    }
                }
                giftAppeals = Object.keys(uniqueAppeals).sort();

                var constituentSheet = workbook.Sheets['Constituent Data'];
                var constituentJsonData = XLSX.utils.sheet_to_json(constituentSheet);
                
                var uniqueConstituents = {};
                for (var j = 0; j < constituentJsonData.length; j++) {
                    if (constituentJsonData[j]['Constituent Type']) {
                        uniqueConstituents[constituentJsonData[j]['Constituent Type']] = true;
                    }
                }
                constituentTypes = Object.keys(uniqueConstituents).sort();

                if (spotlightConfig) {
                    if (spotlightConfig.type === 'giftAppeal') {
                        spotlightSourceData = giftAppeals.slice();
                    } else if (spotlightConfig.type === 'constituentType') {
                        spotlightSourceData = constituentTypes.slice();
                    }
                }
                
                initializeStepTracker();
                
                document.getElementById('uploadBox').style.display = 'none';
                var downloadContainer = document.getElementById('download-container');
                if (downloadContainer) {
                    downloadContainer.style.display = 'none';
                }
                
                var fileInfoDiv = document.getElementById('fileInfo');
                fileInfoDiv.innerHTML = '<div style="text-align: center;"><div style="margin-bottom: 8px;">✅ File uploaded: <strong>' + file.name + '</strong></div><div style="margin-bottom: 8px;">' + giftAppeals.length + ' unique Gift Appeals found</div><div>' + constituentTypes.length + ' unique Constituent Types found</div></div>';
                
                document.getElementById('categorySetup').style.display = 'block';

                setTimeout(function() {
                    document.getElementById('categorySetup').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
                
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function addCategory() {
        var input = document.getElementById('categoryInput');
        var categoryName = input.value.trim();
        
        if (!categoryName) {
            alert('Please enter an event name');
            return;
        }

        if (categories.length >= 3) {
            alert('Maximum of 3 events allowed');
            return;
        }

        if (categories.indexOf(categoryName) > -1) {
            alert('This event already exists');
            return;
        }

        categories.push(categoryName);
        updateCategoriesList();
        input.value = '';
        
        if (categories.length >= 3) {
            document.getElementById('addCategoryBtn').disabled = true;
            document.getElementById('categoryInput').disabled = true;
            document.getElementById('categoryInput').placeholder = 'Maximum of 3 events reached';
        } else {
            input.focus();
        }
    }

    function updateCategoriesList() {
        var container = document.getElementById('categoriesList');
        var html = '';
        
        for (var i = 0; i < categories.length; i++) {
            html += '<div class="category-tag">' + categories[i] + ' <button data-index="' + i + '">×</button></div>';
        }
        
        container.innerHTML = html;
    }

    function removeCategory(index) {
        categories.splice(index, 1);
        updateCategoriesList();
        
        if (categories.length < 3) {
            document.getElementById('addCategoryBtn').disabled = false;
            document.getElementById('categoryInput').disabled = false;
            document.getElementById('categoryInput').placeholder = 'Enter event name (e.g., Gala, Golf Tournament, Annual Auction)';
        }
    }

    function startMapping() {
        if (categories.length === 0) {
            alert('Please add at least one event');
            return;
        }

        if (!spotlightConfig) {
            console.log('No spotlight config found, re-detecting industry...');
            var detectedIndustry = detectIndustry();
            if (detectedIndustry) {
                setSpotlightConfig(detectedIndustry);
                
                if (spotlightConfig) {
                    if (spotlightConfig.type === 'giftAppeal') {
                        spotlightSourceData = giftAppeals.slice();
                    } else if (spotlightConfig.type === 'constituentType') {
                        spotlightSourceData = constituentTypes.slice();
                    }
                }
            }
        }

        updateStepTracker(0);

        currentIndex = 0;
        hasUsedPrevious = false;
        
        if (spotlightConfig) {
            document.getElementById('completionNextStep').textContent = 'Click below to continue to spotlight mapping.';
            document.getElementById('completionNextButton').textContent = 'Continue to Spotlight Mapping ➝';
            document.getElementById('completionNextButton').onclick = startSpotlightMapping;
        } else {
            document.getElementById('completionNextStep').textContent = 'Click below to continue to Constituent Type mapping.';
            document.getElementById('completionNextButton').textContent = 'Continue to Constituent Mapping ➝';
            document.getElementById('completionNextButton').onclick = startConstituentMapping;
        }
        
        document.getElementById('mappingSection').style.display = 'block';
        showCurrentAppeal();
        updateProgress();
        
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('categorySetup').style.display = 'none';
        
        setTimeout(function() {
            var mappingSection = document.getElementById('mappingSection');
            var headerOffset = 20;
            var elementPosition = mappingSection.getBoundingClientRect().top;
            var offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 50);
    }

    function showCurrentAppeal() {
        var container = document.getElementById('mappingContainer');
        
        if (currentIndex >= giftAppeals.length) {
            container.innerHTML = '';
            
            document.getElementById('completionCard').style.display = 'block';
            document.getElementById('spotlightMappingSection').style.display = 'none';
            document.getElementById('constituentMappingSection').style.display = 'none';
            document.querySelector('#mappingSection .progress-container').style.display = 'none';
            document.querySelector('#mappingSection h2').style.display = 'none';
            
            return;
        }

        var appeal = giftAppeals[currentIndex];
        var currentMapping = mappings[appeal] || null;

        var html = '<div class="mapping-card">';
        html += '<div class="appeal-label">Gift Appeal ' + (currentIndex + 1) + ' of ' + giftAppeals.length + '</div>';
        html += '<div class="appeal-name">' + appeal + '</div>';
        html += '<div style="text-align: center; margin-bottom: 15px; color: #666; font-weight: 600;">Select an event:</div>';
        html += '<div class="category-buttons">';
        
        for (var i = 0; i < categories.length; i++) {
            html += '<button class="category-btn" data-appeal="' + appeal + '" data-category="' + categories[i] + '" data-mapping-type="event">' + categories[i] + '</button>';
        }
        
        html += '<button class="category-btn non-event-btn" data-appeal="' + appeal + '" data-category="Skip" data-mapping-type="event">Skip</button>';
        html += '</div>';
        html += '<div class="navigation-buttons">';
        html += '<button class="nav-btn" data-action="previous" data-mapping-type="event"' + (currentIndex === 0 ? ' disabled' : '') + '>← Previous</button>';
        html += '<button class="nav-btn" id="nextBtn" data-action="next" data-mapping-type="event"' + (!currentMapping ? ' disabled' : '') + ' style="display: none;">Next →</button>';
        html += '</div>';
        html += '</div>';
        
        container.innerHTML = html;

        if (currentMapping) {
            var buttons = container.querySelectorAll('.category-btn');
            for (var j = 0; j < buttons.length; j++) {
                if (buttons[j].getAttribute('data-category') === currentMapping) {
                    if (currentMapping === 'Skip') {
                        buttons[j].style.background = '#999';
                        buttons[j].style.color = 'white';
                        buttons[j].style.borderColor = '#999';
                    } else {
                        buttons[j].style.background = '#2c5f5d';
                        buttons[j].style.color = 'white';
                        buttons[j].style.borderColor = '#2c5f5d';
                    }
                }
            }
        }

        var nextBtn = container.querySelector('#nextBtn');
        if (nextBtn && hasUsedPrevious && currentMapping) {
            nextBtn.style.display = 'block';
        }
    }

    function selectCategory(appeal, category) {
        mappings[appeal] = category;
        updateProgress();
        
        var buttons = document.querySelectorAll('#mappingContainer .category-btn');
        for (var i = 0; i < buttons.length; i++) {
            var btnCategory = buttons[i].getAttribute('data-category');
            if (btnCategory === category) {
                if (category === 'Skip') {
                    buttons[i].style.background = '#999';
                    buttons[i].style.color = 'white';
                    buttons[i].style.borderColor = '#999';
                } else {
                    buttons[i].style.background = '#2c5f5d';
                    buttons[i].style.color = 'white';
                    buttons[i].style.borderColor = '#2c5f5d';
                }
            } else {
                if (buttons[i].classList.contains('non-event-btn')) {
                    buttons[i].style.background = 'white';
                    buttons[i].style.color = '#666';
                    buttons[i].style.borderColor = '#999';
                } else {
                    buttons[i].style.background = 'white';
                    buttons[i].style.color = '#2c5f5d';
                    buttons[i].style.borderColor = '#2c5f5d';
                }
            }
        }

        var nextBtn = document.querySelector('#nextBtn');
        if (nextBtn && hasUsedPrevious) {
            nextBtn.disabled = false;
            nextBtn.style.display = 'block';
        }

        setTimeout(function() {
            if (!hasUsedPrevious) {
                nextAppeal();
            }
        }, 500);
    }

    function nextAppeal() {
        if (currentIndex < giftAppeals.length) {
            currentIndex++;
            hasUsedPrevious = false;
            showCurrentAppeal();
            updateProgress();
        }
    }

    function previousAppeal() {
        if (currentIndex > 0) {
            currentIndex--;
            hasUsedPrevious = true;
            showCurrentAppeal();
            updateProgress();
        }
    }

    function updateProgress() {
        var mapped = Object.keys(mappings).length;
        var total = giftAppeals.length;
        var percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;
        
        var progressBar = document.getElementById('progressBar');
        var progressBarText = document.getElementById('progressBarText');
        progressBar.style.width = percentage + '%';
        
        if (percentage === 0) {
            progressBarText.textContent = '';
        } else {
            progressBarText.textContent = percentage + '%';
        }
        
        document.getElementById('progressText').textContent = mapped + ' of ' + total + ' appeals mapped';
    }

    function startSpotlightMapping() {
        updateStepTracker(1);
        
        spotlightCurrentIndex = 0;
        spotlightHasUsedPrevious = false;
        
        document.getElementById('spotlightMappingTitle').textContent = spotlightConfig.title;
        document.getElementById('spotlightCompletionText').textContent = spotlightConfig.completionText;
        
        document.getElementById('spotlightMappingSection').style.display = 'block';
        showCurrentSpotlight();
        updateSpotlightProgress();
        
        document.getElementById('mappingSection').style.display = 'none';
        
        setTimeout(function() {
            var spotlightSection = document.getElementById('spotlightMappingSection');
            var headerOffset = 20;
            var elementPosition = spotlightSection.getBoundingClientRect().top;
            var offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 50);
    }

    function showCurrentSpotlight() {
        var container = document.getElementById('spotlightMappingContainer');
        
        if (spotlightCurrentIndex >= spotlightSourceData.length) {
            container.innerHTML = '';
            
            document.getElementById('spotlightCompletionCard').style.display = 'block';
            document.querySelector('#spotlightMappingSection .progress-container').style.display = 'none';
            document.querySelector('#spotlightMappingSection h2').style.display = 'none';
            return;
        }

        var sourceValue = spotlightSourceData[spotlightCurrentIndex];
        var currentMapping = spotlightMappings[sourceValue] || null;
        var labelText = spotlightConfig.type === 'giftAppeal' ? 'Gift Appeal' : 'Constituent Type';

        var html = '<div class="mapping-card">';
        html += '<div class="appeal-label">' + labelText + ' ' + (spotlightCurrentIndex + 1) + ' of ' + spotlightSourceData.length + '</div>';
        html += '<div class="appeal-name">' + sourceValue + '</div>';
        html += '<div style="text-align: center; margin-bottom: 15px; color: #666; font-weight: 600;">Select a spotlight category:</div>';
        html += '<div class="category-buttons">';
        
        for (var i = 0; i < spotlightConfig.categories.length; i++) {
            if (spotlightConfig.categories[i] !== 'Skip') {
                html += '<button class="category-btn" data-appeal="' + sourceValue + '" data-category="' + spotlightConfig.categories[i] + '" data-mapping-type="spotlight">' + spotlightConfig.categories[i] + '</button>';
            }
        }
        
        html += '<button class="category-btn non-event-btn" data-appeal="' + sourceValue + '" data-category="Skip" data-mapping-type="spotlight">Skip</button>';
        html += '</div>';
        html += '<div class="navigation-buttons">';
        html += '<button class="nav-btn" data-action="previous" data-mapping-type="spotlight"' + (spotlightCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button>';
        html += '<button class="nav-btn" id="spotlightNextBtn" data-action="next" data-mapping-type="spotlight"' + (!currentMapping ? ' disabled' : '') + ' style="display: none;">Next →</button>';
        html += '</div>';
        html += '</div>';
        
        container.innerHTML = html;

        if (currentMapping) {
            var buttons = container.querySelectorAll('.category-btn');
            for (var j = 0; j < buttons.length; j++) {
                if (buttons[j].getAttribute('data-category') === currentMapping) {
                    if (currentMapping === 'Skip') {
                        buttons[j].style.background = '#999';
                        buttons[j].style.color = 'white';
                        buttons[j].style.borderColor = '#999';
                    } else {
                        buttons[j].style.background = '#2c5f5d';
                        buttons[j].style.color = 'white';
                        buttons[j].style.borderColor = '#2c5f5d';
                    }
                }
            }
        }

        var nextBtn = container.querySelector('#spotlightNextBtn');
        if (nextBtn && spotlightHasUsedPrevious && currentMapping) {
            nextBtn.style.display = 'block';
        }
    }

    function selectSpotlight(sourceValue, category) {
        spotlightMappings[sourceValue] = category;
        updateSpotlightProgress();
        
        var buttons = document.querySelectorAll('#spotlightMappingContainer .category-btn');
        for (var i = 0; i < buttons.length; i++) {
            var btnCategory = buttons[i].getAttribute('data-category');
            if (btnCategory === category) {
                if (category === 'Skip') {
                    buttons[i].style.background = '#999';
                    buttons[i].style.color = 'white';
                    buttons[i].style.borderColor = '#999';
                } else {
                    buttons[i].style.background = '#2c5f5d';
                    buttons[i].style.color = 'white';
                    buttons[i].style.borderColor = '#2c5f5d';
                }
            } else {
                if (buttons[i].classList.contains('non-event-btn')) {
                    buttons[i].style.background = 'white';
                    buttons[i].style.color = '#666';
                    buttons[i].style.borderColor = '#999';
                } else {
                    buttons[i].style.background = 'white';
                    buttons[i].style.color = '#2c5f5d';
                    buttons[i].style.borderColor = '#2c5f5d';
                }
            }
        }

        var nextBtn = document.querySelector('#spotlightNextBtn');
        if (nextBtn && spotlightHasUsedPrevious) {
            nextBtn.disabled = false;
            nextBtn.style.display = 'block';
        }

        setTimeout(function() {
            if (!spotlightHasUsedPrevious) {
                nextSpotlight();
            }
        }, 500);
    }

    function nextSpotlight() {
        if (spotlightCurrentIndex < spotlightSourceData.length) {
            spotlightCurrentIndex++;
            spotlightHasUsedPrevious = false;
            showCurrentSpotlight();
            updateSpotlightProgress();
        }
    }

    function previousSpotlight() {
        if (spotlightCurrentIndex > 0) {
            spotlightCurrentIndex--;
            spotlightHasUsedPrevious = true;
            showCurrentSpotlight();
            updateSpotlightProgress();
        }
    }

    function updateSpotlightProgress() {
        var mapped = Object.keys(spotlightMappings).length;
        var total = spotlightSourceData.length;
        var percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;
        
        var progressBar = document.getElementById('spotlightProgressBar');
        var progressBarText = document.getElementById('spotlightProgressBarText');
        progressBar.style.width = percentage + '%';
        
        if (percentage === 0) {
            progressBarText.textContent = '';
        } else {
            progressBarText.textContent = percentage + '%';
        }
        
        document.getElementById('spotlightProgressText').textContent = mapped + ' of ' + total + ' mapped';
    }

    function startConstituentMapping() {
        updateStepTracker(spotlightConfig ? 2 : 1);
        
        constituentCurrentIndex = 0;
        constituentHasUsedPrevious = false;
        
        document.getElementById('constituentMappingSection').style.display = 'block';
        showCurrentConstituentType();
        updateConstituentProgress();
        
        document.getElementById('mappingSection').style.display = 'none';
        document.getElementById('spotlightMappingSection').style.display = 'none';
        
        setTimeout(function() {
            var constituentSection = document.getElementById('constituentMappingSection');
            var headerOffset = 20;
            var elementPosition = constituentSection.getBoundingClientRect().top;
            var offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 50);
    }

    function showCurrentConstituentType() {
        var container = document.getElementById('constituentMappingContainer');
        
        if (constituentCurrentIndex >= constituentTypes.length) {
            container.innerHTML = '';
            
            updateStepTracker(spotlightConfig ? 3 : 2);
            
            document.getElementById('constituentCompletionCard').style.display = 'block';
            document.querySelector('#constituentMappingSection .progress-container').style.display = 'none';
            document.querySelector('#constituentMappingSection h2').style.display = 'none';
            return;
        }

        var constituentType = constituentTypes[constituentCurrentIndex];
        var currentMapping = constituentMappings[constituentType] || null;

        var html = '<div class="mapping-card">';
        html += '<div class="appeal-label">Constituent Type ' + (constituentCurrentIndex + 1) + ' of ' + constituentTypes.length + '</div>';
        html += '<div class="appeal-name">' + constituentType + '</div>';
        html += '<div style="text-align: center; margin-bottom: 15px; color: #666; font-weight: 600;">Select a constituent type:</div>';
        html += '<div class="category-buttons allow-wrap">';
        
        for (var i = 0; i < constituentCategories.length; i++) {
            html += '<button class="category-btn" data-appeal="' + constituentType + '" data-category="' + constituentCategories[i] + '" data-mapping-type="constituent">' + constituentCategories[i] + '</button>';
        }
        
        html += '</div>';
        html += '<div class="navigation-buttons">';
        html += '<button class="nav-btn" data-action="previous" data-mapping-type="constituent"' + (constituentCurrentIndex === 0 ? ' disabled' : '') + '>← Previous</button>';
        html += '<button class="nav-btn" id="constituentNextBtn" data-action="next" data-mapping-type="constituent"' + (!currentMapping ? ' disabled' : '') + ' style="display: none;">Next →</button>';
        html += '</div>';
        html += '</div>';
        
        container.innerHTML = html;

        if (currentMapping) {
            var buttons = container.querySelectorAll('.category-btn');
            for (var j = 0; j < buttons.length; j++) {
                if (buttons[j].getAttribute('data-category') === currentMapping) {
                    buttons[j].style.background = '#2c5f5d';
                    buttons[j].style.color = 'white';
                    buttons[j].style.borderColor = '#2c5f5d';
                }
            }
        }

        var nextBtn = container.querySelector('#constituentNextBtn');
        if (nextBtn && constituentHasUsedPrevious && currentMapping) {
            nextBtn.style.display = 'block';
        }
    }

    function selectConstituentType(originalType, mappedType) {
        constituentMappings[originalType] = mappedType;
        updateConstituentProgress();
        
        var buttons = document.querySelectorAll('#constituentMappingContainer .category-btn');
        for (var i = 0; i < buttons.length; i++) {
            var btnCategory = buttons[i].getAttribute('data-category');
            if (btnCategory === mappedType) {
                buttons[i].style.background = '#2c5f5d';
                buttons[i].style.color = 'white';
                buttons[i].style.borderColor = '#2c5f5d';
            } else {
                buttons[i].style.background = 'white';
                buttons[i].style.color = '#2c5f5d';
                buttons[i].style.borderColor = '#2c5f5d';
            }
        }

        var nextBtn = document.querySelector('#constituentNextBtn');
        if (nextBtn && constituentHasUsedPrevious) {
            nextBtn.disabled = false;
            nextBtn.style.display = 'block';
        }

        setTimeout(function() {
            if (!constituentHasUsedPrevious) {
                nextConstituentType();
            }
        }, 500);
    }

    function nextConstituentType() {
        if (constituentCurrentIndex < constituentTypes.length) {
            constituentCurrentIndex++;
            constituentHasUsedPrevious = false;
            showCurrentConstituentType();
            updateConstituentProgress();
        }
    }

    function previousConstituentType() {
        if (constituentCurrentIndex > 0) {
            constituentCurrentIndex--;
            constituentHasUsedPrevious = true;
            showCurrentConstituentType();
            updateConstituentProgress();
        }
    }

    function updateConstituentProgress() {
        var mapped = Object.keys(constituentMappings).length;
        var total = constituentTypes.length;
        var percentage = total > 0 ? Math.round((mapped / total) * 100) : 0;
        
        var progressBar = document.getElementById('constituentProgressBar');
        var progressBarText = document.getElementById('constituentProgressBarText');
        progressBar.style.width = percentage + '%';
        
        if (percentage === 0) {
            progressBarText.textContent = '';
        } else {
            progressBarText.textContent = percentage + '%';
        }
        
        document.getElementById('constituentProgressText').textContent = mapped + ' of ' + total + ' constituent types mapped';
    }

    function generateExcelBlob() {
        var requiredMappings = spotlightConfig ? 3 : 2;
        var completedMappings = Object.keys(mappings).length > 0 ? 1 : 0;
        var spotlightComplete = spotlightConfig ? (Object.keys(spotlightMappings).length > 0 ? 1 : 0) : 0;
        var constituentComplete = Object.keys(constituentMappings).length > 0 ? 1 : 0;
        
        if ((completedMappings + spotlightComplete + constituentComplete) < requiredMappings) {
            return null;
        }

        var giftSheet = workbook.Sheets['Gift Data'];
        var giftJsonData = XLSX.utils.sheet_to_json(giftSheet);

        for (var i = 0; i < giftJsonData.length; i++) {
            giftJsonData[i]['Event'] = mappings[giftJsonData[i]['Gift Appeal']] || 'Unmapped';
            delete giftJsonData[i]['Gift Appeal'];
        }

        if (spotlightConfig && Object.keys(spotlightMappings).length > 0) {
            if (spotlightConfig.type === 'giftAppeal') {
                for (var j = 0; j < giftJsonData.length; j++) {
                    var eventVal = giftJsonData[j]['Event'];
                    var appeal = null;
                    for (var key in mappings) {
                        if (mappings.hasOwnProperty(key) && mappings[key] === eventVal) {
                            appeal = key;
                            break;
                        }
                    }
                    giftJsonData[j]['Spotlights'] = spotlightMappings[appeal] || 'Unmapped';
                }
            } else if (spotlightConfig.type === 'constituentType') {
                var constituentSheet = workbook.Sheets['Constituent Data'];
                var constituentJsonData = XLSX.utils.sheet_to_json(constituentSheet);
                
                var constituentSpotlightMap = {};
                for (var k = 0; k < constituentJsonData.length; k++) {
                    var constituentId = constituentJsonData[k]['Constituent ID'];
                    var originalType = constituentJsonData[k]['Constituent Type'];
                    constituentSpotlightMap[constituentId] = spotlightMappings[originalType] || 'Unmapped';
                }
                
                for (var m = 0; m < giftJsonData.length; m++) {
                    var giftConstituentId = giftJsonData[m]['Constituent ID'];
                    giftJsonData[m]['Spotlights'] = constituentSpotlightMap[giftConstituentId] || 'Unmapped';
                }
            }
        }

        var constituentSheet2 = workbook.Sheets['Constituent Data'];
        var constituentJsonData2 = XLSX.utils.sheet_to_json(constituentSheet2);

        for (var n = 0; n < constituentJsonData2.length; n++) {
            var origType = constituentJsonData2[n]['Constituent Type'];
            constituentJsonData2[n]['Constituent Type'] = constituentMappings[origType] || origType;
        }

        var newWB = XLSX.utils.book_new();
        
        var newGiftSheet = XLSX.utils.json_to_sheet(giftJsonData);
        XLSX.utils.book_append_sheet(newWB, newGiftSheet, 'Gift Data');

        var newConstituentSheet = XLSX.utils.json_to_sheet(constituentJsonData2);
        XLSX.utils.book_append_sheet(newWB, newConstituentSheet, 'Constituent Data');

        for (var p = 0; p < workbook.SheetNames.length; p++) {
            var sheetName = workbook.SheetNames[p];
            if (sheetName !== 'Gift Data' && sheetName !== 'Constituent Data' && sheetName !== 'Instructions') {
                XLSX.utils.book_append_sheet(newWB, workbook.Sheets[sheetName], sheetName);
            }
        }

        var wbout = XLSX.write(newWB, { bookType: 'xlsx', type: 'array' });
        return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    window.attachToGHLForm = function() {
        var excelBlob = generateExcelBlob();
        
        if (!excelBlob) {
            var stepCount = spotlightConfig ? 'three' : 'two';
            alert('Please complete all ' + stepCount + ' mapping steps before submitting the form');
            return false;
        }

        var file = new File([excelBlob], 'Gift_Data_with_Events.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        var fileInput = document.querySelector('input[type="file"][name*="e874762e"]');
        
        if (!fileInput) {
            fileInput = document.querySelector('input[type="file"].file-input');
        }
        
        if (!fileInput) {
            fileInput = document.querySelector('input.file-input[type="file"]');
        }
        
        if (!fileInput) {
            fileInput = document.querySelector('input[type="file"]');
        }
        
        if (fileInput) {
            var dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;

            var event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
            
            return true;
        } else {
            alert('Could not attach file. Please contact support.');
            return false;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
