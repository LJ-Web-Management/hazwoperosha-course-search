(function () {
  "use strict";

  var VIEW_STORAGE_KEY = "hzw_view_mode_v1";

  var state = {
    view: localStorage.getItem(VIEW_STORAGE_KEY) === "grid" ? "grid" : "list",
  };

  var els = {
    search: document.getElementById("search-input"),
    category: document.getElementById("category-select"),
    industry: document.getElementById("industry-select"),
    bundleIndustry: document.getElementById("bundle-industry-select"),
    bundleCategory: document.getElementById("bundle-category-select"),
    clear: document.getElementById("clear-btn"),
    resultCount: document.getElementById("result-count"),
    bundleCard: document.getElementById("bundle-card"),
    resultsBody: document.getElementById("results-body"),
    resultsWrap: document.getElementById("results-wrap"),
    resultsTable: document.querySelector("table.results-table"),
    resultsGrid: document.getElementById("results-grid"),
    emptyState: document.getElementById("empty-state"),
    tableHead: document.getElementById("table-head"),
    viewListBtn: document.getElementById("view-list-btn"),
    viewGridBtn: document.getElementById("view-grid-btn"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalClose: document.getElementById("modal-close"),
  };

  // ---------- select population ----------

  function rebuildSelect(selectEl, values, placeholder, currentValue) {
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
    selectEl.value = currentValue || "";
  }

  function populateBundleSelects() {
    var byIndustry = BUNDLES.filter(function (b) {
      return b.type === "By Industry";
    });
    var byCategory = BUNDLES.filter(function (b) {
      return b.type === "By Category";
    });

    function fill(selectEl, placeholder, list) {
      var opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = placeholder;
      selectEl.appendChild(opt0);
      list
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        })
        .forEach(function (b) {
          var opt = document.createElement("option");
          opt.value = b.id;
          opt.textContent = b.name;
          selectEl.appendChild(opt);
        });
    }

    fill(els.bundleIndustry, "All Industry Bundles", byIndustry);
    fill(els.bundleCategory, "All Category Bundles", byCategory);
  }

  // ---------- helpers ----------

  function fmtMoney(n) {
    if (n === null || n === undefined || n === "") return "—";
    return "$" + Number(n).toFixed(2);
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

  function findCourseByName(name) {
    return COURSES.filter(function (c) {
      return c.name === name;
    })[0];
  }

  var bundleTableHeadHtml =
    "<tr>" +
    "<th>Course Name</th>" +
    "<th>Category</th>" +
    "<th>Course Type</th>" +
    "<th>Duration</th>" +
    "<th>MSRP</th>" +
    "<th>Inclusion</th>" +
    "</tr>";

  var catalogTableHeadHtml =
    "<tr>" +
    "<th>Course Name</th>" +
    "<th>Category</th>" +
    "<th>Course Type</th>" +
    "<th>Industries</th>" +
    "<th>Duration</th>" +
    "<th>MSRP</th>" +
    "</tr>";

  // ---------- bundle summary card ----------

  function renderBundleCard(bundle) {
    if (!bundle) {
      els.bundleCard.hidden = true;
      els.bundleCard.innerHTML = "";
      return;
    }
    var savingsPct = bundle.savings ? Math.round(bundle.savings * 1000) / 10 : null;
    els.bundleCard.hidden = false;
    els.bundleCard.innerHTML =
      '<span class="bundle-type-badge">' + escapeHtml(bundle.type) + "</span>" +
      "<h3>" + escapeHtml(bundle.name) + "</h3>" +
      '<div class="bundle-scope">' + escapeHtml(bundle.scope || "") + "</div>" +
      '<div class="bundle-stats">' +
      '<div class="bundle-stat"><div class="label">Price Tier</div><div class="value">' + escapeHtml(bundle.priceTier) + "</div></div>" +
      '<div class="bundle-stat"><div class="label">Total Courses</div><div class="value">' + escapeHtml(bundle.totalCourses) + "</div></div>" +
      '<div class="bundle-stat"><div class="label">Bundle Price / Seat / Yr</div><div class="value">' + fmtMoney(bundle.bundlePrice) + "</div></div>" +
      '<div class="bundle-stat"><div class="label">À La Carte Cost</div><div class="value">' + fmtMoney(bundle.costSeparate) + "</div></div>" +
      (savingsPct !== null
        ? '<div class="bundle-stat"><div class="label">Savings</div><div class="value">' + savingsPct + "%</div></div>"
        : "") +
      "</div>" +
      (bundle.alaCarteTerms
        ? '<div class="bundle-scope" style="margin-top:10px;"><strong>À la carte terms:</strong> ' + escapeHtml(bundle.alaCarteTerms) + "</div>"
        : "");
  }

  // ---------- filtering ----------

  function currentFilters() {
    return {
      q: els.search.value.trim(),
      category: els.category.value,
      industry: els.industry.value,
      bundleId: els.bundleIndustry.value || els.bundleCategory.value,
    };
  }

  function filterCatalog(f) {
    var q = f.q.toLowerCase();
    return COURSES.filter(function (c) {
      if (f.category && c.category !== f.category) return false;
      if (f.industry && c.industryTags.indexOf(f.industry) === -1) return false;
      if (q) {
        var hay = (c.name + " " + c.category + " " + c.family + " " + (c.industries || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function filterBundleContents(bundleId, q) {
    var list = BUNDLE_CONTENTS[bundleId] || [];
    if (!q) return list;
    var ql = q.toLowerCase();
    return list.filter(function (c) {
      return (c.name + " " + c.category).toLowerCase().indexOf(ql) !== -1;
    });
  }

  // ---------- detail content (shared by list-expand and modal) ----------

  function detailGridHtml(c, extraStatus) {
    return (
      '<div class="detail-grid">' +
      (extraStatus
        ? '<div><div class="label">Bundle Inclusion</div><div class="value"><span class="pill pill-accent">' + escapeHtml(extraStatus) + "</span></div></div>"
        : "") +
      '<div><div class="label">Regulatory Body</div><div class="value">' + escapeHtml(c.regBody || "—") + "</div></div>" +
      '<div><div class="label">Citation</div><div class="value">' + escapeHtml(c.citation || "—") + "</div></div>" +
      '<div><div class="label">Course Family</div><div class="value">' + escapeHtml(c.family || "—") + "</div></div>" +
      '<div><div class="label">Bundle Class</div><div class="value">' + escapeHtml(c.bundleClass || "—") + "</div></div>" +
      '<div><div class="label">Primary Industries</div><div class="value">' + escapeHtml(c.industries || "—") + "</div></div>" +
      '<div><div class="label">Industry Bundle Tags</div><div class="value">' +
      (c.industryTags && c.industryTags.length
        ? c.industryTags
            .map(function (t) {
              return '<span class="pill pill-accent" style="margin:2px 4px 2px 0;">' + escapeHtml(t) + "</span>";
            })
            .join("")
        : "—") +
      "</div></div>" +
      "</div>"
    );
  }

  // ---------- list (table) rendering ----------

  function buildCatalogRow(c, q) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td data-label="Course Name" class="course-name-cell">' + highlight(c.name, q) + "</td>" +
      '<td data-label="Category"><span class="pill">' + escapeHtml(c.category) + "</span></td>" +
      '<td data-label="Course Type">' + escapeHtml(c.type) + "</td>" +
      '<td data-label="Industries">' + escapeHtml(c.industries || "—") + "</td>" +
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

  function buildBundleRow(c, q) {
    var tr = document.createElement("tr");
    var isFlat = /Flat/i.test(c.status || "");
    tr.innerHTML =
      '<td data-label="Course Name" class="course-name-cell">' + highlight(c.name, q) + "</td>" +
      '<td data-label="Category"><span class="pill">' + escapeHtml(c.category) + "</span></td>" +
      '<td data-label="Course Type">' + escapeHtml(c.type) + "</td>" +
      '<td data-label="Duration">' + escapeHtml(c.duration) + "</td>" +
      '<td data-label="MSRP" class="msrp-cell">' + fmtMoney(c.msrp) + "</td>" +
      '<td data-label="Inclusion"><span class="pill ' + (isFlat ? "pill-accent" : "") + '">' + escapeHtml(c.status) + "</span></td>";

    var full = findCourseByName(c.name);
    var detailTr = document.createElement("tr");
    detailTr.className = "detail-row";
    detailTr.hidden = true;
    if (full) {
      var td = document.createElement("td");
      td.colSpan = 6;
      td.innerHTML = detailGridHtml(full, c.status);
      detailTr.appendChild(td);
      tr.addEventListener("click", function () {
        detailTr.hidden = !detailTr.hidden;
      });
    }

    return full ? [tr, detailTr] : [tr];
  }

  // ---------- grid (card) rendering ----------

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
      (c.industries ? '<div class="card-industries">' + escapeHtml(c.industries) + "</div>" : "") +
      '<div class="card-meta-row"><span>' + escapeHtml(c.duration) + '</span><span class="msrp-cell">' + fmtMoney(c.msrp) + "</span></div>";
    card.addEventListener("click", function () {
      openDetailModal(c);
    });
    return card;
  }

  function buildBundleCard(c, q) {
    var card = document.createElement("div");
    card.className = "course-card";
    var isFlat = /Flat/i.test(c.status || "");
    card.innerHTML =
      '<div class="card-top">' +
      '<div class="card-name">' + highlight(c.name, q) + "</div>" +
      "</div>" +
      '<div class="card-pills">' +
      '<span class="pill">' + escapeHtml(c.category) + "</span>" +
      '<span class="pill">' + escapeHtml(c.type) + "</span>" +
      '<span class="pill ' + (isFlat ? "pill-accent" : "") + '">' + escapeHtml(c.status) + "</span>" +
      "</div>" +
      '<div class="card-meta-row"><span>' + escapeHtml(c.duration) + '</span><span class="msrp-cell">' + fmtMoney(c.msrp) + "</span></div>";
    var full = findCourseByName(c.name);
    if (full) {
      card.addEventListener("click", function () {
        openDetailModal(full, c.status);
      });
    }
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

  function openDetailModal(c, extraStatus) {
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

  function render() {
    var f = currentFilters();
    var isBundleMode = !!f.bundleId;
    var bundle = isBundleMode
      ? BUNDLES.filter(function (b) {
          return b.id === f.bundleId;
        })[0]
      : null;

    renderBundleCard(bundle);

    els.industry.disabled = isBundleMode;
    els.category.disabled = isBundleMode;
    els.bundleIndustry.disabled = !!els.bundleCategory.value;
    els.bundleCategory.disabled = !!els.bundleIndustry.value;

    var rows;
    if (isBundleMode) {
      rows = filterBundleContents(f.bundleId, f.q);
      els.tableHead.innerHTML = bundleTableHeadHtml;
    } else {
      rows = filterCatalog(f);
      els.tableHead.innerHTML = catalogTableHeadHtml;
    }

    els.resultCount.innerHTML = "<strong>" + rows.length + "</strong> course" + (rows.length === 1 ? "" : "s") + " found";

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

    rows.forEach(function (c) {
      var rowBuilder = isBundleMode ? buildBundleRow : buildCatalogRow;
      var cardBuilder = isBundleMode ? buildBundleCard : buildCatalogCard;
      rowBuilder(c, f.q).forEach(function (el) {
        tableFrag.appendChild(el);
      });
      gridFrag.appendChild(cardBuilder(c, f.q));
    });

    els.resultsBody.appendChild(tableFrag);
    els.resultsGrid.appendChild(gridFrag);
  }

  function clearFilters() {
    els.search.value = "";
    els.category.value = "";
    els.industry.value = "";
    els.bundleIndustry.value = "";
    els.bundleCategory.value = "";
    render();
  }

  function init() {
    rebuildSelect(els.category, CATEGORIES, "All Categories", "");
    rebuildSelect(els.industry, INDUSTRIES, "All Industries", "");
    populateBundleSelects();

    els.search.addEventListener("input", render);
    els.category.addEventListener("change", render);
    els.industry.addEventListener("change", render);
    els.bundleIndustry.addEventListener("change", function () {
      if (els.bundleIndustry.value) els.bundleCategory.value = "";
      render();
    });
    els.bundleCategory.addEventListener("change", function () {
      if (els.bundleCategory.value) els.bundleIndustry.value = "";
      render();
    });
    els.clear.addEventListener("click", clearFilters);

    els.viewListBtn.addEventListener("click", function () {
      setView("list");
    });
    els.viewGridBtn.addEventListener("click", function () {
      setView("grid");
    });

    els.modalClose.addEventListener("click", closeModal);
    els.modalOverlay.addEventListener("click", function (e) {
      if (e.target === els.modalOverlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !els.modalOverlay.hidden) closeModal();
    });

    setView(state.view);
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
