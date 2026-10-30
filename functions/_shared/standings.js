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
