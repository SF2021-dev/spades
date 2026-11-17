/* Always 4 icon rows on /start and /start2 (and their edit pages).
   k = ceil(N/4):
     N = 4k     → four rows of k
     N = 4k-1   → top row k-1, other three k
     N = 4k-2   → top two rows k-1, bottom two k
     N = 4k-3   → top three rows k-1, bottom row k
   Width no longer changes the row count. If a row would overflow,
   shrink icon gaps (then icon size only if gap is already 0). */
(function (w) {
  var timer = null, busy = false, styleTag = null;

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
      ".icons-area.start-icon-fitted .icon-sq { width: var(--start-icon-size) !important; height: var(--start-icon-size) !important; }"
    ].join("\n");
    document.head.appendChild(styleTag);
  }

  function measureDefaults(area, icons) {
    var icon = icons[0];
    var iw = 0;
    if (icon) {
      /* Prefer the stylesheet size, not a previously fitted (shrunk) size. */
      var cs = w.getComputedStyle(icon);
      var raw = (cs.getPropertyValue("width") || "").trim();
      /* If we already fitted, read the original from data or CSS without the fitted class. */
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
      area.setAttribute("data-icon-natural", String(iw));
      area.setAttribute("data-icon-gap", String(gap));
      area.setAttribute("data-row-gap", String(rowGap));
    } else {
      iw = parseFloat(area.getAttribute("data-icon-natural")) || iw;
      gap = parseFloat(area.getAttribute("data-icon-gap")) || gap;
      rowGap = parseFloat(area.getAttribute("data-row-gap")) || rowGap;
    }
    return { width: area.clientWidth, height: area.clientHeight, icon: iw, gap: gap, rowGap: rowGap };
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
    var width = m.width, height = m.height;
    var size = m.icon, gap = m.gap, rowGap = m.rowGap;
    if (longRow >= 2 && width > 20) {
      var need = longRow * size + (longRow - 1) * gap;
      if (need > width) {
        gap = (width - longRow * size) / (longRow - 1);
        if (gap < 0) {
          gap = 0;
          size = Math.max(24, Math.floor(width / longRow));
        }
      }
    }
    rowCount = Math.max(1, rowCount || 4);
    if (rowCount >= 2 && height > 20) {
      var needH = rowCount * size + (rowCount - 1) * rowGap;
      if (needH > height) {
        rowGap = (height - rowCount * size) / (rowCount - 1);
        if (rowGap < 0) {
          rowGap = 0;
          var fit = Math.floor(height / rowCount);
          if (fit >= 24 && fit < size) size = fit;
          /* Re-check horizontal fit at the new size */
          if (longRow >= 2 && longRow * size + (longRow - 1) * Math.max(gap, 0) > width) {
            gap = Math.max(0, (width - longRow * size) / (longRow - 1));
          }
        }
      }
    }
    if (gap < 0) gap = 0;
    if (rowGap < 0) rowGap = 0;
    area.style.setProperty("--start-icon-gap", gap + "px");
    area.style.setProperty("--start-row-gap", rowGap + "px");
    area.style.setProperty("--start-icon-size", size + "px");
    area.classList.add("start-icon-fitted");
  }

  function balance() {
    var area = areaEl();
    if (!area) return;
    var icons = iconsIn(area);
    if (!icons.length) return;
    var m = measureDefaults(area, icons);
    if (m.width < 20) return;
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
