# Course Catalog Search — Internal Tool

A static, no-build search tool for the HAZWOPER OSHA Training course catalog. Built from
`ICTrainingUS_reviewed.xlsx` (Master Catalog, Bundles Overview, Bundle Contents Detail).

## Run locally

```bash
python3 -m http.server 8811
```

Then open `http://localhost:8811`.

## Deploy to GitHub Pages

1. Push this folder's contents to a GitHub repo (or a `docs/` folder / `gh-pages` branch).
2. In the repo settings, enable **Pages** and point it at the branch/folder containing
   `index.html`.
3. No build step needed — it's plain HTML/CSS/JS.

## Updating the course data

The catalog lives in `assets/data.js`, generated from the source spreadsheet. To refresh it
after the spreadsheet changes, re-run the extraction script (ask Claude to regenerate
`assets/data.js` from the latest `.xlsx`, or reuse the extraction logic: reads the "Master
Catalog", "Bundles Overview", and "Bundle Contents Detail" sheets and writes `COURSES`,
`BUNDLES`, `BUNDLE_CONTENTS`, `INDUSTRIES`, and `CATEGORIES` as JS constants).

## "Add Course" feature — important limitation

The **+ Add Course** button lets reps add courses that aren't yet in the spreadsheet. These are
saved to **that browser's `localStorage` only** — this is a static site with no backend/database,
so custom courses:

- Persist across reloads in the same browser
- Are **not shared** with other users or devices
- Are marked with a "Custom" badge and can be deleted from their detail view

If you need custom entries to be visible to your whole team, add them to the source spreadsheet
and regenerate `assets/data.js` instead.

## Search behavior

- **Text search** — matches course name, category, course family, and primary industries.
- **Industry filter** — filters by the 20 "By Industry" bundle tags assigned to each course.
- **Bundle filter** — grouped by the catalog's two bundle types (*By Industry* / *By Category*).
  Selecting a bundle switches the results to that bundle's contents, with a summary card
  (price tier, seat price, savings %).
- **List / Grid toggle** — list view supports inline row expansion; grid view opens a detail
  modal on click. Preference is remembered per browser.
