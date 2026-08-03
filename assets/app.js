(function () {
  "use strict";

  var CUSTOM_STORAGE_KEY = "hzw_custom_courses_v1";
  var VIEW_STORAGE_KEY = "hzw_view_mode_v1";

  var state = {
    view: localStorage.getItem(VIEW_STORAGE_KEY) === "grid" ? "grid" : "list",
  };

  var els = {
    search: document.getElementById("search-input"),
    category: document.getElementById("category-select"),
    industry: document.getElementById("industry-select"),
    bundle: document.getElementById("bundle-select"),
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
    addCourseBtn: document.getElementById("add-course-btn"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalTitle: document.getElementById("modal-title"),
    modalBody: document.getElementById("modal-body"),
    modalClose: document.getElementById("modal-close"),
  };

  // ---------- persistence ----------

  function loadCustomCourses() {
    try {
      var raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      list.forEach(function (c) {
        c.isCustom = true;
        COURSES.push(c);
      });
    } catch (e) {
      console.error("Failed to load custom courses", e);
    }
  }

  function saveCustomCourses() {
    var custom = COURSES.filter(function (c) {
      return c.isCustom;
    });
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(custom));
  }

  function ensureCategoryOption(category) {
    if (CATEGORIES.indexOf(category) === -1) {
      CATEGORIES.push(category);
      CATEGORIES.sort();
      rebuildSelect(els.category, CATEGORIES, "All Categories", "");
    }
  }

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

  function populateBundleSelect() {
    var byIndustry = BUNDLES.filter(function (b) {
      return b.type === "By Industry";
    });
    var byCategory = BUNDLES.filter(function (b) {
      return b.type === "By Category";
    });

    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "All Bundles";
    els.bundle.appendChild(opt0);

    function addGroup(label, list) {
      var group = document.createElement("optgroup");
      group.label = label;
      list
        .slice()
        .sort(function (a, b) {
          return a.name.localeCompare(b.name);
        })
        .forEach(function (b) {
          var opt = document.createElement("option");
          opt.value = b.id;
          opt.textContent = b.name;
          group.appendChild(opt);
        });
      els.bundle.appendChild(group);
    }

    addGroup("By Industry", byIndustry);
    addGroup("By Category", byCategory);
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
      bundleId: els.bundle.value,
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

  function removeCourse(id) {
    var idx = COURSES.findIndex(function (c) {
      return c.id === id;
    });
    if (idx !== -1) COURSES.splice(idx, 1);
    saveCustomCourses();
    closeModal();
    render();
  }

  // ---------- list (table) rendering ----------

  function buildCatalogRow(c, q) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      '<td data-label="Course Name" class="course-name-cell">' +
      highlight(c.name, q) +
      (c.isCustom ? ' <span class="pill custom-badge">Custom</span>' : "") +
      "</td>" +
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
    td.innerHTML =
      detailGridHtml(c) +
      (c.isCustom
        ? '<div style="margin-top:14px;"><button type="button" class="btn-danger" data-delete-id="' + escapeHtml(c.id) + '">Delete Custom Course</button></div>'
        : "");
    detailTr.appendChild(td);

    tr.addEventListener("click", function () {
      detailTr.hidden = !detailTr.hidden;
    });

    var delBtn = td.querySelector("[data-delete-id]");
    if (delBtn) {
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (confirm('Delete custom course "' + c.name + '"? This cannot be undone.')) {
          removeCourse(c.id);
        }
      });
    }

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
      (c.isCustom ? '<span class="pill custom-badge">Custom</span>' : "") +
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
      (c.isCustom ? '<span class="pill custom-badge">Custom</span>' : "") +
      "</div>" +
      detailGridHtml(c, extraStatus) +
      (c.isCustom
        ? '<div class="form-actions"><button type="button" class="btn-danger" id="modal-delete-btn">Delete Custom Course</button></div>'
        : "");
    if (c.isCustom) {
      document.getElementById("modal-delete-btn").addEventListener("click", function () {
        if (confirm('Delete custom course "' + c.name + '"? This cannot be undone.')) {
          removeCourse(c.id);
        }
      });
    }
  }

  function openAddCourseModal() {
    openModal("Add Course");
    var courseTypes = Array.from(
      new Set(
        COURSES.map(function (c) {
          return c.type;
        })
      )
    ).sort();
    var bundleClasses = ["Bundle-Eligible", "Certification-Tier (À La Carte)"];

    var industryChecks = INDUSTRIES.map(function (ind) {
      return (
        '<label class="checkbox-item"><input type="checkbox" name="industryTags" value="' +
        escapeHtml(ind) +
        '" />' +
        escapeHtml(ind) +
        "</label>"
      );
    }).join("");

    els.modalBody.innerHTML =
      '<form id="add-course-form">' +
      '<div class="form-grid">' +
      '<div class="field field-full">' +
      '<label for="f-name">Course Name *</label>' +
      '<input type="text" id="f-name" required />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-category">Category *</label>' +
      '<input type="text" id="f-category" list="category-datalist" required />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-type">Course Type</label>' +
      '<input type="text" id="f-type" list="course-type-datalist" placeholder="e.g. Core Course" />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-duration">Suggested Duration</label>' +
      '<input type="text" id="f-duration" placeholder="e.g. 2 Hours" />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-msrp">Est. MSRP (USD)</label>' +
      '<input type="number" id="f-msrp" step="0.01" min="0" placeholder="e.g. 49.99" />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-regbody">Regulatory Body</label>' +
      '<input type="text" id="f-regbody" placeholder="e.g. OSHA" />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-citation">Governing Regulation / Citation</label>' +
      '<input type="text" id="f-citation" placeholder="e.g. 29 CFR 1910.120" />' +
      "</div>" +
      '<div class="field field-full">' +
      '<label for="f-industries">Primary Industries</label>' +
      '<input type="text" id="f-industries" placeholder="e.g. Construction, Manufacturing" />' +
      "</div>" +
      '<div class="field">' +
      '<label for="f-bundleclass">Bundle Class</label>' +
      '<select id="f-bundleclass"><option value="">— None —</option>' +
      bundleClasses
        .map(function (b) {
          return '<option value="' + escapeHtml(b) + '">' + escapeHtml(b) + "</option>";
        })
        .join("") +
      "</select>" +
      "</div>" +
      '<div class="field field-full">' +
      '<label>Industry Bundle Tags</label>' +
      '<div class="checkbox-grid">' + industryChecks + "</div>" +
      '<div class="form-hint">Tagging an industry makes this course appear under that Industry filter.</div>' +
      "</div>" +
      "</div>" +
      '<datalist id="category-datalist">' +
      CATEGORIES.map(function (cat) {
        return '<option value="' + escapeHtml(cat) + '">';
      }).join("") +
      "</datalist>" +
      '<datalist id="course-type-datalist">' +
      courseTypes
        .map(function (t) {
          return '<option value="' + escapeHtml(t) + '">';
        })
        .join("") +
      "</datalist>" +
      '<div class="form-actions">' +
      '<button type="button" class="btn-secondary" id="add-course-cancel">Cancel</button>' +
      '<button type="submit" class="btn-primary">Add Course</button>' +
      "</div>" +
      "</form>";

    document.getElementById("add-course-cancel").addEventListener("click", closeModal);
    document.getElementById("add-course-form").addEventListener("submit", function (e) {
      e.preventDefault();
      submitAddCourseForm();
    });
  }

  function submitAddCourseForm() {
    var name = document.getElementById("f-name").value.trim();
    var category = document.getElementById("f-category").value.trim();
    if (!name || !category) return;

    var checkedTags = Array.prototype.slice
      .call(document.querySelectorAll('input[name="industryTags"]:checked'))
      .map(function (el) {
        return el.value;
      });

    var msrpRaw = document.getElementById("f-msrp").value;
    var newCourse = {
      id: "custom-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      category: category,
      family: name,
      name: name,
      type: document.getElementById("f-type").value.trim() || "Custom Course",
      regBody: document.getElementById("f-regbody").value.trim(),
      citation: document.getElementById("f-citation").value.trim(),
      industries: document.getElementById("f-industries").value.trim(),
      duration: document.getElementById("f-duration").value.trim(),
      msrp: msrpRaw ? parseFloat(msrpRaw) : null,
      bundleClass: document.getElementById("f-bundleclass").value,
      industryTags: checkedTags,
      isCustom: true,
    };

    COURSES.push(newCourse);
    ensureCategoryOption(category);
    saveCustomCourses();
    closeModal();

    clearFilters(false);
    els.search.value = name;
    render();
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

  function clearFilters(shouldRender) {
    els.search.value = "";
    els.category.value = "";
    els.industry.value = "";
    els.bundle.value = "";
    if (shouldRender !== false) render();
  }

  function init() {
    loadCustomCourses();

    rebuildSelect(els.category, CATEGORIES, "All Categories", "");
    rebuildSelect(els.industry, INDUSTRIES, "All Industries", "");
    populateBundleSelect();

    els.search.addEventListener("input", render);
    els.category.addEventListener("change", render);
    els.industry.addEventListener("change", render);
    els.bundle.addEventListener("change", render);
    els.clear.addEventListener("click", function () {
      clearFilters();
    });

    els.viewListBtn.addEventListener("click", function () {
      setView("list");
    });
    els.viewGridBtn.addEventListener("click", function () {
      setView("grid");
    });

    els.addCourseBtn.addEventListener("click", openAddCourseModal);
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
