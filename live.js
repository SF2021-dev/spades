/* Diamond Spaders live results: polls /api/live and refreshes winners grids + tour list.
   As soon as today has any winners, yesterday's winners cards are placed in the lower grid
   (below the tours list), replacing whatever was previously there. */
(function () {
  var POLL = 60000, BG_EVEN = "#1a1200";
  var lastTours = null;
  function norm(html) { var t = document.createElement("template"); t.innerHTML = html; return t.innerHTML; }
  function trail(grid, bg) {
    var a = grid && grid.lastElementChild && grid.lastElementChild.querySelector('a[href*="diamondspaders.online/"]');
    if (!a || a.textContent.trim() !== "more") return "";
    return '<div style="padding:14px 10px;background:' + bg + '; display:flex;align-items:center;"><a href="' + a.getAttribute("href")
      + '" style="color:#fbe646;font-size:22px;font-weight:800;text-decoration:underline;">more</a></div>';
  }
  function body(day, heading) {
    return (heading ? day.heading_html : "") + (day.cells.length ? day.cells.join("") : day.empty_html);
  }
  function apply(d) {
    if (!d || !d.ok || !d.days || !d.today) return;
    var gT = document.getElementById("ds-winners-today"), gY = document.getElementById("ds-winners-yesterday");
    var keys = Object.keys(d.days).sort().reverse();          // [today, yesterday, day before]
    var todayKey = keys[0], yestKey = keys[1], beforeKey = keys[2];
    var today = d.days[todayKey] || { cells: [] };
    var todayHasWinner = today.cells && today.cells.length > 0;

    // Top grid: today if it has winners, otherwise yesterday
    var topKey = todayHasWinner ? todayKey : yestKey;
    // Lower grid (below tours): yesterday once today has a winner, otherwise the day before
    var lowerKey = todayHasWinner ? yestKey : beforeKey;

    var top = d.days[topKey], lower = d.days[lowerKey];
    if (gT && top) {
      var wantT = norm(body(top, topKey !== todayKey));
      if (norm(gT.innerHTML) !== wantT) gT.innerHTML = wantT;
    }
    if (gY && lower) {
      var wantY = norm(body(lower, true) + (lower.cells.length ? trail(gY, lower.cells.length % 2 === 0 ? BG_EVEN : "#000") : ""));
      if (norm(gY.innerHTML) !== wantY) gY.innerHTML = wantY;
    }

    if (d.tours && window.dsSetTours) {
      var j = JSON.stringify(d.tours);
      if (j !== lastTours) window.dsSetTours(d.tours);
      lastTours = j;
    }
  }
  var busy = false;
  function poll() {
    if (busy || document.hidden) return;
    busy = true;
    fetch("/update/live.json?v=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(apply).catch(function () {}).then(function () { busy = false; });
  }
  poll();
  setInterval(poll, POLL);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
})();
