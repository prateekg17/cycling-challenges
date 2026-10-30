# Prateek's Cycling Challenges - GitHub Pages

This directory contains the static site for Prateek's Cycling Challenges.

## Files
- `index.html` - Main page
- `script.ts`, `challenge-tile.ts` - Frontend logic, compiled to browser JavaScript by `npm run build:frontend`
- `css/` - CSS modules (base, home, header, cards, table, footer)
- `activities-terminus.json` - Data file (updated weekly by GitHub Action)
- Other assets (images, etc.)

The site is automatically deployed to GitHub Pages when the activities data is updated.

Run `npm run build:frontend` from the repository root to generate the deployable site
in `dist/site/`, then serve that directory for local previews. Rebuild after edits.
Generated JavaScript stays outside this source directory so tests use TypeScript sources.