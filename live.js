/* Diamond Spaders live results: polls /api/live (Cloudflare Pages Function reading the MyLeague calendar, ~60 s cache)
   and refreshes the two winners grids and the tour list whenever they differ from what this page shows, so results
   appear even when the box that republishes index.html is asleep. It renders exactly what the box would publish
   (same labels / manual winners / teams / avatars via /live/config.json) and never invents a winner. */
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
    var today = d.days[keys[0]];
    var top = today.cells.length ? keys[0] : keys[1], second = today.cells.length ? keys[1] : keys[2];
    if (gT && gY && d.days[top] && d.days[second]) {
      var t = d.days[top], s = d.days[second];
      var wantT = norm(body(t, top !== keys[0]));
      var wantY = norm(body(s, true) + (s.cells.length ? trail(gY, s.cells.length % 2 === 0 ? BG_EVEN : "#000") : ""));
      if (norm(gT.innerHTML) !== wantT) gT.innerHTML = wantT;
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
    fetch("/api/live", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(apply).catch(function () {}).then(function () { busy = false; });
  }
  poll();
  setInterval(poll, POLL);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
})();
