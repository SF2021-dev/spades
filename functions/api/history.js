// GET /api/history?p=Name&a=Alias... -> tours entered in the last 30 days per league, from each league's public Ladderbux log.
import REG from "../../ask/leagues.json";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120";
const LEAGUES = { diamondspaders: "Diamond Spaders", hardwood: "Just4Fun", teamtfriends: "Team T Friends", ams: "AMS", dagreathoudini: "da Great Houdini", fantasyspaders: "Fantasy Spaders" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });

async function bux(srv, slug, player) {
  const body = new URLSearchParams({ name: "", pass: "", final: "1", path: slug, playername: player, timespan: "all" });
  const t = await (await fetch(`https://${srv}.igl.net/tourneysystem/buxlog.php`, { method: "POST", body,
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } })).text();
  const nm = t.match(/([^\s>|]+) LadderBux Log \(Player I\.D\. is (\d+)\)/);
  if (!nm) return null;
  const cells = [...t.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
  const tours = {};
  for (let i = 0; i + 4 < cells.length; i++) {
    const d = cells[i].match(/^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)/);
    if (!d || !/^\d+$/.test(cells[i + 1])) continue;
    const id = cells[i + 1], act = cells[i + 3];
    const et = new Date(Date.UTC(+d[3], +d[1] - 1, +d[2], +d[4] + 3, +d[5]));   // log is Pacific; ET = +3h
    const x = tours[id] || (tours[id] = { id, d: et.toISOString().slice(0, 10), t: et.toISOString().slice(11, 16), e: false, p: "", b: 0 });
    if (/^Entry Fee/.test(act)) x.e = true;
    const pl = act.match(/(\d+)(?:st|nd|rd|th) Place/); if (pl && !x.p) x.p = pl[1];
    const w = act.match(/Won: ([\d,]+)/); if (w) x.b += +w[1].replace(/,/g, "");
    i += 4;
  }
  const cut = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  return { name: nm[1], tours: Object.values(tours).filter(x => x.e && x.d >= cut).map(({ e, ...r }) => r) };
}
async function buxAny(slug, player) {
  const first = (REG.servers || {})[slug] || "cgi6", order = [first, first === "cgi6" ? "plus2" : "cgi6"];
  for (const s of order) { try { const r = await bux(s, slug, player); if (r) return r; } catch (e) {} }
  return null;
}
export async function onRequestGet({ request }) {
  const sp = new URL(request.url).searchParams;
  const names = [sp.get("p"), ...sp.getAll("a")].map(x => (x || "").trim()).filter(Boolean)
    .filter((v, i, a) => a.findIndex(y => y.toLowerCase() === v.toLowerCase()) === i).slice(0, 6);
  if (!names.length) return json({ error: "no name" }, 400);
  const players = await Promise.all(names.map(async n => {
    const per = {};
    await Promise.all(Object.keys(LEAGUES).map(async L => { const r = await buxAny(L, n); if (r && r.tours.length) per[L] = r; }));
    const name = (Object.values(per)[0] || {}).name || null;
    return { q: n, name, leagues: Object.fromEntries(Object.entries(per).map(([L, r]) => [L, r.tours])) };
  }));
  return json({ leagues: LEAGUES, players });
}
