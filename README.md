# Course Catalog Search - Internal Tool

A static search tool for the HAZWOPER OSHA Training course catalog. See `CLAUDE.md` for full
technical/architecture notes.

## Regenerating `assets/data.js`

`assets/data.js` is generated from the source spreadsheet (`ICTrainingUS_reviewed.xlsx`) and
must be regenerated any time that spreadsheet changes. It is not meant to be hand-edited.

1. Make sure the spreadsheet has these three sheets, each with the columns listed:
   - **Master Catalog**: `Category, Course Family, Course Name, Course Type, Regulatory Body,
     Governing Regulation / Citation, Primary Industries, Suggested Duration, Est. MSRP (USD),
     Bundle Class, Industry Bundle Tags` (semicolon-separated list in the last column)
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
        industries, duration, msrp, bundle_class, industry_tags) = row[:11]
       tags = [t.strip() for t in (industry_tags or "").split(";") if t.strip()]
       courses.append({
           "id": i, "category": category, "family": course_family, "name": course_name,
           "type": course_type, "regBody": reg_body, "citation": citation,
           "industries": industries, "duration": duration, "msrp": msrp,
           "bundleClass": bundle_class, "industryTags": tags,
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
