/* Balance start-page icon rows: same count per row when N divides evenly
   (e.g. 12 icons with room for 8 → 2×6; 9 with room for 7 → 3×3).
   Otherwise rows differ by at most one. Recomputes on resize. */
(function (w) {
  var timer = null, busy = false;

  function areaEl() { return document.querySelector(".icons-area"); }

  function iconsIn(area) {
    return Array.prototype.slice.call(area.querySelectorAll("a.icon-sq"));
  }

  function extras(area) {
    return Array.prototype.slice.call(area.children).filter(function (n) {
      return !(n.classList && n.classList.contains("icon-row"));
    });
  }

  function measure(area, icons) {
    var width = area.clientWidth;
    var icon = icons[0];
    var iw = icon ? icon.offsetWidth : 0;
    if (!iw && icon) iw = parseFloat(w.getComputedStyle(icon).width) || 0;
    if (!iw) iw = 68;
    var gap = 14;
    var row = area.querySelector(".icon-row");
    if (row) {
      var g = parseFloat(w.getComputedStyle(row).columnGap || w.getComputedStyle(row).gap);
      if (isFinite(g)) gap = g;
    }
    return { width: width, icon: iw, gap: gap };
  }

  function rowSizes(n, maxCols) {
    if (n <= 0) return [];
    maxCols = Math.max(1, maxCols);
    if (n <= maxCols) return [n];
    var d;
    for (d = Math.min(maxCols, n); d >= 2; d--) {
      if (n % d === 0) {
        var even = [];
        for (var i = 0, rows = n / d; i < rows; i++) even.push(d);
        return even;
      }
    }
    var rowCount = Math.ceil(n / maxCols);
    var base = Math.floor(n / rowCount);
    var rem = n % rowCount;
    var out = [];
    for (var r = 0; r < rowCount; r++) out.push(base + (r < rem ? 1 : 0));
    return out;
  }

  function balance() {
    var area = areaEl();
    if (!area) return;
    var icons = iconsIn(area);
    if (!icons.length) return;
    var m = measure(area, icons);
    if (m.width < 20) return;
    var maxCols = Math.max(1, Math.floor((m.width + m.gap) / (m.icon + m.gap) + 1e-6));
    var sizes = rowSizes(icons.length, maxCols);
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
