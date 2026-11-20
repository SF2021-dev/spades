/* Winners grids from /api/live (fed every 5 min by the Cloudflare cron worker "diamondspaders-winners"), so new
   winners show even while the box that rewrites index.html is asleep. Tours list is refreshed by index.html itself.
   If the ask fails, or the answer would show fewer winners for the same day than the page already has, the page is left alone. */
(function () {
  var POLL = 60000, BG_EVEN = "#1a1200";
  function norm(html) { var t = document.createElement("template"); t.innerHTML = html; return t.innerHTML; }
  function cellsShown(grid) { return grid ? grid.querySelectorAll(':scope > div:not([style*="grid-column"])').length : 0; }
  function heading(grid) { var h = grid && grid.querySelector(':scope > div[style*="grid-column"]'); return h ? h.textContent.trim() : ""; }
  function trail(grid, bg) {
    var a = grid && grid.lastElementChild && grid.lastElementChild.querySelector('a[href*="diamondspaders.online/"]');
    if (!a || a.textContent.trim() !== "more") return "";
    return '<div style="padding:14px 10px;background:' + bg + '; display:flex;align-items:center;"><a href="' + a.getAttribute("href")
      + '" style="color:#fbe646;font-size:22px;font-weight:800;text-decoration:underline;">more</a></div>';
  }
  function put(grid, day, withTrail) {
    if (!grid || !day) return;
    var tmp = document.createElement("div"); tmp.innerHTML = day.heading_html;
    var sameDay = heading(grid) === tmp.textContent.trim();
    var had = cellsShown(grid) - (trail(grid, "") ? 1 : 0);
    if (sameDay && day.cells.length < had) return;                       // never take winners away
    var html = day.heading_html + (day.cells.length ? day.cells.join("") : day.empty_html)
      + (withTrail && day.cells.length ? trail(grid, day.cells.length % 2 === 0 ? BG_EVEN : "#000") : "");
    var want = norm(html);
    if (norm(grid.innerHTML) !== want) grid.innerHTML = want;
  }
  function apply(d) {
    if (!d || !d.ok || !d.days || !d.today) return;
    var keys = Object.keys(d.days).sort().reverse();          // [today, yesterday, day before]
    var today = d.days[keys[0]] || { cells: [] };
    var has = today.cells && today.cells.length > 0;          // roll over only once today has its first winner
    put(document.getElementById("ds-winners-today"), d.days[has ? keys[0] : keys[1]], false);
    put(document.getElementById("ds-winners-yesterday"), d.days[has ? keys[1] : keys[2]], true);
  }
  var busy = false;
  function poll() {
    if (busy || document.hidden) return;
    busy = true;
    fetch("/api/live?v=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(apply).catch(function () {}).then(function () { busy = false; });
  }
  poll();
  setInterval(poll, POLL);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
})();
