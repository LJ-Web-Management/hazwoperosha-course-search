# Course Catalog Search - Internal Tool

A static search tool for the HAZWOPER OSHA Training course catalog. See `CLAUDE.md` for full
technical/architecture notes.

## Regenerating `assets/data.js`

`assets/data.js` is generated from the source spreadsheet (`ICTrainingUS_reviewed.xlsx`) and
must be regenerated any time that spreadsheet changes. It is not meant to be hand-edited.

1. Make sure the spreadsheet has these three sheets, each with the columns listed:
   - **Master Catalog**: `Category, Course Family, Course Name, Course Type, Regulatory Body,
     Governing Regulation / Citation, Primary Industries, Suggested Duration, Est. MSRP (USD),
     Bundle Class, Industry Bundle Tags, Tags / Alternate Names` (both `Industry Bundle Tags`
     and `Tags / Alternate Names` are semicolon-separated lists; `Tags / Alternate Names` is
     optional per row and often blank)
   - **Bundles Overview**: `Bundle Type, Suggested Bundle Name, Scope / Included Categories,
     Total Courses, Included in Flat Bundle Price, À La Carte Add-Ons, Cost to Buy Included
     Courses Separately, Price Tier, Bundle Price, Savings vs. Buying Separately, À La Carte
     Terms for Excluded Courses`
   - **Bundle Contents Detail**: `Bundle Type, Bundle Name, Course Name, Category, Course Type,
     Suggested Duration, Est. MSRP (USD), Inclusion Status`
2. Run this Python script (needs `openpyxl`, no other dependencies) against the spreadsheet:

   ```python
   import json
   import openpyxl

   SRC = "/path/to/ICTrainingUS_reviewed.xlsx"
   OUT = "assets/data.js"

   wb = openpyxl.load_workbook(SRC, data_only=True)

   ws = wb["Master Catalog"]
   courses = []
   for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
       if row[0] is None:
           continue
       (category, course_family, course_name, course_type, reg_body, citation,
        industries, duration, msrp, bundle_class, industry_tags, alt_tags) = row[:12]
       tags = [t.strip() for t in (industry_tags or "").split(";") if t.strip()]
       alt = [t.strip() for t in (alt_tags or "").split(";") if t.strip()]
       courses.append({
           "id": i, "category": category, "family": course_family, "name": course_name,
           "type": course_type, "regBody": reg_body, "citation": citation,
           "industries": industries, "duration": duration, "msrp": msrp,
           "bundleClass": bundle_class, "industryTags": tags, "altTags": alt,
       })

   ws = wb["Bundles Overview"]
   bundles = []
   for row in ws.iter_rows(min_row=2, values_only=True):
       if row[0] is None:
           continue
       (btype, bname, scope, total_courses, incl_flat, ala_carte_addons,
        cost_separate, price_tier, bundle_price, savings, ala_carte_terms) = row[:11]
       bundles.append({
           "id": f"{btype}||{bname}", "type": btype, "name": bname, "scope": scope,
           "totalCourses": total_courses, "inclFlat": incl_flat,
           "alaCarteAddons": ala_carte_addons, "costSeparate": cost_separate,
           "priceTier": price_tier, "bundlePrice": bundle_price, "savings": savings,
           "alaCarteTerms": ala_carte_terms,
       })

   ws = wb["Bundle Contents Detail"]
   contents = {}
   for row in ws.iter_rows(min_row=2, values_only=True):
       if row[0] is None:
           continue
       (btype, bname, course_name, category, course_type, duration, msrp, status) = row[:8]
       key = f"{btype}||{bname}"
       contents.setdefault(key, []).append({
           "name": course_name, "category": category, "type": course_type,
           "duration": duration, "msrp": msrp, "status": status,
       })

   industries = sorted({b["name"] for b in bundles if b["type"] == "By Industry"})
   categories = sorted({c["category"] for c in courses})

   with open(OUT, "w") as f:
       f.write("// Auto-generated from ICTrainingUS_reviewed.xlsx - do not hand-edit.\n")
       f.write("const COURSES = " + json.dumps(courses, ensure_ascii=False) + ";\n")
       f.write("const BUNDLES = " + json.dumps(bundles, ensure_ascii=False) + ";\n")
       f.write("const BUNDLE_CONTENTS = " + json.dumps(contents, ensure_ascii=False) + ";\n")
       f.write("const INDUSTRIES = " + json.dumps(industries, ensure_ascii=False) + ";\n")
       f.write("const CATEGORIES = " + json.dumps(categories, ensure_ascii=False) + ";\n")
   ```

3. Reload `index.html` (locally via `python3 -m http.server`, or on the deployed GitHub Pages
   URL) and confirm the result count and a few searches look right before committing.
4. Re-run the B2B catalog merge below - a full regeneration drops everything it added.

## Merging the B2B catalog workbook

`HAZWOPER-OSHA_Master_Course_Catalog_and_B2B_Bundles_v3.xlsx` uses a different layout
(sheets **Master Course List**, **B2B Bundles & Seat Tiers**, **Bundle Contents**) and is merged
*on top of* the existing `assets/data.js` rather than replacing it:

```bash
pip install openpyxl
python3 tools/merge_b2b_catalog.py /path/to/HAZWOPER-OSHA_..._v3.xlsx 43 74
```

What it does:
- **New courses**: every Master Course List row whose name (or "Original Title") isn't already
  in `COURSES` is added. "Citation" is split on ` – ` into `regBody` / `citation`; hours become
  `"N Hours"` / `"15 Min"`; "Industry Library(ies)" map to the matching `... Bundle` industry tags.
- **Renamed courses**: when the workbook retitles an existing course, the old name is kept and the
  new title is appended to `altTags`, so either name finds it in search.
- **Packs**: Bundle Contents rows `43 74` (the default) become bundles of type `Compliance Pack`
  (Data Center Facilities Safety, Data Center Infrastructure Professional, Data Center Technician
  Skills), priced from B2B Bundles & Seat Tiers. Each course in those rows takes the workbook's
  "À La Carte Price per Seat" as its `msrp`, everywhere it appears.

It is safe to re-run; existing courses and packs are matched by name, not duplicated.
