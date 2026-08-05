(function () {
  "use strict";

  var VIEW_STORAGE_KEY = "hzw_view_mode_v1";
  var MODE_STORAGE_KEY = "hzw_search_mode_v1";

  var state = {
    view: localStorage.getItem(VIEW_STORAGE_KEY) === "grid" ? "grid" : "list",
    mode: localStorage.getItem(MODE_STORAGE_KEY) === "bundles" ? "bundles" : "courses",
    sort: { courses: "name:asc", bundles: "name:asc" },
  };

  var SORT_OPTIONS = {
    courses: [
      { value: "name:asc", label: "Name (A-Z)" },
      { value: "name:desc", label: "Name (Z-A)" },
      { value: "price:asc", label: "Price (Low to High)" },
      { value: "price:desc", label: "Price (High to Low)" },
      { value: "duration:asc", label: "Duration (Shortest First)" },
      { value: "duration:desc", label: "Duration (Longest First)" },
    ],
    bundles: [
      { value: "name:asc", label: "Name (A-Z)" },
      { value: "name:desc", label: "Name (Z-A)" },
      { value: "price:asc", label: "Price (Low to High)" },
      { value: "price:desc", label: "Price (High to Low)" },
      { value: "savings:asc", label: "Savings (Low to High)" },
      { value: "savings:desc", label: "Savings (High to Low)" },
      { value: "courses:asc", label: "# Courses (Low to High)" },
      { value: "courses:desc", label: "# Courses (High to Low)" },
      { value: "tier:asc", label: "Price Tier (Starter to Enterprise)" },
      { value: "tier:desc", label: "Price Tier (Enterprise to Starter)" },
    ],
  };

  var TIER_RANK = { Starter: 0, Standard: 1, Advanced: 2, Comprehensive: 3, Enterprise: 4 };

  var els = {
    search: document.getElementById("search-input"),
    industry: document.getElementById("industry-select"),
    category: document.getElementById("category-select"),
    clear: document.getElementById("clear-btn"),
    resultCount: document.getElementById("result-count"),
    resultsBody: document.getElementById("results-body"),
    resultsWrap: document.getElementById("results-wrap"),
    resultsTable: document.querySelector("table.results-table"),
    resultsGrid: document.getElementById("results-grid"),
    emptyState: document.getElementById("empty-state"),
    tableHead: document.getElementById("table-head"),
    viewListBtn: document.getElementById("view-list-btn"),
    viewGridBtn: document.getElementById("view-grid-btn"),
    sort: document.getElementById("sort-select"),
    modeCoursesBtn: document.getElementById("mode-courses-btn"),
    modeBundlesBtn: document.getElementById("mode-bundles-btn"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalClose: document.getElementById("modal-close"),
  };

  // ---------- setup: selects, sidebar, derived indexes ----------

  function rebuildSelect(selectEl, values, placeholder) {
    selectEl.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);
    values.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

  function populateSortSelect() {
    els.sort.innerHTML = "";
    SORT_OPTIONS[state.mode].forEach(function (opt) {
      var el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      els.sort.appendChild(el);
    });
    els.sort.value = state.sort[state.mode];
  }

  function findCourseByName(name) {
    return COURSES.filter(function (c) {
      return c.name === name;
    })[0];
  }

  // ---------- helpers ----------

  function fmtMoney(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "-";
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtNumber(n) {
    if (n === null || n === undefined || n === "" || isNaN(Number(n))) return "-";
    return Number(n).toLocaleString("en-US");
  }

  // A few bundles have non-numeric savings ("N/A") or bundlePrice ("Contact
  // for À La Carte Pricing") in the source data - Number(n) on those is NaN,
  // which is not null, so a bare `!== null` check lets "NaN%" through.
  function fmtSavingsPct(savings) {
    if (typeof savings !== "number" || isNaN(savings)) return null;
    return Math.round(savings * 1000) / 10;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function highlight(text, query) {
    var safe = escapeHtml(text);
    if (!query) return safe;
    var idx = safe.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return safe;
    return (
      safe.slice(0, idx) +
      '<mark style="background:var(--accent);padding:0 1px;border-radius:2px;">' +
      safe.slice(idx, idx + query.length) +
      "</mark>" +
      safe.slice(idx + query.length)
    );
  }

  var catalogTableHeadHtml =
    "<tr>" +
    "<th>Course Name</th>" +
    "<th>Category</th>" +
    "<th>Course Type</th>" +
    "<th>Industries</th>" +
    "<th>Duration</th>" +
    "<th>MSRP</th>" +
    "</tr>";

  var bundlesTableHeadHtml =
    "<tr>" +
    "<th>Bundle Name</th>" +
    "<th>Type</th>" +
    "<th>Price Tier</th>" +
    "<th># Courses</th>" +
    "<th>Price / Seat / Yr</th>" +
    "<th>Savings</th>" +
    "</tr>";

  // ---------- filtering ----------

  function currentFilters() {
    return {
      q: els.search.value.trim(),
      category: els.category.value,
      industry: els.industry.value,
    };
  }

  function filterCatalog(f) {
    var q = f.q.toLowerCase();
    return COURSES.filter(function (c) {
      if (f.category && c.category !== f.category) return false;
      if (f.industry && c.industryTags.indexOf(f.industry) === -1) return false;
      if (q) {
        var hay = (
          c.name + " " + c.category + " " + c.family + " " + (c.industries || "") + " " +
          (c.regBody || "") + " " + (c.citation || "") + " " + (c.altTags || []).join(" ")
        ).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function filterBundles(f) {
    var q = f.q.toLowerCase();
    return BUNDLES.filter(function (b) {
      if (f.category && (b.scope || "").toLowerCase().indexOf(f.category.toLowerCase()) === -1) return false;
      if (f.industry && !(b.type === "By Industry" && b.name === f.industry)) return false;
      if (q) {
        var hay = (b.name + " " + (b.scope || "") + " " + b.type).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  // ---------- sorting ----------

  function parseDurationToMinutes(text) {
    if (!text) return null;
    var m = text.match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    var num = parseFloat(m[1]);
    var lower = text.toLowerCase();
    if (lower.indexOf("min") !== -1) return num;
    if (lower.indexOf("day") !== -1) return num * 24 * 60;
    return num * 60; // default: hours
  }

  function tierRank(tier) {
    return Object.prototype.hasOwnProperty.call(TIER_RANK, tier) ? TIER_RANK[tier] : null;
  }

  // Nulls always sort last, regardless of direction, so unparseable/unranked
  // values don't jump to the top just because the direction flipped.
  function compareNullable(a, b, dir) {
    var mul = dir === "desc" ? -1 : 1;
    var aNull = a === null || a === undefined || (typeof a === "number" && isNaN(a));
    var bNull = b === null || b === undefined || (typeof b === "number" && isNaN(b));
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;
    if (a < b) return -1 * mul;
    if (a > b) return 1 * mul;
    return 0;
  }

  function compareName(a, b, dir) {
    return a.localeCompare(b) * (dir === "desc" ? -1 : 1);
  }

  // A couple of bundles hold descriptive text ("Contact for À La Carte
  // Pricing", "N/A") instead of a number in bundlePrice/savings - comparing
  // a string against a number with < / > coerces unpredictably, so route
  // both through this before handing them to compareNullable.
  function numOrNull(v) {
    return typeof v === "number" && !isNaN(v) ? v : null;
  }

  function courseComparator(key, dir) {
    return function (a, b) {
      if (key === "price") return compareNullable(numOrNull(a.msrp), numOrNull(b.msrp), dir);
      if (key === "duration") return compareNullable(parseDurationToMinutes(a.duration), parseDurationToMinutes(b.duration), dir);
      return compareName(a.name, b.name, dir);
    };
  }

  function bundleComparator(key, dir) {
    return function (a, b) {
      if (key === "price") return compareNullable(numOrNull(a.bundlePrice), numOrNull(b.bundlePrice), dir);
      if (key === "savings") return compareNullable(numOrNull(a.savings), numOrNull(b.savings), dir);
      if (key === "courses") return compareNullable(numOrNull(a.totalCourses), numOrNull(b.totalCourses), dir);
      if (key === "tier") return compareNullable(tierRank(a.priceTier), tierRank(b.priceTier), dir);
      return compareName(a.name, b.name, dir);
    };
  }

  function sortRows(rows, mode) {
    var parts = state.sort[mode].split(":");
    var key = parts[0];
    var dir = parts[1];
    var comparator = mode === "bundles" ? bundleComparator(key, dir) : courseComparator(key, dir);
    return rows.slice().sort(comparator);
  }

  // ---------- course detail content (shared by list-expand and modal) ----------

  function detailGridHtml(c, extraStatus) {
    return (
      '<div class="detail-grid">' +
      (extraStatus
        ? '<div><div class="label">Bundle Inclusion</div><div class="value"><span class="pill pill-accent">' + escapeHtml(extraStatus) + "</span></div></div>"
        : "") +
      '<div><div class="label">Regulatory Body</div><div class="value">' + escapeHtml(c.regBody || "-") + "</div></div>" +
      '<div><div class="label">Citation</div><div class="value">' + escapeHtml(c.citation || "-") + "</div></div>" +
      '<div><div class="label">Course Family</div><div class="value">' + escapeHtml(c.family || "-") + "</div></div>" +
      '<div><div class="label">Bundle Class</div><div class="value">' + escapeHtml(c.bundleClass || "-") + "</div></div>" +
      '<div><div class="label">Primary Industries</div><div class="value">' + escapeHtml(c.industries || "-") + "</div></div>" +
      '<div><div class="label">Industry Bundle Tags</div><div class="value">' +
      (c.industryTags && c.industryTags.length
        ? c.industryTags
            .map(function (t) {
              return '<span class="pill pill-accent" style="margin:2px 4px 2px 0;">' + escapeHtml(t) + "</span>";
            })
            .join("")
        : "-") +
      "</div></div>" +
      '<div><div class="label">Tags / Alternate Names</div><div class="value">' +
      (c.altTags && c.altTags.length
        ? c.altTags
            .map(function (t) {
              return '<span class="pill" style="margin:2px 4px 2px 0;">' + escapeHtml(t) + "</span>";
            })
            .join("")
        : "-") +
      "</div></div>" +
      "</div>"
    );
  }

  // ---------- bundle detail content (shared by list-expand and modal) ----------

  function bundleStatsHtml(bundle) {
    var savingsPct = fmtSavingsPct(bundle.savings);
    return (
      '<span class="bundle-type-badge">' + escapeHtml(bundle.type) + "</span>" +
      '<div class="bundle-scope">' + escapeHtml(bundle.scope || "") + "</div>" +
      '<div class="bundle-stats">' +
      '<div class="bundle-stat"><div class="label">Price Tier</div><div class="value">' + escapeHtml(bundle.priceTier) + "</div></div>" +
      '<div class="bundle-stat"><div class="label">Total Courses</div><div class="value">' + fmtNumber(bundle.totalCourses) + "</div></div>" +
      '<div class="bundle-stat"><div class="label">Bundle Price / Seat / Yr</div><div class="value">' + fmtMoney(bundle.bundlePrice) + "</div></div>" +
      '<div class="bundle-stat"><div class="label">À La Carte Cost</div><div class="value">' + fmtMoney(bundle.costSeparate) + "</div></div>" +
      (savingsPct !== null
        ? '<div class="bundle-stat"><div class="label">Savings</div><div class="value">' + savingsPct + "%</div></div>"
        : "") +
      "</div>" +
      (bundle.alaCarteTerms
        ? '<div class="bundle-scope" style="margin-top:10px;"><strong>À la carte terms:</strong> ' + escapeHtml(bundle.alaCarteTerms) + "</div>"
        : "")
    );
  }

  function buildBundleCourseListEl(bundle) {
    var wrap = document.createElement("div");
    wrap.className = "bundle-course-list";
    var contents = BUNDLE_CONTENTS[bundle.id] || [];
    contents.forEach(function (c) {
      var isFlat = /Flat/i.test(c.status || "");
      var item = document.createElement("div");
      item.className = "bundle-course-item";
      item.innerHTML =
        '<div class="bundle-course-name">' + escapeHtml(c.name) + "</div>" +
        '<div class="bundle-course-meta">' +
        '<span class="pill">' + escapeHtml(c.category) + "</span>" +
        '<span class="pill ' + (isFlat ? "pill-accent" : "") + '">' + escapeHtml(c.status) + "</span>" +
        '<span class="msrp-cell">' + fmtMoney(c.msrp) + "</span>" +
        "</div>";
      item.addEventListener("click", function (e) {
        e.stopPropagation();
        var full = findCourseByName(c.name);
        if (full) openCourseDetailModal(full, c.status);
      });
      wrap.appendChild(item);
    });
    return wrap;
  }

  // ---------- list (table) rendering: courses ----------

  function altTagPillsHtml(tags) {
    if (!tags || !tags.length) return "";
    return (
      '<div class="row-tags">' +
      tags
        .map(function (t) {
          return '<span class="pill">' + escapeHtml(t) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function buildCatalogRow(c, q) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td data-label="Course Name" class="course-name-cell">' + highlight(c.name, q) + altTagPillsHtml(c.altTags) + "</td>" +
      '<td data-label="Category"><span class="pill">' + escapeHtml(c.category) + "</span></td>" +
      '<td data-label="Course Type">' + escapeHtml(c.type) + "</td>" +
      '<td data-label="Industries">' + escapeHtml(c.industries || "-") + "</td>" +
      '<td data-label="Duration">' + escapeHtml(c.duration) + "</td>" +
      '<td data-label="MSRP" class="msrp-cell">' + fmtMoney(c.msrp) + "</td>";

    var detailTr = document.createElement("tr");
    detailTr.className = "detail-row";
    detailTr.hidden = true;
    var td = document.createElement("td");
    td.colSpan = 6;
    td.innerHTML = detailGridHtml(c);
    detailTr.appendChild(td);

    tr.addEventListener("click", function () {
      detailTr.hidden = !detailTr.hidden;
    });

    return [tr, detailTr];
  }

  function buildCatalogCard(c, q) {
    var card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML =
      '<div class="card-top">' +
      '<div class="card-name">' + highlight(c.name, q) + "</div>" +
      "</div>" +
      '<div class="card-pills">' +
      '<span class="pill">' + escapeHtml(c.category) + "</span>" +
      '<span class="pill">' + escapeHtml(c.type) + "</span>" +
      "</div>" +
      altTagPillsHtml(c.altTags) +
      (c.industries ? '<div class="card-industries">' + escapeHtml(c.industries) + "</div>" : "") +
      '<div class="card-meta-row"><span>' + escapeHtml(c.duration) + '</span><span class="msrp-cell">' + fmtMoney(c.msrp) + "</span></div>";
    card.addEventListener("click", function () {
      openCourseDetailModal(c);
    });
    return card;
  }

  // ---------- list (table) rendering: bundles ----------

  function buildBundleListRow(b, q) {
    var savingsPct = fmtSavingsPct(b.savings);
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td data-label="Bundle Name" class="course-name-cell">' + highlight(b.name, q) + "</td>" +
      '<td data-label="Type"><span class="pill">' + escapeHtml(b.type) + "</span></td>" +
      '<td data-label="Price Tier">' + escapeHtml(b.priceTier) + "</td>" +
      '<td data-label="# Courses">' + fmtNumber(b.totalCourses) + "</td>" +
      '<td data-label="Price / Seat / Yr" class="msrp-cell">' + fmtMoney(b.bundlePrice) + "</td>" +
      '<td data-label="Savings">' + (savingsPct !== null ? savingsPct + "%" : "-") + "</td>";

    var detailTr = document.createElement("tr");
    detailTr.className = "detail-row";
    detailTr.hidden = true;
    var td = document.createElement("td");
    td.colSpan = 6;
    td.innerHTML = bundleStatsHtml(b) + '<div class="modal-section-title">Courses in this bundle</div>';
    td.appendChild(buildBundleCourseListEl(b));
    detailTr.appendChild(td);

    tr.addEventListener("click", function () {
      detailTr.hidden = !detailTr.hidden;
    });

    return [tr, detailTr];
  }

  function buildBundleGridCard(b, q) {
    var savingsPct = fmtSavingsPct(b.savings);
    var card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML =
      '<div class="card-top">' +
      '<div class="card-name">' + highlight(b.name, q) + "</div>" +
      "</div>" +
      '<div class="card-pills">' +
      '<span class="pill">' + escapeHtml(b.type) + "</span>" +
      '<span class="pill">' + escapeHtml(b.priceTier) + "</span>" +
      "</div>" +
      '<div class="card-industries">' + fmtNumber(b.totalCourses) + " courses" + "</div>" +
      '<div class="card-meta-row"><span>' + (savingsPct !== null ? savingsPct + "% savings" : "") + '</span><span class="msrp-cell">' + fmtMoney(b.bundlePrice) + "</span></div>";
    card.addEventListener("click", function () {
      openBundleDetailModal(b);
    });
    return card;
  }

  // ---------- modal ----------

  function openModal(title) {
    els.modalTitle.textContent = title;
    els.modalOverlay.hidden = false;
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
    els.modalBody.innerHTML = "";
  }

  function openCourseDetailModal(c, extraStatus) {
    openModal(c.name);
    els.modalBody.innerHTML =
      '<div class="card-pills" style="margin-bottom:14px;">' +
      '<span class="pill">' + escapeHtml(c.category) + "</span>" +
      '<span class="pill">' + escapeHtml(c.type) + "</span>" +
      '<span class="pill">' + escapeHtml(c.duration) + "</span>" +
      '<span class="pill msrp-cell">' + fmtMoney(c.msrp) + "</span>" +
      "</div>" +
      detailGridHtml(c, extraStatus);
  }

  function openBundleDetailModal(b) {
    openModal(b.name);
    els.modalBody.innerHTML = bundleStatsHtml(b) + '<div class="modal-section-title">Courses in this bundle</div>';
    els.modalBody.appendChild(buildBundleCourseListEl(b));
  }

  // ---------- main render ----------

  function setView(view) {
    state.view = view;
    localStorage.setItem(VIEW_STORAGE_KEY, view);
    els.viewListBtn.classList.toggle("active", view === "list");
    els.viewGridBtn.classList.toggle("active", view === "grid");
    els.viewListBtn.setAttribute("aria-pressed", view === "list");
    els.viewGridBtn.setAttribute("aria-pressed", view === "grid");
    els.resultsTable.hidden = view !== "list";
    els.resultsGrid.hidden = view !== "grid";
  }

  function setMode(mode) {
    state.mode = mode;
    localStorage.setItem(MODE_STORAGE_KEY, mode);
    els.modeCoursesBtn.classList.toggle("active", mode === "courses");
    els.modeBundlesBtn.classList.toggle("active", mode === "bundles");
    els.modeCoursesBtn.setAttribute("aria-pressed", mode === "courses");
    els.modeBundlesBtn.setAttribute("aria-pressed", mode === "bundles");
    els.search.placeholder = mode === "bundles" ? "Search by bundle name…" : "Search by course name or tag…";
    populateSortSelect();
    render();
  }

  function render() {
    var f = currentFilters();
    var isBundles = state.mode === "bundles";

    var rows, rowBuilder, cardBuilder, noun;
    if (isBundles) {
      rows = filterBundles(f);
      els.tableHead.innerHTML = bundlesTableHeadHtml;
      rowBuilder = buildBundleListRow;
      cardBuilder = buildBundleGridCard;
      noun = "bundle";
    } else {
      rows = filterCatalog(f);
      els.tableHead.innerHTML = catalogTableHeadHtml;
      rowBuilder = buildCatalogRow;
      cardBuilder = buildCatalogCard;
      noun = "course";
    }
    rows = sortRows(rows, state.mode);

    els.resultCount.innerHTML = "<strong>" + fmtNumber(rows.length) + "</strong> " + noun + (rows.length === 1 ? "" : "s") + " found";

    els.resultsBody.innerHTML = "";
    els.resultsGrid.innerHTML = "";

    if (rows.length === 0) {
      els.resultsWrap.hidden = true;
      els.emptyState.hidden = false;
      return;
    }
    els.resultsWrap.hidden = false;
    els.emptyState.hidden = true;

    var tableFrag = document.createDocumentFragment();
    var gridFrag = document.createDocumentFragment();

    rows.forEach(function (item) {
      rowBuilder(item, f.q).forEach(function (el) {
        tableFrag.appendChild(el);
      });
      gridFrag.appendChild(cardBuilder(item, f.q));
    });

    els.resultsBody.appendChild(tableFrag);
    els.resultsGrid.appendChild(gridFrag);
  }

  function clearFilters() {
    els.search.value = "";
    els.industry.value = "";
    els.category.value = "";
    state.sort[state.mode] = "name:asc";
    els.sort.value = "name:asc";
    render();
  }

  function init() {
    rebuildSelect(els.industry, INDUSTRIES, "All Industries");
    rebuildSelect(els.category, CATEGORIES, "All Categories");

    els.search.addEventListener("input", render);
    els.category.addEventListener("change", function () {
      if (els.category.value) els.industry.value = "";
      render();
    });
    els.industry.addEventListener("change", function () {
      if (els.industry.value) els.category.value = "";
      render();
    });
    els.sort.addEventListener("change", function () {
      state.sort[state.mode] = els.sort.value;
      render();
    });
    els.clear.addEventListener("click", clearFilters);

    els.viewListBtn.addEventListener("click", function () {
      setView("list");
    });
    els.viewGridBtn.addEventListener("click", function () {
      setView("grid");
    });

    els.modeCoursesBtn.addEventListener("click", function () {
      setMode("courses");
    });
    els.modeBundlesBtn.addEventListener("click", function () {
      setMode("bundles");
    });

    els.modalClose.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", function (e) {
      if (e.target === els.modalOverlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.modalOverlay.hidden) closeModal();
    });

    setView(state.view);
    setMode(state.mode);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
