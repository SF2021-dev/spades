// GET /api/history?p=Name&a=Alias... -> tours the player checked in for, in the selected range
// (&range=1d|1w|1m|90d|6m|1y|all, default 1m). Source is /snoop/data.json (tour rosters), not the
// public Ladderbux log, which truncates heavy players at ~150 rows and misses some leagues.
const LEAGUES = { diamondspaders: "Diamond Spaders", hardwood: "Just4Fun", teamtfriends: "Team T Friends", ams: "AMS", dagreathoudini: "da Great Houdini", fantasyspaders: "Fantasy Spaders" };
const RANGES = { "1d": [1, "1 day"], "1w": [7, "1 week"], "1m": [30, "1 month"], "90d": [90, "90 days"], "6m": [182, "6 months"], "1y": [365, "1 year"], all: [0, "All time"] };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });

function etYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function addDays(iso, n) {
  const p = iso.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  const sp = new URL(request.url).searchParams;
  const rk = RANGES[sp.get("range")] ? sp.get("range") : "1m", days = RANGES[rk][0];
  const names = [sp.get("p"), ...sp.getAll("a")].map(x => (x || "").trim()).filter(Boolean)
    .filter((v, i, a) => a.findIndex(y => y.toLowerCase() === v.toLowerCase()) === i).slice(0, 6);
  if (!names.length) return json({ error: "no name" }, 400);
  let D;
  try {
    const r = await env.ASSETS.fetch(new Request(new URL("/snoop/data.json", request.url)));
    if (!r.ok) throw new Error("bad asset");
    D = await r.json();
  } catch (e) {
    return json({ error: "no data" }, 503);
  }
  const today = etYmd();
  const requestedFrom = days ? addDays(today, -days) : (D.from || null);
  const cut = requestedFrom || "";
  const players = names.map(n => {
    const P = (D.players || {})[n.toLowerCase()];
    if (!P) return { q: n, name: null, leagues: {} };
    const per = {};
    (P.t || []).forEach(i => {
      const tr = (D.tours || [])[i];
      if (!tr || tr.length < 4) return;
      const L = tr[0], id = tr[1], d = tr[2], t = tr[3];
      if (cut && d < cut) return;
      if (d > today) return;
      (per[L] = per[L] || []).push({ id, d, t });
    });
    return { q: n, name: P.n, leagues: per };
  });
  let first = null, last = null;
  players.forEach(P => Object.values(P.leagues).forEach(ts => ts.forEach(t => { if (!first || t.d < first) first = t.d; if (!last || t.d > last) last = t.d; })));
  return json({
    leagues: D.leagues || LEAGUES,
    players,
    range: { key: rk, label: RANGES[rk][1], days, from: requestedFrom || D.from || first, to: today, first, last, coverFrom: D.from || null, coverTo: D.to || today, updated: D.updated || null }
  });
}
