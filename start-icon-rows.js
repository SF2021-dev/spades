/* Always 4 icon rows on /start and /start2 (and their edit pages).
   k = ceil(N/4):
     N = 4k     → four rows of k
     N = 4k-1   → top row k-1, other three k
     N = 4k-2   → top two rows k-1, bottom two k
     N = 4k-3   → top three rows k-1, bottom row k
   Width no longer changes the row count.

   Icon size is computed on load and resize. Grow the icons so the
   grid spans from the left edge to the weather/clock panel, with the
   left gap and the gap to that panel each at most half an icon.
   Cap the size if that would overlap the search input at the top or
   extend below the viewport (or the hint). Inter-icon and row gaps
   scale proportionally with icon size. If height (or search) caps
   the size, center the narrower grid in the available width. */
(function (w) {
  var timer = null, busy = false, styleTag = null;
  var MIN_SIZE = 24;
  var TOP_CLEAR = 16;
  var BOTTOM_CLEAR = 8;

  function areaEl() { return document.querySelector(".icons-area"); }

  function iconsIn(area) {
    return Array.prototype.slice.call(area.querySelectorAll("a.icon-sq"));
  }

  function extras(area) {
    return Array.prototype.slice.call(area.children).filter(function (n) {
      return !(n.classList && n.classList.contains("icon-row"));
    });
  }

  function ensureStyle() {
    if (styleTag) return;
    styleTag = document.createElement("style");
    styleTag.setAttribute("data-start-icon-rows", "1");
    styleTag.textContent = [
      ".icons-area.start-icon-fitted { gap: var(--start-row-gap, 16px); }",
      ".icons-area.start-icon-fitted .icon-row { gap: var(--start-icon-gap, 14px); justify-content: center; }",
      ".icons-area.start-icon-fitted .icon-sq { width: var(--start-icon-size) !important; height: var(--start-icon-size) !important; border-radius: var(--start-icon-radius, 10px); }",
      ".icons-area.start-icon-fitted .icon-sq { font-size: var(--start-icon-font, 28px); }"
    ].join("\n");
    document.head.appendChild(styleTag);
  }

  function measureDefaults(area, icons) {
    var icon = icons[0];
    var iw = 0;
    if (icon) {
      var cs = w.getComputedStyle(icon);
      if (area.classList.contains("start-icon-fitted")) {
        iw = parseFloat(area.getAttribute("data-icon-natural")) || 0;
      }
      if (!iw) iw = icon.offsetWidth;
      if (!iw) iw = parseFloat(cs.width) || 0;
    }
    if (!iw) iw = 68;
    var gap = 14, rowGap = 16;
    var row = area.querySelector(".icon-row");
    if (row && !area.classList.contains("start-icon-fitted")) {
      var g = parseFloat(w.getComputedStyle(row).columnGap || w.getComputedStyle(row).gap);
      if (isFinite(g)) gap = g;
    } else if (area.getAttribute("data-icon-gap")) {
      gap = parseFloat(area.getAttribute("data-icon-gap")) || gap;
    }
    if (!area.classList.contains("start-icon-fitted")) {
      var rg = parseFloat(w.getComputedStyle(area).rowGap || w.getComputedStyle(area).gap);
      if (isFinite(rg)) rowGap = rg;
      var radius = 10, font = 28;
      if (icon) {
        var ics = w.getComputedStyle(icon);
        var r = parseFloat(ics.borderTopLeftRadius);
        if (isFinite(r) && r > 0) radius = r;
        var f = parseFloat(ics.fontSize);
        if (isFinite(f) && f > 0) font = f;
      }
      area.setAttribute("data-icon-natural", String(iw));
      area.setAttribute("data-icon-gap", String(gap));
      area.setAttribute("data-row-gap", String(rowGap));
      area.setAttribute("data-icon-radius", String(radius));
      area.setAttribute("data-icon-font", String(font));
    } else {
      iw = parseFloat(area.getAttribute("data-icon-natural")) || iw;
      gap = parseFloat(area.getAttribute("data-icon-gap")) || gap;
      rowGap = parseFloat(area.getAttribute("data-row-gap")) || rowGap;
    }
    return { icon: iw, gap: gap, rowGap: rowGap };
  }

  function boxOf(sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var r = el.getBoundingClientRect();
    if (!r || (r.width <= 0 && r.height <= 0 && r.left === 0 && r.top === 0)) return null;
    return r;
  }

  function layoutBounds() {
    var vw = w.innerWidth, vh = w.innerHeight;
    var panelLeft = vw;
    [".clock", ".wx"].forEach(function (sel) {
      var r = boxOf(sel);
      if (r && r.left < panelLeft) panelLeft = r.left;
    });
    if (!(panelLeft > 0 && panelLeft < vw)) {
      var area = areaEl();
      var ar = area && area.getBoundingClientRect();
      panelLeft = ar && ar.width > 0 ? ar.right : vw;
    }

    var topBar = 0;
    [".search", ".edit-bar", "a.back"].forEach(function (sel) {
      var r = boxOf(sel);
      if (r && r.bottom > topBar) topBar = r.bottom;
    });
    var topLimit = Math.max(0, topBar + TOP_CLEAR);

    var bottomLimit = vh - BOTTOM_CLEAR;
    var hint = boxOf(".hint");
    if (hint && hint.height > 0 && hint.top - 4 < bottomLimit) {
      bottomLimit = hint.top - 4;
    }
    if (bottomLimit < topLimit + MIN_SIZE) bottomLimit = vh - BOTTOM_CLEAR;

    return {
      vw: vw,
      vh: vh,
      panelLeft: panelLeft,
      topLimit: topLimit,
      bottomLimit: bottomLimit,
      availW: Math.max(0, panelLeft),
      availH: Math.max(0, bottomLimit - topLimit)
    };
  }

  function rowSizes(n) {
    if (n <= 0) return [];
    if (n <= 4) {
      var ones = [];
      for (var i = 0; i < n; i++) ones.push(1);
      return ones;
    }
    var k = Math.ceil(n / 4);
    var rem = n % 4;
    if (rem === 0) return [k, k, k, k];
    if (rem === 3) return [k - 1, k, k, k];
    if (rem === 2) return [k - 1, k - 1, k, k];
    return [k - 1, k - 1, k - 1, k];
  }

  function applyFit(area, m, longRow, rowCount) {
    ensureStyle();
    var b = layoutBounds();
    area.style.left = "0px";
    area.style.right = Math.max(0, b.vw - b.panelLeft) + "px";
    area.style.top = b.topLimit + "px";
    area.style.bottom = Math.max(0, b.vh - b.bottomLimit) + "px";

    var width = b.availW, height = b.availH;
    var gapRatio = m.icon > 0 ? m.gap / m.icon : 0;
    var rowGapRatio = m.icon > 0 ? m.rowGap / m.icon : 0;
    longRow = Math.max(1, longRow || 1);
    rowCount = Math.max(1, rowCount || 4);

    /* Target side gap = size/2, so:
         size + longRow*size + (longRow-1)*gapRatio*size = width
       Height cap: rowCount*size + (rowCount-1)*rowGapRatio*size = height */
    var denomW = longRow + 1 + Math.max(0, longRow - 1) * gapRatio;
    var denomH = rowCount + Math.max(0, rowCount - 1) * rowGapRatio;
    var sizeW = denomW > 0 ? width / denomW : width;
    var sizeH = denomH > 0 ? height / denomH : height;
    if (!isFinite(sizeW) || sizeW < MIN_SIZE) sizeW = MIN_SIZE;
    if (!isFinite(sizeH) || sizeH < MIN_SIZE) sizeH = MIN_SIZE;

    var fitAt = function (s) {
      var g = gapRatio * s;
      var rg = rowGapRatio * s;
      var gridW = longRow * s + Math.max(0, longRow - 1) * g;
      var gridH = rowCount * s + Math.max(0, rowCount - 1) * rg;
      return gridW <= width + 0.01 && gridH <= height + 0.01;
    };
    var size;
    if (sizeW <= sizeH) {
      /* Width is binding: ceil so side gaps stay <= size/2. */
      var ceilW = Math.ceil(sizeW - 1e-9);
      size = (ceilW >= MIN_SIZE && fitAt(ceilW) && ceilW <= sizeH + 0.01) ? ceilW : sizeW;
    } else {
      var fl = Math.floor(sizeH);
      size = (fl >= MIN_SIZE && fitAt(fl)) ? fl : sizeH;
    }
    if (!isFinite(size) || size < MIN_SIZE) size = MIN_SIZE;

    var gap = gapRatio * size;
    var rowGap = rowGapRatio * size;
    if (gap < 0) gap = 0;
    if (rowGap < 0) rowGap = 0;

    var capped = sizeH + 0.01 < sizeW;
    var binding = capped ? "height" : "width";
    var naturalR = parseFloat(area.getAttribute("data-icon-radius")) || 10;
    var naturalF = parseFloat(area.getAttribute("data-icon-font")) || 28;
    var scale = m.icon > 0 ? size / m.icon : 1;

    area.style.setProperty("--start-icon-gap", gap + "px");
    area.style.setProperty("--start-row-gap", rowGap + "px");
    area.style.setProperty("--start-icon-size", size + "px");
    area.style.setProperty("--start-icon-radius", (naturalR * scale) + "px");
    area.style.setProperty("--start-icon-font", (naturalF * scale) + "px");
    area.classList.add("start-icon-fitted");
    area.setAttribute("data-icon-fitted-size", String(size));
    area.setAttribute("data-icon-binding", binding);
  }

  function balance() {
    var area = areaEl();
    if (!area) return;
    var icons = iconsIn(area);
    if (!icons.length) return;
    var m = measureDefaults(area, icons);
    var sizes = rowSizes(icons.length);
    var longRow = 0;
    sizes.forEach(function (s) { if (s > longRow) longRow = s; });
    applyFit(area, m, longRow, sizes.length);
    var rest = extras(area);
    var same = area.querySelectorAll(".icon-row").length === sizes.length;
    if (same) {
      var rows = area.querySelectorAll(".icon-row");
      for (var s = 0; s < sizes.length; s++) {
        if (rows[s].querySelectorAll("a.icon-sq").length !== sizes[s]) { same = false; break; }
      }
    }
    if (same) return;
    busy = true;
    var frag = document.createDocumentFragment();
    var i = 0;
    sizes.forEach(function (k) {
      var row = document.createElement("div");
      row.className = "icon-row";
      for (var j = 0; j < k; j++) row.appendChild(icons[i++]);
      frag.appendChild(row);
    });
    rest.forEach(function (n) { frag.appendChild(n); });
    while (area.firstChild) area.removeChild(area.firstChild);
    area.appendChild(frag);
    busy = false;
  }

  function schedule() {
    if (busy) return;
    clearTimeout(timer);
    timer = setTimeout(balance, 50);
  }

  w.balanceStartIconRows = balance;
  w._startIconRowSizes = rowSizes;

  function start() {
    balance();
    w.addEventListener("resize", schedule);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window);
