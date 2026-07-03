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
const CHALLENGES = [
    {
        slug:        'terminus',
        name:        'Tube Terminus Challenge',
        description: 'Cycle to all 33 London Underground terminus stations from home',
        dataFile:    'activities-terminus.json',
        gradient:    ['#1b4332', '#40916c'],
        total:       33,
    },
];

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
    toggleBtn:        document.getElementById('toggle-table-view'),
    activities:       document.getElementById('activities'),
    tableView:        document.getElementById('table-view'),
    viewToggle:       document.querySelector('.view-toggle'),
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
        <p class="home-challenges-label">My Challenges</p>
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
                        <div class="challenge-tile__progress-fill" style="width:0%;"></div>
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
        showView('home');
        return;
    }

    // Show challenge detail
    showView('challenge');
    elements.detailTitle.textContent = challenge.name;

    // Cancel any in-flight fetch from a previous navigation
    if (currentFetchController) {
        currentFetchController.abort();
        currentFetchController = null;
    }

    // Reset data state and reload for this challenge
    activitiesData = [];
    tableSort = { column: null, asc: true };
    tableVisible = false;
    elements.activities.innerHTML = '';
    elements.tableView.innerHTML = '';
    elements.activities.style.display = 'none';
    elements.tableView.style.display = 'none';
    elements.viewToggle.style.display = ''; // clear any leftover inline style; parent hidden attr controls visibility

    void fetchActivities(challenge.dataFile);
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
    elements.viewToggle.style.display = '';    // remove any inline override; parent is already visible
    elements.toggleBtn.style.display = '';
}

/**
 * Fetch and render activities for one challenge.
 * @param {string} dataFile - Filename inside static/ e.g. 'activities-terminus.json'
 */
async function fetchActivities(dataFile) {
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

        if (activities.length === 0) {
            elements.activities.innerHTML = '<p>No activities found for this challenge.</p>';
            elements.toggleBtn.style.display = 'none'; // no activities, hide the toggle button
            elements.activities.style.display = 'grid';
            return;
        }

        renderCardView(activities);

        const viewMode = localStorage.getItem('viewMode');
        if (viewMode === 'table') {
            elements.activities.style.display = 'none';
            elements.tableView.style.display = 'block';
            elements.toggleBtn.textContent = TOGGLE_VIEW_LABELS.card;
            renderTableView();
            tableVisible = true;
        } else {
            elements.activities.style.display = 'grid';
            elements.tableView.style.display = 'none';
            elements.toggleBtn.textContent = TOGGLE_VIEW_LABELS.table;
            tableVisible = false;
        }

    } catch (error) {
        if (error.name === 'AbortError') return; // navigation cancelled this fetch
        console.error('Error loading activities:', error);
        elements.activities.innerHTML = '<p>Error loading activities. Please try again later.</p>';
        elements.activities.style.display = 'grid';
        elements.toggleBtn.style.display = 'none'; // hide toggle on error
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
            <tr style="background:#e6f6fb;">
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
            <td class="ride-name-col" style="${tableCellStyleNoWrapLeft}"><a href="https://www.strava.com/activities/${a.id}" target="_blank" rel="noopener" style="color:#0019a8;text-decoration:underline;">${a.name}</a></td>
            <td class="date-col" style="${tableCellStyleNoWrap}">${date}</td>
            <td class="distance-col" style="${tableCellStyleNoWrap}">${distance}</td>
            <td class="time-col" style="${tableCellStyleNoWrap}">${time}</td>
            <td class="speed-col" style="${tableCellStyleNoWrap}">${speed}</td>
            <td class="elevation-col" style="${tableCellStyleNoWrap}">${elevation}</td>
        </tr>`;
    }).join('');

    // Build table footer with totals
    const tableFooter = `
        <tr style="background:#f5f5f5;">
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
                <table style="width:100%;border-collapse:collapse;background:#fff;margin:0 auto;">
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
// View toggle (card <-> table)
// ---------------------------------------------------------------------------

// Centralise toggle button labels
const TOGGLE_VIEW_LABELS = {
    card:  'See Card View',
    table: 'See Tabular View'
};

// Memoization cache for expensive calculations
const memoCache = {
    formatDate:     new Map(),
    formatDuration: new Map(),
    calcSpeed:      new Map()
};

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

let tableVisible = false;

// Toggle between card and table view
function toggleView() {
    tableVisible = !tableVisible;

    // Update view visibility using direct style manipulation
    if (tableVisible) {
        elements.activities.style.display = 'none';
        elements.tableView.style.display = 'block';
        renderTableView(); // Render the table view when switching to it
    } else {
        elements.activities.style.display = 'grid';
        elements.tableView.style.display = 'none';
    }

    // Update button text
    elements.toggleBtn.textContent = tableVisible ? TOGGLE_VIEW_LABELS.card : TOGGLE_VIEW_LABELS.table;

    // Save preference to localStorage
    localStorage.setItem('viewMode', tableVisible ? 'table' : 'card');
}

elements.toggleBtn.addEventListener('click', toggleView);

// Set initial button label on page load
const initialViewMode = localStorage.getItem('viewMode');
elements.toggleBtn.textContent = initialViewMode === 'table' ? TOGGLE_VIEW_LABELS.card : TOGGLE_VIEW_LABELS.table;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

renderHomeScreen();
router();
