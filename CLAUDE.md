# CLAUDE.md - Course Catalog Search

Internal customer-service tool for HAZWOPER OSHA Training LLC. Static site, no build step,
no backend, no dependencies. Deployed on GitHub Pages at
https://lj-web-management.github.io/hazwoperosha-course-search/ from the `main` branch root.

Repo: https://github.com/LJ-Web-Management/hazwoperosha-course-search

## What this is

A searchable/filterable tool over the course catalog, built from `ICTrainingUS_reviewed.xlsx`
(source lives outside this repo, typically in the user's Downloads). It has **two search
modes** - Courses and Bundles, toggled at the top of the page - rather than treating bundles
as a filter on courses. There is **no add/edit/delete UI** - the catalog is read-only in the
browser. To change course data, edit the spreadsheet and regenerate `assets/data.js` (see
`README.md`).

## File map

```
index.html          shell: header, sidebar, search/mode panel, results table+grid, modal, footer
assets/style.css     all styling, brand tokens as CSS custom properties
assets/app.js        all behavior (vanilla JS, one IIFE, no framework)
assets/data.js       generated data - COURSES, BUNDLES, BUNDLE_CONTENTS, INDUSTRIES, CATEGORIES
assets/hazwoper-logo.png   full brand lockup (header), copied from the sibling "Automatic
                            Course Creation Program" Next.js project's public/brand/
assets/favicon.png    square tab icon cropped from the biohazard mark in hazwoper-logo.png -
                       the full lockup is too wide to read at favicon size
README.md            spreadsheet → data.js regeneration steps only
```

No `package.json`, no build tool. Editing `assets/app.js` or `assets/style.css` directly is
correct - there is no compiled/transpiled source elsewhere.

**No em dashes (U+2014) anywhere in user-visible text or docs in this repo** - explicit user
preference. Use a hyphen (`-`), a colon, a middle dot (`·`, already used for the footer's
"Internal Use Only · Course Catalog Search" separator, matching the sibling Next.js project's
own footer style), or just restructure the sentence.

## Data model (`assets/data.js`)

Four globals, loaded before `app.js` via `<script src="assets/data.js">`:

- **`COURSES`**: array of ~1034 objects, one per Master Catalog row:
  `{ id, category, family, name, type, regBody, citation, industries, duration, msrp,
  bundleClass, industryTags }`. `industryTags` is an array (split on `;` from the source
  "Industry Bundle Tags" column) - each entry is the *name* of a "By Industry" bundle this
  course belongs to (e.g. `"Construction (General & Commercial) Bundle"`). A course can have
  zero, one, or several tags.

- **`BUNDLES`**: array of 79 objects, one per Bundles Overview row:
  `{ id, type, name, scope, totalCourses, inclFlat, alaCarteAddons, costSeparate, priceTier,
  bundlePrice, savings, alaCarteTerms }`. `type` is `"By Industry"` or `"By Category"`.
  **`id` is `${type}||${name}`, not just `name`** - two bundle names collide across types
  ("Aviation & Aerospace Manufacturing Bundle" and "Manufacturing & Industrial Operations
  Bundle" each exist as both a By Industry and a By Category bundle with the same name and
  different contents). Never key bundles by name alone.

- **`BUNDLE_CONTENTS`**: object keyed by the same `${type}||${name}` id, each value an array of
  `{ name, category, type, duration, msrp, status }` - the courses inside that bundle, from
  Bundle Contents Detail. `status` is free text like `"Included in Flat Bundle Price"` or an
  à-la-carte note; the UI treats anything matching `/Flat/i` as "included" styling.

- **`INDUSTRIES`**: sorted array of the ~20 distinct "By Industry" bundle names - used to
  populate the Industry filter dropdown. This is derived from `BUNDLES`, not a separate source.

- **`CATEGORIES`**: sorted array of the ~59 distinct `category` values from `COURSES`.

Regenerating this file is documented in `README.md` - that's the only doc that should contain
the extraction script, to avoid drifting duplicate copies.

## App behavior (`assets/app.js`)

Single IIFE, `DOMContentLoaded` → `init()`. No modules, no bundler - this is deliberate, keep
it that way unless the hosting story changes.

**Search mode - `state.mode`, `"courses"` or `"bundles"`**, persisted in `localStorage` under
`hzw_search_mode_v1`, toggled by `#mode-courses-btn` / `#mode-bundles-btn` (`setMode()`).
Bundles are a first-class searchable/browsable result set, not a filter layered on top of
courses - do not reintroduce a "select a bundle to filter courses" control without checking
with the user first; that was the previous design and was explicitly replaced. Switching mode
also swaps the search placeholder text and re-renders; it does **not** reset the Category or
Industry filters, which apply to both modes.

**Filters are just three, always visible, and apply to whichever mode is active:**
- **Search box** (`#search-input`) - free text. Courses mode matches name + category + family
  + industries; Bundles mode matches name + scope + type.
- **Category** - a sidebar list (`#category-list`, `.category-item` buttons), not a `<select>`.
  Single-select, tracked in `state.category` (not read from a form control). In Courses mode it
  does an exact match on `course.category`; in Bundles mode it does a case-insensitive substring
  match against `bundle.scope` (the Bundles Overview "Scope / Included Categories" field, which
  is a comma-separated list of category names - substring match is deliberate so it works
  whether scope holds one category or several).
- **Industry** (`#industry-select`) - the only filter dropdown next to the search bar. In
  Courses mode it checks `course.industryTags` membership (unchanged from before). In Bundles
  mode it checks membership in `bundleIndustryTags[bundle.id]`, a `Set` built once in
  `buildBundleIndustryIndex()` at init: the union of every contained course's `industryTags`,
  plus the bundle's own name if `bundle.type === "By Industry"` (so a By Industry bundle always
  matches its own name in the Industry filter even in the edge case where none of its courses
  happen to carry that tag). This index is derived client-side, not stored in `data.js`.

There is intentionally no Category or Industry disabling logic between modes anymore - both
filters are always live, in both modes.

**Bundle drill-down**: expanding a bundle (list row click, or grid card → modal) shows bundle
stats (`bundleStatsHtml()`) plus the full list of contained courses
(`buildBundleCourseListEl()`, built with real DOM nodes + click listeners, not an HTML string,
since each course item needs its own click handler). Clicking a course inside that list opens
*that course's own* detail popup via `openCourseDetailModal()` - the same modal used from
Courses mode, just re-purposed with new title/body (`e.stopPropagation()` on the course item
keeps the click from also toggling the parent bundle row's inline expand). There is no "back to
bundle" affordance - reopen the bundle from the results list if needed. Keep this course-list
behavior shared between list and grid bundle views (via `buildBundleCourseListEl`) rather than
duplicating it, the same way `detailGridHtml` is shared for course detail.

**Two view modes**, `list` and `grid`, persisted in `localStorage` under `hzw_view_mode_v1`,
apply within whichever search mode is active:
- List view renders an HTML `<table>`; each row has a paired hidden `<tr class="detail-row">`
  that toggles open on row click (accordion-style, not a modal). Built in `buildCatalogRow` /
  `buildBundleListRow`.
- Grid view renders `.course-card` divs in `#results-grid`; clicking a card opens the shared
  `#modal-overlay`. Built in `buildCatalogCard` / `buildBundleGridCard`.
- Course detail markup is shared via `detailGridHtml(course, extraStatus)`; bundle detail markup
  is shared via `bundleStatsHtml(bundle)` + `buildBundleCourseListEl(bundle)`. Extend those
  functions, not each renderer, when adding a field to a detail view so list and grid can't
  drift out of sync.
- Bundle-context course lookups match by `name` back to the full record in `COURSES`
  (`findCourseByName`). If a bundle-content course name doesn't exist in `COURSES` (shouldn't
  happen with current data, but not structurally guaranteed), the click handler for that item is
  simply not attached rather than throwing.

**Search highlighting**: `highlight()` wraps the first case-insensitive substring match of the
query in `<mark>`. It's a single-match highlight, not global - fine for course/bundle names,
would need updating if free text ever gets longer/multi-match requirements.

**No client-side data mutation.** Earlier iterations of this tool had an "Add Course" feature
persisting extra rows to `localStorage`. That was deliberately removed - do not re-add
client-only data entry without discussing it with the user first; it silently diverges from
the spreadsheet and was confusing as a "team" tool since `localStorage` is per-browser.

## Styling (`assets/style.css`)

Brand tokens as CSS custom properties in `:root`, sourced from the sibling Next.js project at
`../Automatic Course Creation Program/app/globals.css` - keep these in sync if the brand
changes there:

```css
--background: #ffffff;
--foreground: #171717;
--accent: #ffcd08;
```

Font is `Arial, Helvetica, sans-serif` (matches the Next.js project's `body` rule). Zinc gray
scale (`--zinc-50` … `--zinc-700`) is used for borders/secondary text, matching Tailwind's
zinc palette since the Next.js project uses Tailwind zinc utility classes.

**Known CSS trap, already hit twice - watch for it when adding new toggled elements:**
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
1. Free-text search filters and highlights correctly in both Courses and Bundles mode.
2. Category sidebar and Industry select both filter correctly in Courses mode, and both still
   filter (via `bundle.scope` substring / `bundleIndustryTags`) in Bundles mode.
3. Switching Courses ↔ Bundles updates the search placeholder, the table header, and the result
   count noun ("courses found" vs "bundles found"), and preserves the current Category/Industry
   selection.
4. In Bundles mode: expanding a bundle (list row, or grid card → modal) shows its stats and full
   course list; clicking a course in that list opens *that course's* own detail popup, not the
   bundle's.
5. List/Grid toggle both render the same result set for whichever mode is active.
6. Resize to mobile width (375px) and to ~800px (sidebar breakpoint at 900px) - the table should
   stack into label/value pairs, the sidebar should move above the results, and any
   previously-toggled-open detail rows should stay hidden after a fresh load (this is the CSS
   trap below; regressions here are easy to introduce and easy to miss visually at desktop
   width).

## Deployment

Plain static hosting - push to `main`, GitHub Pages serves the repo root directly. No CI, no
build step. `git push` is sufficient; Pages picks up changes automatically (usually within a
minute or two).
