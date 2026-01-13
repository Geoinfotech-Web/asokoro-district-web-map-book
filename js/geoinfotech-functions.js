/* ================================================================
 * GEOINFOTECH RESOURCES LIMITED
 * Enhanced Functions for qgis2web Export
 * 
 * This file contains JavaScript functions for:
 * - Search capability (case-insensitive, character-insensitive)
 * - POI category filtering
 * - Basemap switching
 * - Grid-based map sheet navigation
 * - Mobile responsiveness
 * 
 * Copy this file to your new qgis2web export's js folder
 * ================================================================ */

/* ================================================================
 * MAIN INITIALIZATION FUNCTION
 * Call this after all layers are defined in index.html
 * 
 * Parameters:
 * - map: Leaflet map instance
 * - layerRegistry: Object containing all layer references
 * - config: MAPBOOK_CONFIG object
 * - basemapStreet: Street basemap tile layer
 * - basemapSatellite: Satellite basemap tile layer
 * - currentBasemap: Currently active basemap
 * ================================================================ */
function initGeoinfotech(map, layerRegistry, config, basemapStreet, basemapSatellite, currentBasemap) {
    
    // Store current basemap reference globally
    window.currentBasemap = currentBasemap;
    
    // Initialize all features
    initBasemapSelector(map, basemapStreet, basemapSatellite);
    initSearch(map, layerRegistry, config);
    initPOIFilter(map, layerRegistry, config);
    initGridNavigation(map, layerRegistry, config);
    initMobileResponsiveness();
    
    console.log('Geoinfotech enhanced features initialized');
}

/* ================================================================
 * FEATURE 4.2: BASEMAP SELECTION
 * Allows switching between street and satellite basemaps
 * ================================================================ */
function initBasemapSelector(map, basemapStreet, basemapSatellite) {
    var streetBtn = document.getElementById('basemap-street');
    var satelliteBtn = document.getElementById('basemap-satellite');
    
    if (!streetBtn || !satelliteBtn) return;
    
    streetBtn.addEventListener('click', function() {
        if (window.currentBasemap !== basemapStreet) {
            map.removeLayer(window.currentBasemap);
            basemapStreet.addTo(map);
            basemapStreet.bringToBack();
            window.currentBasemap = basemapStreet;
            satelliteBtn.classList.remove('active');
            streetBtn.classList.add('active');
        }
    });
    
    satelliteBtn.addEventListener('click', function() {
        if (window.currentBasemap !== basemapSatellite) {
            map.removeLayer(window.currentBasemap);
            basemapSatellite.addTo(map);
            basemapSatellite.bringToBack();
            window.currentBasemap = basemapSatellite;
            streetBtn.classList.remove('active');
            satelliteBtn.classList.add('active');
        }
    });
}

/* ================================================================
 * FEATURE 4.6: SEARCH CAPABILITY
 * Case-insensitive, character-insensitive search
 * 
 * Search behavior:
 * - Case-insensitive: "Nyanya" matches "NYANYA" and "nyanya"
 * - Character-insensitive: "Nyanya Karshi" matches "Nyanya-Karshi Road"
 * - Removes hyphens, underscores, and extra spacing
 * ================================================================ */

// Normalize text for search comparison
function normalizeSearchText(text) {
    if (!text) return '';
    return text.toString()
        .toLowerCase()
        .replace(/[-_]/g, ' ')       // Replace hyphens/underscores with spaces
        .replace(/[^a-z0-9\s]/g, '') // Remove other special characters
        .replace(/\s+/g, ' ')        // Normalize multiple spaces to single
        .trim();
}

// Build search index from all searchable layers
function buildSearchIndex(layerRegistry, config) {
    var searchIndex = [];
    
    for (var layerName in config.searchableLayers) {
        var layer = layerRegistry[layerName];
        if (!layer) continue;
        
        var searchFields = config.searchableLayers[layerName];
        
        layer.eachLayer(function(featureLayer) {
            var props = featureLayer.feature ? featureLayer.feature.properties : null;
            if (!props) return;
            
            for (var i = 0; i < searchFields.length; i++) {
                var fieldName = searchFields[i];
                var fieldValue = props[fieldName];
                
                if (fieldValue && fieldValue.toString().trim() !== '') {
                    searchIndex.push({
                        displayName: fieldValue.toString(),
                        normalizedName: normalizeSearchText(fieldValue),
                        layer: featureLayer,
                        layerName: layerName,
                        fieldName: fieldName
                    });
                }
            }
        });
    }
    
    return searchIndex;
}

// Perform search and return matching results
function performSearch(query, searchIndex) {
    var normalizedQuery = normalizeSearchText(query);
    if (normalizedQuery.length < 2) return [];
    
    var results = [];
    var seen = new Set();
    
    for (var i = 0; i < searchIndex.length; i++) {
        var item = searchIndex[i];
        
        // Check if query matches anywhere in the normalized name
        if (item.normalizedName.indexOf(normalizedQuery) !== -1) {
            // Avoid duplicates
            var key = item.displayName.toLowerCase() + '_' + item.layerName;
            if (!seen.has(key)) {
                seen.add(key);
                results.push(item);
            }
        }
        
        // Limit to 10 results
        if (results.length >= 10) break;
    }
    
    return results;
}

// Display search results in dropdown
function displaySearchResults(results, map) {
    var resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';
    
    if (results.length === 0) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    resultsDiv.style.display = 'block';
    
    for (var i = 0; i < results.length; i++) {
        var result = results[i];
        var div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = result.displayName;
        
        // Closure to capture result
        div.addEventListener('click', (function(r) {
            return function() {
                zoomToSearchResult(r.layer, map);
                document.getElementById('search-results').style.display = 'none';
                document.getElementById('search-input').value = r.displayName;
            };
        })(result));
        
        resultsDiv.appendChild(div);
    }
}

// Zoom to search result and open popup
function zoomToSearchResult(layer, map) {
    if (layer.getBounds) {
        // Polygon or line feature
        map.fitBounds(layer.getBounds(), { maxZoom: 18, padding: [50, 50] });
    } else if (layer.getLatLng) {
        // Point feature
        map.setView(layer.getLatLng(), 18);
    }
    
    // Open popup after short delay
    if (layer.openPopup) {
        setTimeout(function() { layer.openPopup(); }, 300);
    }
}

// Initialize search functionality
function initSearch(map, layerRegistry, config) {
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    
    if (!searchInput) return;
    
    // Build search index
    var searchIndex = buildSearchIndex(layerRegistry, config);
    
    // Debounce timeout
    var searchTimeout = null;
    
    // Input event - perform search
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        var query = this.value;
        
        searchTimeout = setTimeout(function() {
            var results = performSearch(query, searchIndex);
            displaySearchResults(results, map);
        }, 200);
    });
    
    // Focus event - show results if query exists
    searchInput.addEventListener('focus', function() {
        if (this.value.length >= 2) {
            var results = performSearch(this.value, searchIndex);
            displaySearchResults(results, map);
        }
    });
    
    // Close results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#search-container')) {
            searchResults.style.display = 'none';
        }
    });
}

/* ================================================================
 * FEATURE 4.7: POI CATEGORY FILTERING
 * Allows filtering POIs by category (checkboxes)
 * ================================================================ */
function initPOIFilter(map, layerRegistry, config) {
    var filterOptions = document.getElementById('poi-filter-options');
    var filterHeader = document.getElementById('poi-filter-header');
    
    if (!filterOptions || !filterHeader) return;
    
    // Clear existing options
    filterOptions.innerHTML = '';
    
    // Create checkbox for each POI category
    for (var categoryName in config.poiCategories) {
        var layerName = config.poiCategories[categoryName];
        var layer = layerRegistry[layerName];
        
        var div = document.createElement('div');
        div.className = 'poi-filter-item';
        
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'filter-' + layerName.replace(/[^a-zA-Z0-9]/g, '_');
        checkbox.checked = layer ? map.hasLayer(layer) : false;
        checkbox.setAttribute('data-layer', layerName);
        
        // Checkbox change event
        checkbox.addEventListener('change', function() {
            var ln = this.getAttribute('data-layer');
            var l = layerRegistry[ln];
            if (l) {
                if (this.checked) {
                    map.addLayer(l);
                } else {
                    map.removeLayer(l);
                }
            }
        });
        
        var label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = categoryName;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        filterOptions.appendChild(div);
    }
    
    // Toggle filter panel visibility
    filterHeader.addEventListener('click', function() {
        var isHidden = filterOptions.style.display === 'none';
        filterOptions.style.display = isHidden ? 'block' : 'none';
    });
}

/* ================================================================
 * FEATURE 4.5: GRID-BASED MAP SHEET NAVIGATION
 * Optional feature - click grid cells to zoom to extent
 * ================================================================ */
function initGridNavigation(map, layerRegistry, config) {
    if (!config.gridLayer || !layerRegistry[config.gridLayer]) return;
    
    var gridLayer = layerRegistry[config.gridLayer];
    
    // Initially hide grid
    map.removeLayer(gridLayer);
    
    // Create toggle button
    var gridToggle = document.createElement('button');
    gridToggle.id = 'grid-toggle';
    gridToggle.textContent = 'Show Grid';
    gridToggle.className = 'grid-toggle-btn';
    document.body.appendChild(gridToggle);
    
    var gridVisible = false;
    
    // Toggle button click event
    gridToggle.addEventListener('click', function() {
        if (gridVisible) {
            map.removeLayer(gridLayer);
            this.textContent = 'Show Grid';
            gridVisible = false;
        } else {
            map.addLayer(gridLayer);
            this.textContent = 'Hide Grid';
            gridVisible = true;
        }
    });
    
    // Click on grid cell to zoom to its extent
    gridLayer.eachLayer(function(layer) {
        layer.on('click', function(e) {
            map.fitBounds(layer.getBounds());
            L.DomEvent.stopPropagation(e);
        });
    });
}

/* ================================================================
 * MOBILE RESPONSIVENESS
 * Collapse panels on smaller screens
 * ================================================================ */
function initMobileResponsiveness() {
    function handleResize() {
        var width = window.innerWidth;
        var poiOptions = document.getElementById('poi-filter-options');
        
        if (poiOptions) {
            if (width < 768) {
                // Collapse POI filter by default on mobile
                poiOptions.style.display = 'none';
            }
        }
    }
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call
}

/* ================================================================
 * UTILITY: Get feature coordinates for display
 * ================================================================ */
function getFeatureCoordinates(layer) {
    if (layer.getLatLng) {
        var ll = layer.getLatLng();
        return { lat: ll.lat.toFixed(6), lng: ll.lng.toFixed(6) };
    } else if (layer.getBounds) {
        var center = layer.getBounds().getCenter();
        return { lat: center.lat.toFixed(6), lng: center.lng.toFixed(6) };
    }
    return null;
}

/* ================================================================
 * Export functions for use in index.html
 * ================================================================ */
window.initGeoinfotech = initGeoinfotech;
window.normalizeSearchText = normalizeSearchText;
window.buildSearchIndex = buildSearchIndex;
window.performSearch = performSearch;
