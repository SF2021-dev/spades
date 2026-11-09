// Canonical member name from MyLeague standings pages 1-4; false if not found, null if unreachable.
export async function findMember(name) {
  const want = String(name || "").trim().toLowerCase(); if (!want) return false; let ok = 0;
  const pages = await Promise.all([1,2,3,4].map(async (p) => {
    try {
      const r = await fetch("https://www.myleague.com/diamondspaders/standings" + (p > 1 ? "?p=" + p : ""), { headers: { "User-Agent": "Mozilla/5.0 DiamondSpadersOnline" }, cf: { cacheTtl: 600, cacheEverything: true } });
      if (!r.ok) return ""; ok++; return await r.text();
    } catch (e) { return ""; }
  }));
  if (!ok) return null;
  for (const html of pages)
    for (const m of html.matchAll(/\/diamondspaders\/profile\/([^"'?#\/]+)/g)) {
      let n; try { n = decodeURIComponent(m[1]); } catch { continue; }
      if (n.toLowerCase() === want) return n;
    }
  return false;
}

// lowercase -> canonical-case name map from the standings pages (cached per isolate 10 min); {} if unreachable.
let _sm = null, _smT = 0;
export async function standingsMap() {
  if (_sm && Date.now() - _smT < 600e3) return _sm;
  const pages = await Promise.all([1,2,3,4].map(async (p) => {
    try {
      const r = await fetch("https://www.myleague.com/diamondspaders/standings" + (p > 1 ? "?p=" + p : ""), { headers: { "User-Agent": "Mozilla/5.0 DiamondSpadersOnline" }, cf: { cacheTtl: 600, cacheEverything: true } });
      return r.ok ? await r.text() : "";
    } catch (e) { return ""; }
  }));
  const m = {};
  for (const html of pages)
    for (const x of html.matchAll(/\/diamondspaders\/profile\/([^"'?#\/]+)/g)) { try { const n = decodeURIComponent(x[1]); m[n.toLowerCase()] = m[n.toLowerCase()] || n; } catch {} }
  if (Object.keys(m).length) { _sm = m; _smT = Date.now(); }
  return m;
}
// Display name in canonical case (standings spelling), else as given.
export async function canonFn() { const m = await standingsMap(); return (n) => (n && m[String(n).toLowerCase()]) || n; }
