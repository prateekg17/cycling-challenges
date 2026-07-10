# Prateek's Cycling Challenges

A GitHub Pages static site that tracks personal cycling challenges. The site automatically updates weekly with new Strava activities via a scheduled GitHub Action.

The site supports multiple cycling challenges. Currently active: the Tube Terminus Challenge - cycling to and from all 33 terminus stations on the London Underground network from home.

There are a total of 33 such Tube stations spread across the following lines:
- District Line
- Piccadilly Line
- Central Line
- Hammersmith & City Line
- Bakerloo Line
- Circle Line
- Jubilee Line
- Victoria Line
- Northern Line
- Metropolitan Line
- Waterloo & City Line

The site features automated data fetching, parallel API calls, and an interactive web UI with no authentication required.

## Features
- **Automated weekly updates** via GitHub Actions (every Saturday and Sunday at 20:00 GMT)
- **Static site** hosted on GitHub Pages - no server required
- Fetches activities from Strava API with pre-configured authentication
- Filters activities by the challenge start date and keyword defined in `static/challenges.json`
- Parallel fetching of activity pages for faster data collection
- Interactive web UI with card and table views
- **Follow Me on Strava** badge in header
- **No user authentication required** - data is pre-fetched and served statically
- **Unit tests** (Vitest) for core data logic and API helper functions
- **CI workflow** runs tests automatically on pull requests
- **Concurrency control** prevents overlapping update/deploy runs

## Architecture
- **Frontend**: Static HTML/CSS/JavaScript served via GitHub Pages
- **Data Source**: Weekly GitHub Action fetches Strava data and generates a per-challenge activities JSON file
- **Challenge Config**: `static/challenges.json` is the single source of truth - read by the backend fetcher and served to the frontend
- **Deployment**: Automatic GitHub Pages deployment after data updates
- **Filtering Logic**: TypeScript script that reads `static/challenges.json` and filters activities per challenge by date and keyword
- **Testing**: Vitest for deterministic unit tests (fetch mocked)

## Requirements
- Node.js 20+ (local + GitHub Actions) – project uses native ESM (`"type": "module"`) and `NodeNext` module resolution
- GitHub repository with Pages enabled
- Strava API credentials:
    - `STRAVA_CLIENT_ID` (GitHub Actions Variable)
    - `STRAVA_CLIENT_SECRET` (Secret)
    - `STRAVA_REFRESH_TOKEN` (Secret)

## Setup

### For GitHub Pages Deployment
1. **Fork/Clone the repository**
2. **Enable GitHub Pages** in repository settings (source: GitHub Actions)
3. **Set up Strava API credentials** in GitHub Secrets and Variables:
   - Settings → Secrets and variables → Actions
   - Add Variable: `STRAVA_CLIENT_ID`
   - Add Secrets: `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`
   - [How to obtain credentials](https://developers.strava.com/docs/getting-started/#account)
4. **Trigger the workflow**:
   - Manual: Actions → "Update Strava Activities" → Run workflow
   - Automatic: Every Sunday at 23:00 GMT

### For Local Development
1. Clone repository:
   ```sh
   git clone <repo-url>
   cd tube-cycling-challenge
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. (Optional for full fetch) Export environment variables:
   ```sh
   export STRAVA_CLIENT_ID=your_client_id
   export STRAVA_CLIENT_SECRET=your_client_secret
   export STRAVA_REFRESH_TOKEN=your_refresh_token
   ```
4. Fetch activities & build:
   ```sh
   npm run fetch-activities
   ```
5. Serve locally:
   ```sh
   npx serve static -l 8080
   # or
   (cd static && python3 -m http.server 8080)
   ```
6. Open: http://localhost:8080

### Running Tests
Tests mock network I/O and do not require Strava credentials.
```sh
npm test
```
To run in watch mode:
```sh
npx vitest
```

## Continuous Integration (CI)
- **Workflow**: `.github/workflows/test.yaml` runs on pull requests (open, reopen, synchronize, label) and executes the Vitest suite.
- **Strava credentials not required** for tests (fetch is mocked).
- **Scheduled fetch & deploy**: `.github/workflows/update-activities.yaml` handles weekly data refresh and Pages deployment.
- **Page deployment artifact name**: `site-static` (contains the entire `static/` directory including `index.html`, images, `challenges.json`, and per-challenge activity JSON files).
- **No duplicate runs**: Concurrency group `update-activities` prevents overlapping scheduled/manual executions.
- The committed per-challenge activity JSON files (e.g. `static/activities-terminus.json`) are placeholders; the workflow overwrites them during the run and ships the updated files inside the deployment artifact.

## User Interface
The web UI has two screens:
- **Challenges home screen**: Themed tiles, one per challenge, showing name, description, and live progress. Clicking a tile navigates to that challenge's detail view.
- **Challenge detail view**: Back link ("<- All Challenges") to return home, challenge name in the header, and the full activity list below.
- **Toggle View Button**: Switch between card and tabular views within a challenge.
- **Card View**: Each activity shows ride name, date, stats, description (if present).
- **Tabular View**: Sortable columns (name, date, distance, time, speed, elevation) with totals/averages.
- **Empty State Message**: Clear message when no activities match the filter.
- **View Persistence**: Preferred view stored in `localStorage`.

## How It Works
1. **Workflow runs** (cron or manual) -> refresh Strava token -> parallel fetch up to 10 pages.
2. **Challenge config**: `static/challenges.json` defines each challenge's `filterKeyword`, `startDate`, and `dataFile`.
3. **Filtering**: For each challenge, only activities after its `startDate` containing its `filterKeyword` in name or description are kept.
4. **Output**: Filtered list written to `static/<dataFile>` (e.g. `activities-terminus.json`) in the runner workspace.
5. **Artifact**: Entire `static` folder uploaded as `site-static`; deployment job publishes it to Pages.
6. **Frontend**: On load, the site fetches `challenges.json` to build the challenges list, then fetches each challenge's activity file to render the UI.

## Configuration
- **Schedule**: Edit cron in `.github/workflows/update-activities.yaml`.
- **Adding a challenge**: Add an entry to `static/challenges.json` with `slug`, `name`, `description`, `dataFile`, `gradient`, `total`, `filterKeyword`, and `startDate`. Commit a placeholder `static/<dataFile>` and trigger the workflow.
- **Keyword filter / start date**: Edit the relevant entry in `static/challenges.json`.
- **Parallelism**: Change `maxPages` in `fetchAllActivities` inside `scripts/fetch-activities.ts` (default 10).
- **Tests**: Add more cases under `scripts/*.test.ts` (Vitest auto-detects by pattern).

## Project Structure
- `.github/workflows/update-activities.yaml` - Scheduled Strava fetch & deploy (artifact: `site-static`)
- `.github/workflows/test.yaml` - PR test CI
- `scripts/fetch-activities.ts` - Strava fetch & processing (ESM / NodeNext); reads `static/challenges.json` for per-challenge config
- `scripts/fetch-activities.test.ts` - Unit tests (Vitest, mocked fetch)
- `static/challenges.json` - Challenge config (single source of truth for both backend and frontend)
- `static/` - Site assets (`index.html`, `css/` (six CSS modules), `script.js`, per-challenge activity JSON files, images)
- `package.json` - Dependencies & scripts
- `tsconfig.json` - TypeScript config (ES2022 target, NodeNext resolution)

## Notes on ESM / NodeNext
- Project uses `"type": "module"` and `"moduleResolution": "NodeNext"`.
- Relative imports in tests use explicit `.js` extensions after compilation (Vitest handles TypeScript transpile in-memory).
- `node-fetch@3` (ESM) is used directly—no downgrade or CommonJS wrapper required.

## License
MIT

## Credits
- [Strava API Documentation](https://developers.strava.com/docs/)
- GitHub Copilot

---
Contributions & suggestions welcome!
