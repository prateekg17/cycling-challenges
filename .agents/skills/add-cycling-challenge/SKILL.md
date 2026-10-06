---
name: add-cycling-challenge
description: Add a keyword-based cycling challenge to this repository from a plain-language idea. Explicitly confirm the Strava keyword, infer the description and technical filenames, show two visual color previews, and get approval before editing challenge files.
---

# Add a cycling challenge

Help someone add a challenge without needing to understand this project.
Use plain language in questions; handle the repository details yourself.

## Read the current implementation

Read these files before proposing changes:

- `README.md` for setup and deployment.
- `static/challenges.json` for existing challenges and naming conventions.
- `scripts/fetch-activities.ts` for the config type and matching behavior.
- `static/script.js` for routing, tile markup, progress, and theme usage.
- `static/challenge-tile.js` for safe challenge tile rendering.
- `static/css/base.css` and `static/css/home.css` for the visual preview.
- `package.json` for available validation commands.

The shared config defines `slug`, `name`, `description`, `dataFile`, `gradient`,
`targetRideCount`, `filterKeyword`, and `startDate`. Both the fetcher and frontend already
support multiple challenges; a normal addition needs no application code changes.

## Gather the essentials

Start from the user's plain-language idea. Ask one question at a time, using an
interactive question tool when available.

1. If the idea is missing, ask what the user wants to achieve.
2. **Always explicitly ask for the exact Strava keyword.** If the user already
   supplied one, ask them to confirm it. Do not silently infer or accept a keyword.
   Explain that the site matches a case-insensitive substring in activity names
   or descriptions, so the user must put this wording in qualifying activities.
   Reject empty or whitespace-only keywords and warn about overly broad wording.
3. Establish the target number of qualifying rides and the start date. Reuse
   details already supplied; ask only for missing or ambiguous information.
   `targetRideCount` must be a positive integer. Do not treat a distance goal as a ride count.
   Resolve ambiguous dates and the intended timezone before producing an ISO
   timestamp with an explicit offset, such as `2026-10-01T00:00:00Z`.

Each matching activity counts once toward progress, not each unique destination.
The code does not verify locations, routes, or completion rules described in prose.
It has no challenge-specific end date, sport filter, distance goal, or lifecycle
status. If the idea requires those capabilities, explain the limitation and ask
whether the user wants a supported ride-count challenge instead. Do not silently
extend the application as part of this skill.

## Infer the remaining fields

- Draft a concise name and description reflecting only the user's stated goal.
  Do not invent rules such as "from home and back" or "one ride per destination."
- Derive a lowercase kebab-case `slug` from the name. Ensure it is unique.
- Derive `dataFile` as `activities-<slug>.json`. Ensure it is unique and does not
  overwrite an existing file. Keep it a plain filename inside `static/`.
- Suggest **two** distinct two-color gradients based on the challenge's theme,
  using `#RRGGBB` values. Choose backgrounds that keep the existing light tile
  text readable and an accent visible against the site's dark surfaces.
- Preserve the explicitly confirmed keyword; do not substitute the inferred slug.

Explain the derived slug and filename in the proposal so the user knows the URL
and data file, without having to choose them manually.

## Show a visual proposal before editing

Show both color options as actual rendered challenge tiles, not just hex codes.
Reuse `createChallengeTile()` from `static/challenge-tile.js` and the site CSS
when serving a local preview, or reproduce its fixed markup and safe DOM assignments
for a standalone preview. Set display text with `textContent`, attributes with
`setAttribute`/DOM properties, and colors with `style` properties. Never interpolate
user-derived values into HTML markup, inline event handlers, or executable scripts;
JSON encoding alone does not make values safe to embed in HTML. Treat names and
descriptions as plain text, preserving quotes, apostrophes, and HTML-like wording.
Show the proposed name, description, and `0 / <targetRideCount> rides` progress.
Label each option and display its two hex colors outside the tile. Explain that
the chosen colors also tint cards, tables, map routes, and the distance calendar.
The zero count is a placeholder, not a prediction of existing Strava matches.

Use an available browser/HTML preview surface. If a local preview file is needed,
put it in session artifacts or temporary storage outside the repository and serve
it locally with access to the current site CSS. Do not change `challenges.json`
or create the activity file just to preview. Do not send repository content to
external preview services. If no rendering surface is available, provide a local
HTML preview the user can open; never describe an unrendered example as a visual
preview the user has already seen.

Alongside the tiles, show the proposed configuration, including:

- Name, inferred description, slug, and URL fragment (`#<slug>`).
- Activity filename and the explicitly confirmed keyword.
- Target ride count and start timestamp with its timezone.
- Both gradient options and the recommended option.

Ask the user to select and approve a preview, with choices such as "Approve option
1", "Approve option 2", and "Revise the proposal". Approval must cover the
configuration as well as the colors. Revise and obtain fresh approval if any
proposed value changes. **Do not modify repository files before approval.**

## Apply only the approved addition

Re-read the config and check the working tree before editing so concurrent or
uncommitted work is preserved. Recheck slug and filename collisions; if the
approved proposal now conflicts, propose a replacement and obtain fresh approval.

1. Append the approved object to `static/challenges.json`, preserving all existing
   entries and its formatting.
2. Create `static/<dataFile>` containing `[]`, following the repository's placeholder
   convention. Never fabricate Strava activities or overwrite existing activity data.
3. Change no frontend code, workflow, credentials, or unrelated documentation.

## Validate and hand off

Parse the updated JSON and verify the exact approved values, all eight fields,
unique slugs and data filenames across the config, a positive integer target,
a nonempty keyword, a valid explicitly zoned timestamp, and exactly two hex colors.
Check that the preview renders the proposed name and description literally as
text, including any quotes or HTML-like content, rather than interpreting markup.
Verify the new activity file parses as an empty array and all pre-existing
challenge entries and files remain unchanged.

Run `npm test` and `npm run build`. Report failures accurately; do not present a
successful build as proof that matching Strava data exists. Do not run
`npm run fetch-activities`: it needs credentials and overwrites activity files.
Preview the resulting tile and its empty detail view locally when a browser is
available. Review the diff to ensure only the approved config and placeholder
were added, and clean up preview helpers started for this task.

Summarize the added challenge, confirmed keyword, inferred slug and filename,
selected colors, and start date. Explain that activities populate after the
fetch/deploy workflow runs. The workflow runs on a push to `main`, its schedule,
or manual dispatch; its generated data goes into the deployment artifact rather
than being committed back to the repository.

Do not commit, push, open a PR, or trigger a workflow unless explicitly requested.
