# CLAUDE.md — Course Catalog Search

Internal customer-service tool for HAZWOPER OSHA Training LLC. Static site, no build step,
no backend, no dependencies. Deployed on GitHub Pages at
https://lj-web-management.github.io/hazwoperosha-course-search/ from the `main` branch root.

Repo: https://github.com/LJ-Web-Management/hazwoperosha-course-search

## What this is

A searchable/filterable table+grid of the course catalog, built from
`ICTrainingUS_reviewed.xlsx` (source lives outside this repo, typically in the user's
Downloads). Reps search by course name, industry, or bundle. There is **no add/edit/delete
UI** — the catalog is read-only in the browser. To change course data, edit the spreadsheet
and regenerate `assets/data.js` (see `README.md`).

## File map

```
index.html          shell: header, filter panel, results table+grid, modal, footer
assets/style.css     all styling, brand tokens as CSS custom properties
assets/app.js        all behavior (vanilla JS, one IIFE, no framework)
assets/data.js       generated data — COURSES, BUNDLES, BUNDLE_CONTENTS, INDUSTRIES, CATEGORIES
assets/hazwoper-logo.png   brand logo, copied from the sibling "Automatic Course Creation
                            Program" Next.js project's public/brand/
README.md            spreadsheet → data.js regeneration steps only
```

No `package.json`, no build tool. Editing `assets/app.js` or `assets/style.css` directly is
correct — there is no compiled/transpiled source elsewhere.

## Data model (`assets/data.js`)

Four globals, loaded before `app.js` via `<script src="assets/data.js">`:

- **`COURSES`**: array of ~1034 objects, one per Master Catalog row:
  `{ id, category, family, name, type, regBody, citation, industries, duration, msrp,
  bundleClass, industryTags }`. `industryTags` is an array (split on `;` from the source
  "Industry Bundle Tags" column) — each entry is the *name* of a "By Industry" bundle this
  course belongs to (e.g. `"Construction (General & Commercial) Bundle"`). A course can have
  zero, one, or several tags.

- **`BUNDLES`**: array of 79 objects, one per Bundles Overview row:
  `{ id, type, name, scope, totalCourses, inclFlat, alaCarteAddons, costSeparate, priceTier,
  bundlePrice, savings, alaCarteTerms }`. `type` is `"By Industry"` or `"By Category"`.
  **`id` is `${type}||${name}`, not just `name`** — two bundle names collide across types
  ("Aviation & Aerospace Manufacturing Bundle" and "Manufacturing & Industrial Operations
  Bundle" each exist as both a By Industry and a By Category bundle with the same name and
  different contents). Never key bundles by name alone.

- **`BUNDLE_CONTENTS`**: object keyed by the same `${type}||${name}` id, each value an array of
  `{ name, category, type, duration, msrp, status }` — the courses inside that bundle, from
  Bundle Contents Detail. `status` is free text like `"Included in Flat Bundle Price"` or an
  à-la-carte note; the UI treats anything matching `/Flat/i` as "included" styling.

- **`INDUSTRIES`**: sorted array of the ~20 distinct "By Industry" bundle names — used to
  populate the Industry filter dropdown. This is derived from `BUNDLES`, not a separate source.

- **`CATEGORIES`**: sorted array of the ~59 distinct `category` values from `COURSES`.

Regenerating this file is documented in `README.md` — that's the only doc that should contain
the extraction script, to avoid drifting duplicate copies.

## App behavior (`assets/app.js`)

Single IIFE, `DOMContentLoaded` → `init()`. No modules, no bundler — this is deliberate, keep
it that way unless the hosting story changes.

**Bundle filtering is two separate selects**, `#bundle-industry-select` (By Industry bundles
only) and `#bundle-category-select` (By Category bundles only) — `els.bundleIndustry` /
`els.bundleCategory` in `app.js`. They're mutually exclusive: picking one clears and disables
the other (change handlers in `init()`, plus the disabled-state assignment in `render()`).
`currentFilters().bundleId` resolves to whichever of the two has a value
(`els.bundleIndustry.value || els.bundleCategory.value`). There is intentionally no single
combined "Bundle" dropdown — do not re-merge these into one `<select>` with optgroups without
checking with the user first; that was the previous design and was explicitly changed.

**Two result-set modes**, chosen by whether either bundle select has a value:
- *Catalog mode* (no bundle selected): filters `COURSES` by free-text search (name + category
  + family + industries substring match) AND category select AND industry-tag membership.
- *Bundle mode* (bundle selected): ignores the Category/Industry selects (they're disabled via
  `els.industry.disabled` / `els.category.disabled`) and instead lists `BUNDLE_CONTENTS[bundleId]`,
  filtered by the free-text search against name+category only. A summary card
  (`renderBundleCard`) shows price tier, seat price, à la carte cost, and savings %.

**Two view modes**, `list` and `grid`, persisted in `localStorage` under `hzw_view_mode_v1`:
- List view renders an HTML `<table>`; each row has a paired hidden `<tr class="detail-row">`
  that toggles open on row click (accordion-style, not a modal). Built in `buildCatalogRow` /
  `buildBundleRow`.
- Grid view renders `.course-card` divs in `#results-grid`; clicking a card opens the shared
  `#modal-overlay` with the same detail fields (`openDetailModal`). Built in `buildCatalogCard`
  / `buildBundleCard`.
- Both list and grid share `detailGridHtml(course, extraStatus)` for the actual detail markup
  so the two views never drift out of sync — extend that function, not each renderer, when
  adding a new field to the detail view.
- In bundle mode, row/card detail is looked up by matching the bundle-content course's `name`
  back to the full record in `COURSES` (`findCourseByName`). If a bundle-content course name
  doesn't exist in `COURSES` (shouldn't happen with current data, but not structurally
  guaranteed), that row/card renders without a detail affordance rather than throwing.

**Search highlighting**: `highlight()` wraps the first case-insensitive substring match of the
query in `<mark>`. It's a single-match highlight, not global — fine for course names, would
need updating if free text ever gets longer/multi-match requirements.

**No client-side data mutation.** Earlier iterations of this tool had an "Add Course" feature
persisting extra rows to `localStorage`. That was deliberately removed — do not re-add
client-only data entry without discussing it with the user first; it silently diverges from
the spreadsheet and was confusing as a "team" tool since `localStorage` is per-browser.

## Styling (`assets/style.css`)

Brand tokens as CSS custom properties in `:root`, sourced from the sibling Next.js project at
`../Automatic Course Creation Program/app/globals.css` — keep these in sync if the brand
changes there:

```css
--background: #ffffff;
--foreground: #171717;
--accent: #ffcd08;
```

Font is `Arial, Helvetica, sans-serif` (matches the Next.js project's `body` rule). Zinc gray
scale (`--zinc-50` … `--zinc-700`) is used for borders/secondary text, matching Tailwind's
zinc palette since the Next.js project uses Tailwind zinc utility classes.

**Known CSS trap, already hit twice — watch for it when adding new toggled elements:**
Any element whose "shown" state sets `display: flex` or `display: grid` (not the default
`display: block`) will **stay visible even with the `hidden` attribute set**, because an
author-stylesheet `display` rule outranks the UA stylesheet's `[hidden] { display: none }`.
Fix pattern used throughout this file:

```css
.thing { display: none; /* ...flex/grid properties... */ }
.thing:not([hidden]) { display: flex; /* or grid */ }
```

Already applied to `.modal-overlay` and `.results-grid`. The mobile media query
(`@media (max-width: 640px)`) also needed a specific override,
`table.results-table tr[hidden] { display: none; }`, because the responsive block forces
`display: block` on `tr` for the stacked-card mobile layout, which otherwise un-hides collapsed
detail rows on small screens. If you add another element that's conditionally `flex`/`grid`
*and* toggled via the `hidden` attribute, apply the same pattern or it will silently render
open by default.

## Testing changes

No test suite. Verify manually:

```bash
python3 -m http.server 8811
```

then open `http://localhost:8811` and check:
1. Free-text search filters and highlights correctly.
2. Category and Industry selects filter, and both disable when a Bundle is selected.
3. The two bundle selects are populated correctly (By Industry / By Category), selecting one
   disables and clears the other, and either shows the summary card + switches results to
   bundle contents.
4. List/Grid toggle both render the same result set; grid card click opens modal with full
   detail; list row click expands inline.
5. Resize to mobile width (375px) — table should stack into label/value pairs, and any
   previously-toggled-open detail rows should stay hidden after a fresh load (this is the CSS
   trap above; regressions here are easy to introduce and easy to miss visually at desktop
   width).

## Deployment

Plain static hosting — push to `main`, GitHub Pages serves the repo root directly. No CI, no
build step. `git push` is sufficient; Pages picks up changes automatically (usually within a
minute or two).
