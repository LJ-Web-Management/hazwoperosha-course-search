"""Merge the live LMS course export (HAZWOPER-OSHA-ALL-COURSES-LIST-*.xlsx, sheet "Courses")
into assets/data.js. See README.md ("Merging the LMS course export") for when to run it.

Usage:
    python3 tools/merge_lms_courses.py /path/to/HAZWOPER-OSHA-ALL-COURSES-LIST.xlsx

- Matched courses (by name, by an existing alternate name, or via RENAMES below) keep their
  catalog record but take the LMS price as `msrp` (also in every BUNDLE_CONTENTS entry for
  that course) and gain an `lms` object: {id, sku, url, content, page}.
- LMS courses with no catalog match are added, copying their metadata from the closest catalog
  course in NEW_FROM (category, citation, industries, ...).
- Test/demo rows in SKIP are ignored. When two LMS records match one course, the published one wins.
- Catalog courses not in the export are left as-is with no `lms` key ("Not in LMS" in the UI).

Safe to re-run: every course's `lms` key and LMS-priced msrp are rebuilt from the export.
"""
import json
import re
import sys

import openpyxl

DATA = "assets/data.js"
NAMES = ["COURSES", "BUNDLES", "BUNDLE_CONTENTS", "INDUSTRIES", "CATEGORIES"]

# LMS test/demo rows - never shown in the tool.
SKIP = {
    "Pandemic Demo Course For Scrom",
    "OSHA Asbestos Awareness Demo Course",
    "SCORM Sample Courses for Testing",
    "SCORM Sample Course",
    "Screening Test for Reviewer/QA",
    "xyz course",
    "Test - Full Body Harness",
}

# LMS title -> existing catalog course name (same course, different title).
RENAMES = {
    "OSHA 8 Hour HAZWOPER Refresher Training - 29 CFR 1910.120 (e)": "OSHA 8 Hour HAZWOPER Refresher Training",
    "OSHA 24 Hour HAZWOPER Training - 29 CFR 1910.120 (e)": "OSHA 24 Hour HAZWOPER Training",
    "OSHA 40 Hour HAZWOPER Training - 29 CFR 1910.120 (e)": "OSHA 40 Hour HAZWOPER Training",
    "Shipping Lithium Batteries: Fully Regulated and Excepted Cells and Batteries Training (U.S. DOT, ICAO/IATA, IMO/IMDG)":
        "Shipping Lithium Batteries: Fully Regulated and Excepted Cells and Batteries Training",
    "Shipping Lithium Batteries: Fully Regulated Cells and Batteries (U.S. DOT, ICAO/IATA, IMO/IMDG)":
        "Shipping Lithium Batteries: Fully Regulated Cells and Batteries",
    "Shipping Lithium Batteries: Excepted Cells and Batteries (U.S. DOT, ICAO/IATA, IMO/IMDG)":
        "Shipping Lithium Batteries: Excepted Cells and Batteries",
    "CDL Entry Level Driver Training (ELDT) - Hazmat and Tanker (X) Endorsement":
        "CDL Entry Level Driver Training (ELDT) - Hazmat and Tank Vehicle (X) Endorsement",
    "OSHA Slips, Trips, and Falls Prevention Training": "OSHA Slips, Trips & Falls Prevention Training",
    "Cal/OSHA Workplace Violence Prevention Plan Training": "Cal/OSHA Workplace Violence Prevention Plan Training (SB 553)",
    "Cal/OSHA Active Shooter and Workplace Violence Awareness Training":
        "Cal/OSHA Active Shooter & Workplace Violence Awareness Training",
    "Cal/OSHA Lockout/Tagout (LOTO) Safety Training": "Cal/OSHA Lockout/Tagout (LOTO) Training",
    "DOT Reasonable Suspicion Drug and Alcohol Testing for Managers and Supervisors Training":
        "DOT Reasonable Suspicion Training for Supervisors (Drug & Alcohol)",
    "Incident Command System for Expanding Incidents (ICS 300) Refresher Training":
        "FEMA ICS-300 Intermediate ICS Refresher",
}

# New LMS course -> (catalog course to copy metadata from, field overrides).
# Customer-specific and in-person variants get no industry tags so they stay out of the
# Industry filter.
NEW_FROM = {
    "Cal/OSHA 24 hour HAZWOPER TSDF RCRA Training (Diablo Power)":
        ("Cal/OSHA 24 hour HAZWOPER TSDF RCRA Training", {"industryTags": []}),
    "Cal/OSHA 8-hour HAZWOPER TSDF RCRA Refresher Training (Diablo Power)":
        ("Cal/OSHA 8-hour HAZWOPER TSDF RCRA Refresher Training", {"industryTags": []}),
    "OSHA Competent Person for Basic Rigging and Inspection Training (for TURBINEPROs)":
        ("OSHA Competent Person for Basic Rigging and Inspection Training", {"industryTags": []}),
    "OSHA 30 Hour Construction Industry Outreach In Person Training":
        ("OSHA 30-Hour Construction Industry Outreach Training with DOL Card", {"industryTags": []}),
    "OSHA Asbestos Awareness Training - SCORM": ("OSHA Asbestos Awareness Training", {"industryTags": []}),
    "OSHA Hydrogen Sulfide Safety Training": ("OSHA Hydrogen Sulfide (H2S) Awareness Training", {}),
    # Older (pre-2024 / draft) LMS records kept alongside their current versions.
    "Electrical Safety Training (NFPA 70E)": ("Electrical Safety Training (NFPA 70E 2024)", {}),
    "Arc Flash Safety Training (NFPA 70E)": ("Arc Flash Safety Training (NFPA 70E 2024)", {}),
    "Air Monitoring and Gas Detection": ("OSHA Air Monitoring and Gas Detection Training", {}),
    "Cal/OSHA Forklift / PIT Safety Training":
        ("OSHA Forklift Safety Training", {"category": "Cal/OSHA Specific", "industryTags": []}),
}


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def fmt_hours(h):
    try:
        h = float(h)
    except (TypeError, ValueError):
        return None
    if h <= 0:
        return None
    h = int(h) if h.is_integer() else h
    return f"{h} Hour" if h == 1 else f"{h} Hours"


def main():
    src = sys.argv[1]
    text = open(DATA, encoding="utf-8").read()
    header = text.splitlines()[0]
    data = {n: json.loads(re.search(r"^const %s = (.*);$" % n, text, re.M).group(1)) for n in NAMES}
    courses, contents = data["COURSES"], data["BUNDLE_CONTENTS"]

    by_name = {}
    for c in courses:
        c.pop("lms", None)
        by_name.setdefault(norm(c["name"]), c)
    for c in courses:
        for t in c["altTags"]:
            by_name.setdefault(norm(t), c)
    exact = {norm(c["name"]): c for c in courses}

    rows = [r for r in openpyxl.load_workbook(src, data_only=True)["Courses"].iter_rows(min_row=2, values_only=True)
            if r[0] is not None]

    matched, renamed, added, skipped, unmatched, dupes = 0, 0, [], 0, [], []
    price_by_name = {}
    for (lms_id, name, _lms_cat, price, hours, sku, url, content, page) in (r[:9] for r in rows):
        name = name.strip()
        if name in SKIP:
            skipped += 1
            continue
        course = by_name.get(norm(name))
        if not course and name in RENAMES:
            course = exact[norm(RENAMES[name])]
            if name not in course["altTags"]:
                course["altTags"].append(name)
            renamed += 1
        if not course and name in NEW_FROM:
            basis, overrides = NEW_FROM[name]
            course = dict(exact[norm(basis)], **overrides)
            course.pop("lms", None)
            course.update({"id": max(c["id"] for c in courses) + 1, "name": name, "family": name,
                           "duration": fmt_hours(hours), "altTags": []})
            courses.append(course)
            by_name[norm(name)] = course
            added.append(name)
        if not course:
            unmatched.append(name)
            continue
        if "lms" in course:
            # Duplicate LMS record for one course (e.g. an unpublished copy): keep the published one.
            dupes.append(f"{course['name']} (LMS ids {course['lms']['id']}, {lms_id})")
            if course["lms"]["page"] == "Published" or page != "Published":
                continue
        else:
            matched += 1
        course["lms"] = {"id": lms_id, "sku": sku, "url": url, "content": content, "page": page}
        if isinstance(price, (int, float)):
            course["msrp"] = price
            price_by_name[course["name"]] = price

    if unmatched:
        sys.exit("Unmatched LMS courses - add each to SKIP, RENAMES or NEW_FROM:\n  " + "\n  ".join(unmatched))

    for items in contents.values():
        for item in items:
            if item["name"] in price_by_name:
                item["msrp"] = price_by_name[item["name"]]

    data["CATEGORIES"] = sorted({c["category"] for c in courses})

    if "LMS course export" not in header:
        header += " Then merged with the LMS course export via tools/merge_lms_courses.py."
    with open(DATA, "w", encoding="utf-8") as f:
        f.write(header + "\n")
        for n in NAMES:
            f.write(f"const {n} = " + json.dumps(data[n], ensure_ascii=False) + ";\n")

    print(f"LMS rows: {len(rows)}  matched: {matched} ({renamed} via rename)  added: {len(added)}  skipped: {skipped}")
    for d in dupes:
        print("Duplicate LMS record, kept the published one:", d)
    print(f"Catalog courses not in LMS: {sum(1 for c in courses if 'lms' not in c)}  total courses: {len(courses)}")


if __name__ == "__main__":
    main()
