/**
 * @typedef {Object} Activity
 * @property {number} id - Activity ID
 * @property {string} name - Activity name
 * @property {string} [description] - Activity description
 * @property {string} [start_date] - ISO date string
 * @property {number} [distance] - Distance in meters
 * @property {number} [moving_time] - Moving time in seconds
 * @property {number} [total_elevation_gain] - Elevation gain in meters
 */

/**
 * @typedef {Object} Challenge
 * @property {string} slug - URL hash fragment (without #)
 * @property {string} name - Display name
 * @property {string} description - Subtitle shown on the home tile
 * @property {string} dataFile - Filename inside static/ e.g. 'activities-terminus.json'
 * @property {string[]} gradient - Two CSS colour stops [from, to]
 * @property {number} total - Target total count for progress bar
 */

/** @type {Challenge[]} */
let CHALLENGES = [];

// Common table cell styles for reuse
const tableCellStyle = "padding:8px;border:1px solid #ccc;text-align:center;";
const tableCellStyleLeft = "padding:8px;border:1px solid #ccc;";
const tableCellStyleNoWrap = "padding:8px;border:1px solid #ccc;text-align:center;white-space:nowrap;";
const tableCellStyleNoWrapLeft = "padding:8px;border:1px solid #ccc;text-align:left;white-space:nowrap;";

// Cache DOM elements
const elements = {
    homeScreen:       document.getElementById('home-screen'),
    challengeDetail:  document.getElementById('challenge-detail'),
    detailNav:        document.getElementById('challenge-detail-nav'),
    detailTitle:      document.getElementById('challenge-detail-title'),
    backBtn:          document.getElementById('back-to-challenges'),
    activities:       document.getElementById('activities'),
    tableView:        document.getElementById('table-view'),
    heatmapView:      document.getElementById('heatmap-view'),
    viewToggle:       document.querySelector('.view-toggle'),
    btnCard:          document.getElementById('view-btn-card'),
    btnTable:         document.getElementById('view-btn-table'),
    btnHeatmap:       document.getElementById('view-btn-heatmap'),
};

/** @type {Activity[]} */
let activitiesData = [];

/** @type {AbortController|null} - cancels any in-flight fetchActivities call */
let currentFetchController = null;

// ---------------------------------------------------------------------------
// View management
// ---------------------------------------------------------------------------

/**
 * Show either the home screen or the challenge detail view.
 * @param {'home'|'challenge'} view
 */
function showView(view) {
    const showHome = view === 'home';
    elements.homeScreen.hidden      = !showHome;
    elements.challengeDetail.hidden = showHome;
    elements.detailNav.hidden       = showHome;
}

// ---------------------------------------------------------------------------
// Home screen
// ---------------------------------------------------------------------------

/**
 * Render the challenge tiles into #home-screen.
 * Called once on first home-screen visit; tiles are static (no counts shown
 * until data is loaded on first navigation into a challenge).
 */
function renderHomeScreen() {
    elements.homeScreen.innerHTML = `
        ${CHALLENGES.map(c => `
            <button
                class="challenge-tile"
                style="background: linear-gradient(135deg, ${c.gradient[0]}, ${c.gradient[1]});"
                data-slug="${c.slug}"
                aria-label="Open ${c.name}"
            >
                <p class="challenge-tile__status">Active</p>
                <h2 class="challenge-tile__name">${c.name}</h2>
                <p class="challenge-tile__description">${c.description}</p>
                <div class="challenge-tile__progress">
                    <div class="challenge-tile__progress-bar">
                        <div class="challenge-tile__progress-fill" style="width:0;"></div>
                    </div>
                    <span class="challenge-tile__progress-pct">0 / ${c.total}</span>
                </div>
            </button>
        `).join('')}
    `;

    // Wire up tile clicks
    elements.homeScreen.querySelectorAll('.challenge-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            window.location.hash = tile.dataset.slug;
        });
    });

    // Pre-load progress counts for all tiles in the background
    CHALLENGES.forEach(c => void prefetchProgress(c));
}

// ---------------------------------------------------------------------------
// Home screen progress prefetch
// ---------------------------------------------------------------------------

/**
 * Fetch activity count for a challenge and update its home tile progress.
 * Runs in the background when the home screen is shown. Has no side-effects
 * on activitiesData or the card/table views.
 * @param {Challenge} challenge
 */
async function prefetchProgress(challenge) {
    try {
        const res = await fetch('./' + challenge.dataFile);
        if (!res.ok) return;
        const activities = await res.json();
        const tile = elements.homeScreen.querySelector(`[data-slug="${challenge.slug}"]`);
        if (!tile) return;
        const count = activities.length;
        const pct = challenge.total > 0 ? Math.min(100, Math.round(count / challenge.total * 100)) : 0;
        tile.querySelector('.challenge-tile__status').textContent =
            `Active - ${count} of ${challenge.total} complete`;
        tile.querySelector('.challenge-tile__progress-fill').style.width = pct + '%';
        tile.querySelector('.challenge-tile__progress-pct').textContent =
            `${count} / ${challenge.total}`;
    } catch (err) {
        // Silent fail - tile stays at 0 if network is unavailable
        console.debug('prefetchProgress failed for', challenge.slug, err);
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Read the current hash, decide which view to show, and trigger data loading.
 * Falls back to home screen for unknown hashes.
 */
function router() {
    const hash = window.location.hash.replace('#', '');
    const challenge = CHALLENGES.find(c => c.slug === hash);

    if (!challenge) {
        if (currentFetchController) {
            currentFetchController.abort();
            currentFetchController = null;
        }
        showView('home');
        return;
    }

    // Show challenge detail
    showView('challenge');
    elements.detailTitle.textContent = challenge.name;

    // Expose gradient colours as CSS variables for tinting cards and table
    document.documentElement.style.setProperty('--gradient-from', challenge.gradient[0]);
    document.documentElement.style.setProperty('--gradient-to',   challenge.gradient[1]);

    // Cancel any in-flight fetch from a previous navigation
    if (currentFetchController) {
        currentFetchController.abort();
        currentFetchController = null;
    }

    // Reset data state and reload for this challenge
    activitiesData = [];
    tableSort = { column: null, asc: true };
    elements.activities.innerHTML = '';
    elements.tableView.innerHTML = '';
    elements.heatmapView.innerHTML = '';
    elements.activities.style.display = 'none';
    elements.tableView.style.display = 'none';
    elements.heatmapView.style.display = 'none';
    if (leafletMap) { leafletMap.remove(); leafletMap = null; routeLayerGroup = null; }
    elements.viewToggle.style.display = '';

    void fetchActivities(challenge);
}

// Back link
elements.backBtn.addEventListener('click', () => {
    window.location.hash = '';
});

// Hash change (browser back/forward + tile clicks)
window.addEventListener('hashchange', router);

// ---------------------------------------------------------------------------
// Activities data loading
// ---------------------------------------------------------------------------

// Helper function to show the activities view
function showActivitiesView() {
    elements.viewToggle.style.display = '';
}

/**
 * Fetch and render activities for one challenge.
 * @param {Challenge} challenge - The challenge to load
 */
async function fetchActivities(challenge) {
    const dataFile = challenge.dataFile;
    const controller = new AbortController();
    currentFetchController = controller;
    elements.activities.style.display = 'none';
    elements.tableView.style.display = 'none';
    elements.activities.innerHTML = '';

    try {
        const res = await fetch('./' + dataFile, { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to load activities: ${res.status}`);

        showActivitiesView();
        const activities = await res.json();
        activities.forEach(a => a._timestamp = a.start_date ? Date.parse(a.start_date) : 0);
        activitiesData = activities;

        // Update the home tile progress now that we have the real count
        const tile = elements.homeScreen.querySelector(`[data-slug="${challenge.slug}"]`);
        if (tile) {
            const count = activities.length;
            const pct = challenge.total > 0 ? Math.min(100, Math.round(count / challenge.total * 100)) : 0;
            tile.querySelector('.challenge-tile__status').textContent =
                `Active - ${count} of ${challenge.total} complete`;
            tile.querySelector('.challenge-tile__progress-fill').style.width = pct + '%';
            tile.querySelector('.challenge-tile__progress-pct').textContent =
                `${count} / ${challenge.total}`;
        }

        if (activities.length === 0) {
            elements.activities.innerHTML = '<p>No activities found for this challenge.</p>';
            elements.viewToggle.style.display = 'none';
            elements.activities.style.display = 'grid';
            return;
        }

        const savedMode = localStorage.getItem('viewMode');
        const mode = (savedMode === 'table' || savedMode === 'card') ? savedMode : 'heatmap';
        switchView(mode);

    } catch (error) {
        if (error.name === 'AbortError') return; // navigation cancelled this fetch
        console.error('Error loading activities:', error);
        elements.activities.innerHTML = '<p>Error loading activities. Please try again later.</p>';
        elements.activities.style.display = 'grid';
        elements.viewToggle.style.display = 'none';
    }
}

let tableSort = { column: null, asc: true };

// ---------------------------------------------------------------------------
// Table view
// ---------------------------------------------------------------------------

// Helper to format activity meta fields
/**
 * @param {Activity} a
 */
function formatActivityMeta(a) {
    return {
        distance:  a.distance ? (a.distance / 1000).toFixed(2) + ' km' : 'N/A',
        time:      a.moving_time ? formatDuration(a.moving_time) : 'N/A',
        speed:     a.distance && a.moving_time ? calcSpeed(a.distance, a.moving_time) + ' km/h' : 'N/A',
        elevation: a.total_elevation_gain ? a.total_elevation_gain.toFixed(0) + ' m' : 'N/A',
        date:      a.start_date ? formatDate(a.start_date) : 'N/A'
    };
}

function renderTableView() {
    /** @type {Activity[]} */
    let sorted = [...activitiesData];

    // Sorting logic
    if (tableSort.column) {
        sorted.sort((a, b) => {
            let aVal, bVal;
            switch(tableSort.column) {
                case 'date':
                    aVal = a._timestamp || 0;
                    bVal = b._timestamp || 0;
                    break;
                case 'distance':
                    aVal = a.distance || 0;
                    bVal = b.distance || 0;
                    break;
                case 'time':
                    aVal = a.moving_time || 0;
                    bVal = b.moving_time || 0;
                    break;
                case 'speed':
                    aVal = a.distance && a.moving_time ? a.distance / a.moving_time : 0;
                    bVal = b.distance && b.moving_time ? b.distance / b.moving_time : 0;
                    break;
                case 'elevation':
                    aVal = a.total_elevation_gain || 0;
                    bVal = b.total_elevation_gain || 0;
                    break;
            }
            return tableSort.asc ? aVal - bVal : bVal - aVal;
        });
    }

    // Calculate totals - perform only one loop over the data
    const totals = sorted.reduce((sum, a) => {
        return {
            distance:    sum.distance    + (a.distance || 0),
            moving_time: sum.moving_time + (a.moving_time || 0),
            elevation:   sum.elevation   + (a.total_elevation_gain || 0)
        };
    }, { distance: 0, moving_time: 0, elevation: 0 });

    const totalDistanceDisplay  = totals.distance    ? (totals.distance / 1000).toFixed(2) + ' km' : 'N/A';
    const avgSpeedDisplay       = (totals.distance && totals.moving_time)
        ? ((totals.distance / 1000) / (totals.moving_time / 3600)).toFixed(2) + ' km/h' : 'N/A';
    const totalElevationDisplay = totals.elevation   ? totals.elevation.toFixed(0) + ' m' : 'N/A';
    const totalTimeDisplay      = totals.moving_time ? formatDuration(totals.moving_time) : 'N/A';

    // Set table styles once
    elements.tableView.style.position   = 'relative';
    elements.tableView.style.overflowX  = 'auto';
    elements.tableView.style.overflowY  = 'visible';
    elements.tableView.style.maxHeight  = 'none';
    elements.tableView.style.paddingBottom = '0';
    elements.tableView.style.marginLeft = 'auto';
    elements.tableView.style.marginRight = 'auto';

    // Build table header with sort indicators
    const getSortIcon = column => {
        if (tableSort.column !== column) return '';
        return `<span style='font-size:0.9em;'>${tableSort.asc ? '▲' : '▼'}</span>`;
    };

    const getSortableColumnProps = column => {
        let ariaSort = 'none';
        if (tableSort.column === column) {
            ariaSort = tableSort.asc ? 'ascending' : 'descending';
        }
        return `role="button" aria-sort="${ariaSort}"`;
    };

    const tableHeader = `
        <thead>
            <tr>
                <th style="${tableCellStyle}">#</th>
                <th class="ride-name-col" style="${tableCellStyleLeft}">Ride Name</th>
                <th class="date-col" id="sort-date" ${getSortableColumnProps('date')} style="${tableCellStyleLeft};cursor:pointer;user-select:none;white-space:nowrap;">📅 Date ${getSortIcon('date')}</th>
                <th class="distance-col" id="sort-distance" ${getSortableColumnProps('distance')} style="${tableCellStyleLeft};cursor:pointer;user-select:none;white-space:nowrap;">🚴 Distance ${getSortIcon('distance')}</th>
                <th class="time-col" id="sort-time" ${getSortableColumnProps('time')} style="${tableCellStyleLeft};cursor:pointer;user-select:none;white-space:nowrap;">⏱️ Time ${getSortIcon('time')}</th>
                <th class="speed-col" id="sort-speed" ${getSortableColumnProps('speed')} style="${tableCellStyleLeft};cursor:pointer;user-select:none;white-space:nowrap;">⚡ Speed ${getSortIcon('speed')}</th>
                <th class="elevation-col" id="sort-elevation" ${getSortableColumnProps('elevation')} style="${tableCellStyleLeft};cursor:pointer;user-select:none;white-space:nowrap;">⛰️ Elevation ${getSortIcon('elevation')}</th>
            </tr>
        </thead>
    `;

    // Build table rows
    const tableRows = sorted.map((a, i) => {
        const { distance, time, speed, elevation, date } = formatActivityMeta(a);
        return `<tr>
            <td style="${tableCellStyle}">${i + 1}</td>
            <td class="ride-name-col" style="${tableCellStyleNoWrapLeft}"><a href="https://www.strava.com/activities/${a.id}" target="_blank" rel="noopener">${a.name}</a></td>
            <td class="date-col" style="${tableCellStyleNoWrap}">${date}</td>
            <td class="distance-col" style="${tableCellStyleNoWrap}">${distance}</td>
            <td class="time-col" style="${tableCellStyleNoWrap}">${time}</td>
            <td class="speed-col" style="${tableCellStyleNoWrap}">${speed}</td>
            <td class="elevation-col" style="${tableCellStyleNoWrap}">${elevation}</td>
        </tr>`;
    }).join('');

    // Build table footer with totals
    const tableFooter = `
        <tr>
            <td style="${tableCellStyle};font-weight:bold;"></td>
            <td class="ride-name-col" style="${tableCellStyle};font-weight:bold;">Total</td>
            <td class="date-col" style="${tableCellStyle};font-weight:bold;"></td>
            <td class="distance-col" style="${tableCellStyleNoWrap};font-weight:bold;">${totalDistanceDisplay}</td>
            <td class="time-col" style="${tableCellStyleNoWrap};font-weight:bold;">${totalTimeDisplay}</td>
            <td class="speed-col" style="${tableCellStyleNoWrap};font-weight:bold;">${avgSpeedDisplay}</td>
            <td class="elevation-col" style="${tableCellStyleNoWrap};font-weight:bold;">${totalElevationDisplay}</td>
        </tr>
    `;

    // Combine all parts into final HTML
    elements.tableView.innerHTML = `
        <div style="margin:0 auto;width:100%;">
            <div>
                <table style="width:100%;border-collapse:collapse;margin:0 auto;">
                    ${tableHeader}
                    <tbody>
                        ${tableRows}
                        ${tableFooter}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Add sorting event listeners
    const handleSortClick = column => {
        if (tableSort.column === column) {
            tableSort.asc = !tableSort.asc;
        } else {
            tableSort.column = column;
            tableSort.asc = false;
        }
        renderTableView();
    };

    document.getElementById('sort-distance').onclick  = () => handleSortClick('distance');
    document.getElementById('sort-time').onclick      = () => handleSortClick('time');
    document.getElementById('sort-speed').onclick     = () => handleSortClick('speed');
    document.getElementById('sort-elevation').onclick = () => handleSortClick('elevation');
    document.getElementById('sort-date').onclick      = () => handleSortClick('date');
}

// ---------------------------------------------------------------------------
// Card view
// ---------------------------------------------------------------------------

// Render the card view for activities
/**
 * @param {Activity[]} activities
 */
function renderCardView(activities) {
    if (!activities || activities.length === 0) {
        elements.activities.innerHTML = '<p>No activities found for this challenge.</p>';
        return;
    }

    elements.activities.innerHTML = activities.map(a => {
        const { distance, time, speed, elevation } = formatActivityMeta(a);
        return `
        <a class="activity" href="https://www.strava.com/activities/${a.id}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;display:block;">
            <strong>${a.name}</strong>
            ${a.start_date ? `<em>${formatDate(a.start_date)}</em>` : ''}
            <span class="description">${a.description || ''}</span>
            <div class="activity-meta">
                <span class="distance">🚴 ${distance}</span>
                <span class="time">⏱️ ${time}</span>
                <span class="speed">⚡ ${speed}</span>
                <span class="elevation">⛰️ ${elevation}</span>
            </div>
        </a>
        `;
    }).join('');
}

// ---------------------------------------------------------------------------
// Heatmap view
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Calendar tooltip (body-level, never clipped by ancestors)
// ---------------------------------------------------------------------------

const _calTooltip = (() => {
    const el = document.createElement('div');
    el.className = 'heatmap-tooltip';
    el.style.display = 'none';
    document.body.appendChild(el);

    document.addEventListener('mousemove', e => {
        if (el.style.display === 'none') return;
        el.style.left = (e.clientX + 12) + 'px';
        el.style.top  = (e.clientY + 12) + 'px';
    });

    return {
        show(text) { el.textContent = text; el.style.display = 'block'; },
        hide()     { el.style.display = 'none'; }
    };
})();

/**
 * Render the heatmap view: route map + stats row + distance calendar.
 * @param {Activity[]} activities
 */
function renderHeatmapView(activities) {
    const section = elements.heatmapView;
    if (!section) return;

    // Read the current challenge gradient colours from CSS variables
    const style = getComputedStyle(document.documentElement);
    const gradientTo = style.getPropertyValue('--gradient-to').trim() || '#40916c';

    // ── Build static HTML skeleton ──────────────────────────────────────
    section.innerHTML = `
        <div id="heatmap-map"></div>
        <div class="heatmap-stats">
            ${buildStatsHTML(activities)}
        </div>
        <div class="heatmap-calendar">
            <div class="heatmap-calendar__heading">Distance Calendar</div>
            ${buildCalendarHTML(activities)}
        </div>
    `;

    // ── Calendar tooltip via event delegation ───────────────────────────
    const calendarEl = section.querySelector('.heatmap-calendar__grid');
    if (calendarEl) {
        calendarEl.addEventListener('mouseover', e => {
            const cell = e.target.closest('.heatmap-calendar__cell[data-tooltip]');
            if (cell) _calTooltip.show(cell.dataset.tooltip);
        });
        calendarEl.addEventListener('mouseleave', () => _calTooltip.hide());
    }

    // ── Initialise or reinitialise Leaflet map ──────────────────────────
    if (leafletMap) {
        leafletMap.remove();
        leafletMap = null;
        routeLayerGroup = null;
    }

    leafletMap = L.map('heatmap-map');

    L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }
    ).addTo(leafletMap);

    routeLayerGroup = L.layerGroup().addTo(leafletMap);

    const allBounds = [];

    activities.forEach(a => {
        const polyline = a.map?.summary_polyline;
        if (!polyline) return;
        const coords = decodePolyline(polyline);
        if (coords.length === 0) return;

        const line = L.polyline(coords, {
            color: gradientTo,
            opacity: 0.7,
            weight: 2.5
        });

        const distKm = a.distance ? (a.distance / 1000).toFixed(2) + ' km' : 'N/A';
        const tooltipEl = document.createElement('div');
        const strong = tooltipEl.appendChild(document.createElement('strong'));
        strong.textContent = a.name;
        tooltipEl.appendChild(document.createTextNode(' - ' + distKm));
        line.bindTooltip(tooltipEl, { sticky: true });
        line.addTo(routeLayerGroup);
        allBounds.push(...coords);
    });

    if (allBounds.length > 0) {
        leafletMap.fitBounds(L.latLngBounds(allBounds), { padding: [20, 20] });
    } else {
        // Fallback centre if no polylines available
        leafletMap.setView([51.505, -0.09], 10);
    }

    // Allow the browser to apply CSS to the freshly-injected #heatmap-map
    // element before Leaflet recalculates its container size.
    requestAnimationFrame(() => {
        if (leafletMap) {
            leafletMap.invalidateSize();
            if (allBounds.length > 0) {
                leafletMap.fitBounds(L.latLngBounds(allBounds), { padding: [20, 20] });
            }
        }
    });
}

/**
 * Build the four stats summary cells HTML.
 * @param {Activity[]} activities
 * @returns {string}
 */
function buildStatsHTML(activities) {
    const totals = activities.reduce((sum, a) => ({
        distance:    sum.distance    + (a.distance || 0),
        moving_time: sum.moving_time + (a.moving_time || 0),
        elevation:   sum.elevation   + (a.total_elevation_gain || 0)
    }), { distance: 0, moving_time: 0, elevation: 0 });

    const totalKm   = totals.distance ? (totals.distance / 1000).toFixed(1) + ' km' : 'N/A';
    const totalElev = totals.elevation ? totals.elevation.toFixed(0) + ' m' : 'N/A';
    const avgSpeed  = (totals.distance && totals.moving_time)
        ? ((totals.distance / 1000) / (totals.moving_time / 3600)).toFixed(1) + ' km/h'
        : 'N/A';

    return [
        { value: activities.length,  label: 'Rides' },
        { value: totalKm,            label: 'Total Distance' },
        { value: totalElev,          label: 'Total Elevation' },
        { value: avgSpeed,           label: 'Avg Speed' }
    ].map(({ value, label }) => `
        <div class="heatmap-stat">
            <span class="heatmap-stat__value">${value}</span>
            <span class="heatmap-stat__label">${label}</span>
        </div>
    `).join('');
}

/**
 * Build the distance calendar grid HTML.
 * @param {Activity[]} activities
 * @returns {string}
 */
function buildCalendarHTML(activities) {
    if (activities.length === 0) return '<p style="color:var(--text-secondary)">No rides to display.</p>';

    // Build a map of ISO date string -> distance in metres
    /** @type {Map<string, number>} */
    const rideByDate = new Map();
    activities.forEach(a => {
        if (!a.start_date_local) return;
        const dateKey = a.start_date_local.slice(0, 10); // 'YYYY-MM-DD'
        rideByDate.set(dateKey, (rideByDate.get(dateKey) || 0) + (a.distance || 0));
    });

    if (rideByDate.size === 0) return '<p style="color:var(--text-secondary)">No date data available.</p>';

    // Determine date range: first Monday on or before first ride, to last ride
    const sortedDates = [...rideByDate.keys()].sort((a, b) => a.localeCompare(b));
    const firstDate = new Date(sortedDates[0] + 'T00:00:00');
    const lastDate  = new Date(sortedDates.at(-1) + 'T00:00:00');

    // Snap firstDate back to Monday (day 1; Sunday = 0)
    const startDay = new Date(firstDate);
    const dow = startDay.getDay(); // 0=Sun,1=Mon,...
    startDay.setDate(startDay.getDate() - ((dow + 6) % 7)); // roll back to Monday

    const maxDist = Math.max(...rideByDate.values());

    // Collect weeks of cells
    const weeks = [];
    let week = [];

    const _padDate = n => String(n).padStart(2, '0');
    const msPerDay  = 86400000;
    // Use setDate-based iteration anchored to startDay to avoid DST
    // millisecond drift (days are not always exactly 86400000ms).
    const totalDays = Math.round((lastDate.getTime() - startDay.getTime()) / msPerDay) + 1;

    for (let day = 0; day < totalDays; day++) {
        const d = new Date(startDay);
        d.setDate(startDay.getDate() + day);
        const key = `${d.getFullYear()}-${_padDate(d.getMonth() + 1)}-${_padDate(d.getDate())}`;
        const dist = rideByDate.get(key) || 0;
        week.push({ key, dist });
        if (week.length === 7) {
            weeks.push(week);
            week = [];
        }
    }
    // Push the final partial week if any
    if (week.length > 0) {
        while (week.length < 7) week.push({ key: null, dist: 0 });
        weeks.push(week);
    }

    // Build CSS gradient colour for a cell based on distance intensity
    const cellStyle = (dist) => {
        if (dist === 0) return ''; // uses CSS default
        const intensity = dist / maxDist; // 0.0 - 1.0
        return `style="background:var(--gradient-to);opacity:${(0.2 + intensity * 0.8).toFixed(2)}"`;
    };

    const cellTitle = (key, dist) => {
        if (!key) return '';
        const label = dist > 0 ? `${key}: ${(dist / 1000).toFixed(1)} km` : key;
        return `data-tooltip="${label}" aria-label="${label}"`;
    };

    // Month labels: record which week each month first appears in
    const monthLabels = new Array(weeks.length).fill('');
    let lastMonth = -1;
    weeks.forEach((w, wi) => {
        const firstValidCell = w.find(c => c.key);
        if (firstValidCell) {
            const m = new Date(firstValidCell.key + 'T00:00:00').getMonth();
            if (m !== lastMonth) {
                const labelDate = new Date(firstValidCell.key + 'T00:00:00');
                const yr = String(labelDate.getFullYear()).slice(-2);
                monthLabels[wi] = labelDate.toLocaleString('default', { month: 'short' }) + ' ' + yr;
                lastMonth = m;
            }
        }
    });

    const monthRow = `
        <div class="heatmap-calendar__months">
            ${weeks.map((_, wi) => `<div class="heatmap-calendar__month-label" style="width:${13 + 3}px;overflow:visible;white-space:nowrap;">${monthLabels[wi]}</div>`).join('')}
        </div>
    `;

    const gridHTML = `
        <div class="heatmap-calendar__grid">
            ${weeks.map(w => `
                <div class="heatmap-calendar__week">
                    ${w.map(({ key, dist }) => `
                        <div class="heatmap-calendar__cell" ${key ? cellTitle(key, dist) : ''} ${cellStyle(dist)}></div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;

    const legendHTML = `
        <div class="heatmap-calendar__legend">
            <span>Less</span>
            <div class="heatmap-calendar__legend-cell" style="background:var(--gradient-from);opacity:0.3"></div>
            <div class="heatmap-calendar__legend-cell" style="background:var(--gradient-to);opacity:0.35"></div>
            <div class="heatmap-calendar__legend-cell" style="background:var(--gradient-to);opacity:0.55"></div>
            <div class="heatmap-calendar__legend-cell" style="background:var(--gradient-to);opacity:0.75"></div>
            <div class="heatmap-calendar__legend-cell" style="background:var(--gradient-to);opacity:1.0"></div>
            <span>More</span>
        </div>
    `;

    return monthRow + gridHTML + legendHTML;
}

// ---------------------------------------------------------------------------
// View switching (card / table / heatmap)
// ---------------------------------------------------------------------------

/**
 * Switch to a named view mode and persist the preference.
 * @param {'card'|'table'|'heatmap'} mode
 */
function switchView(mode) {
    // Show/hide sections
    elements.activities.style.display  = mode === 'card'    ? 'grid'  : 'none';
    elements.tableView.style.display   = mode === 'table'   ? 'block' : 'none';
    elements.heatmapView.style.display = mode === 'heatmap' ? 'block' : 'none';

    // Update active button state
    elements.btnCard.classList.toggle('active',    mode === 'card');
    elements.btnTable.classList.toggle('active',   mode === 'table');
    elements.btnHeatmap.classList.toggle('active', mode === 'heatmap');

    // Render the selected view
    if (mode === 'card') {
        renderCardView(activitiesData);
    } else if (mode === 'table') {
        renderTableView();
    } else if (mode === 'heatmap') {
        renderHeatmapView(activitiesData);
    }

    localStorage.setItem('viewMode', mode);
}

elements.btnCard.addEventListener('click',    () => switchView('card'));
elements.btnTable.addEventListener('click',   () => switchView('table'));
elements.btnHeatmap.addEventListener('click', () => switchView('heatmap'));
const memoCache = {
    formatDate:     new Map(),
    formatDuration: new Map(),
    calcSpeed:      new Map()
};

// ---------------------------------------------------------------------------
// Polyline decoder
// ---------------------------------------------------------------------------

/**
 * Decode a Google encoded polyline string into an array of [lat, lng] pairs.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * @param {string} encoded
 * @returns {[number, number][]}
 */
function decodePolyline(encoded) {
    const result = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let shift = 0, result_val = 0, b;
        do {
            b = encoded.codePointAt(index++) - 63;
            result_val |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += (result_val & 1) ? ~(result_val >> 1) : (result_val >> 1);

        shift = 0; result_val = 0;
        do {
            b = encoded.codePointAt(index++) - 63;
            result_val |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += (result_val & 1) ? ~(result_val >> 1) : (result_val >> 1);

        result.push([lat / 1e5, lng / 1e5]);
    }
    return result;
}

// Memoized formatting functions
function formatDuration(seconds) {
    if (seconds === undefined || seconds === null) return 'N/A';
    const cacheKey = seconds.toString();
    if (memoCache.formatDuration.has(cacheKey)) return memoCache.formatDuration.get(cacheKey);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const result = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
    memoCache.formatDuration.set(cacheKey, result);
    return result;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    if (memoCache.formatDate.has(dateStr)) return memoCache.formatDate.get(dateStr);
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    const daySuffix = (d) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    const result = `${day}${daySuffix(day)} ${month} ${year}`;
    memoCache.formatDate.set(dateStr, result);
    return result;
}

function calcSpeed(distance, moving_time) {
    // distance in meters, moving_time in seconds
    if (!distance || !moving_time) return 'N/A';
    const cacheKey = `${distance}-${moving_time}`;
    if (memoCache.calcSpeed.has(cacheKey)) return memoCache.calcSpeed.get(cacheKey);
    const speed = (distance / 1000) / (moving_time / 3600); // km/h
    const result = speed.toFixed(2);
    memoCache.calcSpeed.set(cacheKey, result);
    return result;
}

/** @type {import('leaflet').Map|null} */
let leafletMap = null;
/** @type {import('leaflet').LayerGroup|null} */
let routeLayerGroup = null;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

try {
    const res = await fetch('./challenges.json');
    if (!res.ok) throw new Error(`Failed to load challenges: ${res.status}`);
    const json = await res.json();
    CHALLENGES = Array.isArray(json) ? json : [];
} catch (err) {
    console.error('Could not load challenges.json:', err);
    CHALLENGES = [];
}

if (CHALLENGES.length === 0) {
    elements.homeScreen.textContent = 'No challenges available.';
    showView('home');
} else {
    renderHomeScreen();
    router();
}
