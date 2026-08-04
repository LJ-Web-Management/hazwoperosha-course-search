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

- **`COURSES`**: array of ~1033 objects, one per Master Catalog row:
  `{ id, category, family, name, type, regBody, citation, industries, duration, msrp,
  bundleClass, industryTags, altTags }`. `industryTags` is an array (split on `;` from the
  source "Industry Bundle Tags" column) - each entry is the *name* of a "By Industry" bundle
  this course belongs to (e.g. `"Construction (General & Commercial) Bundle"`). A course can
  have zero, one, or several tags. `altTags` is a separate array (split on `;` from "Tags /
  Alternate Names"), holding external standard/code references (e.g. `"OSHA #7215 (Silica in
  Construction, Maritime & General Industry)"`, `"NFPA 58"`, `"ANSI Z390.1"`) - only ~20% of
  rows have any; most are `[]`. Don't conflate the two: `industryTags` drives the Industry
  filter and is always one of the 20 known "By Industry" bundle names; `altTags` is free text
  from the source data with no controlled vocabulary, included in free-text search
  (`filterCatalog`'s `hay` string) and shown as plain (non-accent) pills in `detailGridHtml`
  under "Tags / Alternate Names" so they're visually distinct from the yellow industry pills.
  Course search (`filterCatalog`) also matches against `regBody` and `citation` (e.g. searching
  `"1910.120"` or `"NFPA 70E"` finds courses citing that regulation/standard, even though
  neither field is shown as a filter control - text search is the only way to reach them).

- **`BUNDLES`**: array of 80 objects, one per Bundles Overview row:
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

**Manual price overrides live only in `assets/data.js`, not the spreadsheet.** `OSHA 10 Bundle`
(`bundlePrice: 49.99`) and `OSHA 30 Bundle` (`bundlePrice: 149.99`) were hand-edited directly in
this file at the user's request, with `savings` recalculated to match
(`(costSeparate - bundlePrice) / costSeparate`) so the displayed percentage stays consistent
with the new price. **The next full regeneration from a spreadsheet will silently overwrite
both back to the spreadsheet's values** unless the spreadsheet itself is updated first or these
two overrides are reapplied after regenerating. If you regenerate `data.js`, check whether these
two bundles still need the override.

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

**Filters are four and apply to whichever mode is active. Category and Industry are always
visible in both modes; Tag is hidden entirely (not disabled) outside Courses mode:**
- **Search box** (`#search-input`) - free text. Courses mode matches name + category + family +
  industries + regBody + citation + altTags; Bundles mode matches name + scope + type.
- **Category** (`#category-select`) - a `<select>` in the sidebar (top of `.sidebar-panel-body`).
  Used to be a custom list of `.category-item` buttons tracked in `state.category`; the user
  asked for it to match the Industry dropdown's look and behavior, so it's now a plain `<select>`
  read directly via `els.category.value`, same pattern as Industry - there is no `state.category`
  anymore. In Courses mode it does an exact match on `course.category`; in Bundles mode it does a
  case-insensitive substring match against `bundle.scope` (the Bundles Overview "Scope / Included
  Categories" field, a comma-separated list of category names - substring match is deliberate so
  it works whether scope holds one category or several).
- **Industry** (`#industry-select`) - a `<select>` in the sidebar, directly below Category
  (`.sidebar-title-spaced` marks the divider between the two sections; both live inside the same
  `.sidebar-panel-body`, not the search-row). In Courses mode it checks `course.industryTags`
  membership. In Bundles mode it's a **strict match on the bundle itself**:
  `b.type === "By Industry" && b.name === f.industry` - only that one industry's own bundle shows
  up, nothing else. By Category bundles never match an Industry filter at all, by design.

  This used to be looser: a bundle matched if *any* course inside it carried that industry tag
  (union across all contained courses, via a `bundleIndustryTags` index built at init). That
  surfaced confusing results - e.g. "Agriculture Bundle" showed up under the "Construction
  (General & Commercial)" industry filter because 6 of its 30 courses (shared equipment/safety
  content like forklifts, skid steers, heat-illness prevention) happen to carry both industry
  tags in the source data. The user explicitly chose strict-only-its-own-bundle over that
  looser behavior - don't reintroduce the union approach without checking first.
- **Tag** (`#tag-search-input`) - a second free-text search bar, sitting directly to the right of
  the main search box inside `.search-row` (both wrapped in the shared `.search-input-wrap`
  class, so they render as two matching search bars side by side; this used to be a `<select>`
  of exact tag values, but the user asked for a text search instead). Matches via case-insensitive
  substring against each entry in `course.altTags` (see the `COURSES` entry above) - not an exact
  option match. **Hidden entirely (not just disabled) in Bundles mode** via
  `els.tagField.hidden = mode === "bundles"` in `setMode()`, where `#tag-field` is the wrapper div
  around the input, since bundles have no `altTags` field at all - deliberately not reusing the
  union-across-contained-courses pattern here either, for the same reason it was removed from the
  Industry filter above. Its stale value from Courses mode is left in place while hidden (not
  cleared) and simply has no effect on `filterBundles`, which never reads `f.tag`.

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

**Sorting** - `#sort-select`, applied after filtering in `render()` via `sortRows(rows, state.mode)`.
Courses and Bundles have separate, mode-specific option lists (`SORT_OPTIONS.courses` /
`SORT_OPTIONS.bundles`), each remembered independently in `state.sort.courses` /
`state.sort.bundles` (not persisted to `localStorage` - resets on page reload, unlike view/mode).
Switching mode calls `populateSortSelect()` to rebuild the `<select>` and restore that mode's
last choice. "Clear filters" resets sort back to `name:asc` for the current mode.
- Each option's value is `"<key>:<dir>"` (e.g. `"price:desc"`), split in `sortRows()`.
- `courseComparator(key, dir)` handles `name` / `price` (msrp) / `duration`.
  `bundleComparator(key, dir)` handles `name` / `price` (bundlePrice) / `savings` / `courses`
  (totalCourses) / `tier` (priceTier).
- `compareNullable(a, b, dir)` puts `null` values **last regardless of direction** - so a course
  with no MSRP doesn't jump to the top when you flip to "High to Low". Anything that can be
  genuinely missing or non-numeric must be normalized to `null` before reaching it, not left as
  `undefined`/`NaN`/a string.
- **`bundlePrice` and `savings` are sometimes descriptive text, not a number** - two bundles
  ("Crane & Heavy Equipment Operator Certification Bundle", "Train-the-Trainer Certification
  Bundle") have `bundlePrice: "Contact for À La Carte Pricing"` and `savings: "N/A"` straight
  from the spreadsheet. `numOrNull(v)` guards both comparator paths (`typeof v === "number" &&
  !isNaN(v)`, else `null`) - comparing a string to a number with `<`/`>` coerces unpredictably
  in JS, so never compare those two fields raw. Same root cause required fixing `fmtMoney` /
  `fmtNumber` (add an `isNaN(Number(n))` check) and replacing three copies of an inline
  `savings ? Math.round(...) : null` with the shared `fmtSavingsPct()`, which had the identical
  bug: `NaN !== null` is `true`, so the old code let `"NaN%"` through to the page instead of
  falling back to `"-"`. If you add another numeric field, check the live data for stray text
  before assuming `Number(x)` is safe.
- `tierRank()` maps `priceTier` to a fixed ladder (`Starter` 0 → `Standard` 1 → `Advanced` 2 →
  `Comprehensive` 3 → `Enterprise` 4); anything not in that map (currently `"Certification
  Bundle"`, `"N/A - À La Carte Only"`) returns `null` and sorts last via the same
  `compareNullable` nulls-last rule, in both directions - deliberate, since those aren't rungs
  on the tier ladder. If a new price tier value shows up in a future data refresh, decide where
  it belongs in `TIER_RANK` rather than leaving it to fall through to "last".
- `parseDurationToMinutes()` normalizes course duration text to minutes for comparison
  (`"1 Hour"` → 60, `"10 Min"` → 10, `"1 Day"` → 1440). It regex-matches the first number in the
  string and infers the unit from "min"/"day" substrings, defaulting to hours. Ranges like
  `"2-3 Days"` use the first number (lower bound). Purely descriptive durations with no digit
  (`"Theory-Based (no min. hours)"`, `"Varies (Theory + Behind-Wheel)"`) return `null` and sort
  last in both directions, same as above.

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

**Related trap: shorthand `overflow` silently wins over a longhand set on the same element by
another same-specificity class, based on source order, not which one "looks more specific" to
a reader.** `.panel { overflow: hidden; ... }` is shared by every card-style container
(`.panel-accent` top bar + box-shadow look). `.sidebar-panel` needs `overflow-y: auto` (it's a
scrollable list) while still getting the `.panel` look - but `.panel`'s `overflow: hidden`
shorthand sets *both* axes, and because `.panel` is declared later in the file with equal
(single-class) specificity, it silently re-hides the y-axis even though `.sidebar-panel`'s own
rule "looks like" it should apply. Fixed by bumping specificity instead of fighting source
order: `.sidebar-panel.panel { overflow-x: hidden; overflow-y: auto; }` (two classes = higher
specificity than `.panel` alone, wins regardless of order). If you add another element that
needs the `.panel` card look *plus* a scrolling/overflow behavior `.panel` doesn't have, use
the same two-class-selector override rather than assuming declaration order will save you.

**Third trap: a pixel `flex-basis` means something different depending on `flex-direction`,
and the `@media (max-width: 640px)` block flips `.search-row` from `row` to `column`.**
`.search-input-wrap` and `.tag-field` (originally also `.industry-field`, before Industry moved
to the sidebar - see below) use `flex: 1 1 <px>` so they size sensibly *side by side* on
desktop. But `flex-basis` sizes the **main axis** - width in `row` mode, height in `column`
mode. Below 640px, `.search-row` becomes `flex-direction: column`, so an unguarded
`flex-basis: 240px` on `.search-input-wrap` turned into a 240px-tall search box (confirmed via
`getBoundingClientRect()` - the wrapper's flex-basis was literally being read as its height).
Fixed by resetting `flex-basis: auto` for both fields inside that same media query. If you add
another flex item to `.search-row` with a pixel basis, add it to that same mobile override or
it will silently blow up at narrow widths - this is easy to miss because it looks fine at any
viewport width above 640px.

## Testing changes

No test suite. Verify manually:

```bash
python3 -m http.server 8811
```

then open `http://localhost:8811` and check:
1. Free-text search filters and highlights correctly in both Courses and Bundles mode.
2. Category, Industry (both selects), and Tag (text search) all filter correctly in Courses
   mode. In Bundles mode, Category still filters via `bundle.scope` substring, Industry does a
   strict match (selecting an industry shows only that industry's own By Industry bundle,
   nothing else), and the Tag search bar disappears entirely (not just disabled).
3. Switching Courses ↔ Bundles updates the search placeholder, the table header, and the result
   count noun ("courses found" vs "bundles found"), and preserves the current Category/Industry
   selection.
4. In Bundles mode: expanding a bundle (list row, or grid card → modal) shows its stats and full
   course list; clicking a course in that list opens *that course's* own detail popup, not the
   bundle's.
5. List/Grid toggle both render the same result set for whichever mode is active.
6. Sort: each option in `#sort-select` produces the expected order in both modes; switching
   Courses ↔ Bundles swaps the option list and restores that mode's last choice; "Clear filters"
   resets it to "Name (A-Z)"; items with missing/non-numeric values for the active sort key
   (no MSRP, `savings: "N/A"`, non-numeric `bundlePrice`, non-numeric duration text) sort to the
   end in both directions rather than jumping to the top on "desc".
7. Resize to mobile width (375px) and to ~800px (sidebar breakpoint at 900px) - the table should
   stack into label/value pairs, the sidebar should move above the results, and any
   previously-toggled-open detail rows should stay hidden after a fresh load (this is the CSS
   trap below; regressions here are easy to introduce and easy to miss visually at desktop
   width).

## Deployment

Plain static hosting - push to `main`, GitHub Pages serves the repo root directly. No CI, no
build step. `git push` is sufficient; Pages picks up changes automatically (usually within a
minute or two).
