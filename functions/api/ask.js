// POST /api/ask {q} -> {answer}. One question, one answer from MyLeague's calendar feed (+ the tour's TEAMS page).
// Workers AI turns the question into a structured query; code runs it; the model phrases the answer ONLY from the result.
// Leagues: /ask/leagues.json. Limits: /ask/limits.md.
import REG from "../../ask/leagues.json";

const CAL_URL = "https://www.myleague.com/pages/remote/tournamentCalendar.php";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120";
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const RATE_PER_HOUR = 30, MAX_DAYS = 60;

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

// ---------------- dates (ET)
function etNow() {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long", hourCycle: "h23" }).formatToParts(new Date())) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, weekday: p.weekday };
}
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const validDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const fmtTime = (h, m) => `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"} ET`;
const fmtDate = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

// ---------------- leagues
function leagueFor(name) {
  const n = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return REG.default;
  for (const [slug, names] of Object.entries(REG.leagues))
    if (slug === n || names.some(x => x.toLowerCase().replace(/[^a-z0-9]/g, "") === n)) return slug;
  return null;
}
const leagueName = slug => (REG.leagues[slug] || [slug]).find(x => x.length > 3) || slug;
function playerKeys(p) {
  const k = new Set([p.toLowerCase()]);
  for (const [shown, real] of Object.entries(REG.aliases || {})) {
    if (shown.toLowerCase() === p.toLowerCase()) k.add(real.toLowerCase());
    if (real.toLowerCase() === p.toLowerCase()) k.add(shown.toLowerCase());
  }
  return k;
}
const display = n => { for (const [s, r] of Object.entries(REG.aliases || {})) if (r.toLowerCase() === n.toLowerCase()) return s; return n; };

// ---------------- feed
const unxml = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
async function cached(key, ttl, fn) {
  const c = caches.default, k = new Request("https://ask-cache.local/" + encodeURIComponent(key));
  const hit = await c.match(k);
  if (hit) return hit.json();
  const v = await fn();
  await c.put(k, new Response(JSON.stringify(v), { headers: { "cache-control": `max-age=${ttl}` } }));
  return v;
}
async function calendar(slug, start, end) {
  const today = etNow().date;
  return cached(`cal/${slug}/${start}/${end}`, end < today ? 3600 : 120, async () => {
    const [sy, sm, sd] = start.split("-").map(Number), [ey, em, ed] = end.split("-").map(Number);
    const body = new URLSearchParams({ range: "daily", strLadder: slug, DisplayCount: "300", page: "1", sort: "1", sd, sm, sy, ed, em, ey });
    let t = "";
    for (let i = 0; i < 2; i++) {
      const r = await fetch(CAL_URL, { method: "POST", body, headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } });
      t = await r.text();
      if (r.ok && /<SQLResults/.test(t)) break;
      t = "";
    }
    if (!t) throw new Error("feed");
    const out = [], seen = new Set();
    for (const rec of t.split("<objRecord>").slice(1)) {
      const g = tag => { const m = rec.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? unxml(m[1]).trim() : ""; };
      const id = g("tcount"); if (!id || seen.has(id)) continue; seen.add(id);
      const time = +g("time"), date = `${g("year")}-${String(+g("month") + 1).padStart(2, "0")}-${String(+g("day")).padStart(2, "0")}`;
      const st = g("status");
      out.push({ id, date, h: Math.floor(time / 100), m: time % 100, td: g("td"), game: g("location"), perteam: g("perteam"),
        entry: g("entry"), status: st === "-1" ? "cancelled" : st === "2" ? "finished" : "not finished",
        winners: g("winner").split(",").map(w => w.trim()).filter(Boolean),
        url: `https://www.myleague.com/${slug}/tournament/${id}/` });
    }
    return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.h * 60 + a.m) - (b.h * 60 + b.m));
  });
}
async function range(slug, from, to) {
  const all = [];
  for (let d = from; d <= to; d = addDays(d, 10)) {
    const e = addDays(d, 9) < to ? addDays(d, 9) : to;
    all.push(...await calendar(slug, d, e));
  }
  return all.filter(t => t.date >= from && t.date <= to);
}
// Teams + players from the tour's TEAMS page
async function teams(t, slug) {
  return cached(`teams/${slug}/${t.id}`, t.status === "finished" ? 86400 : 300, async () => {
    for (const srv of ["cgi6", "plus2"]) {
      try {
        const page = await (await fetch(`https://${srv}.igl.net/tourneysystem/players.php?tcount=${t.id}&path=${slug}`, { headers: { "User-Agent": UA } })).text();
        const m = page.match(/\$\.parseJSON\('([\s\S]*?)'\);/);
        if (!m) continue;
        const d = JSON.parse(m[1].replace(/\\\\/g, "\x00").replace(/\\'/g, "'").replace(/\x00/g, "\\"));
        return (d.teams || []).map(tm => ({ team: String(tm.team || "").replace(/&amp;/g, "&"),
          players: (tm.players || []).map(p => { const s = p.match(/<strong>(.*?)<\/strong>/); return (s ? s[1] : p.replace(/<[^>]+>/g, "")).trim(); }) }));
      } catch (_) {}
    }
    return null;
  });
}
async function winnerPlayers(t, slug) {
  if (t.winners.length !== 1 || !(+t.perteam > 1)) return null;
  const ts = await teams(t, slug);
  if (!ts) return null;
  const w = t.winners[0].replace(/\s*\(\d+\)$/, "").toLowerCase();
  const hit = ts.find(x => x.team.toLowerCase() === t.winners[0].toLowerCase()) || ts.find(x => x.team.toLowerCase().replace(/\s*\(\d+\)$/, "") === w);
  return hit ? hit.players.map(display) : null;
}
const brief = t => ({ date: fmtDate(t.date), time: fmtTime(t.h, t.m), td: t.td, game: t.game, status: t.status,
  winners: t.winners.map(display), players_per_team: t.perteam, entry: t.entry, tour_id: t.id, url: t.url });

// ---------------- AI
const PARSE_SYS = `You convert one question about MyLeague card tournaments into JSON. Output ONLY a JSON object, no prose.
Fields:
- "league": league name or abbreviation exactly as written in the question, or "" if none mentioned.
- "date_from","date_to": YYYY-MM-DD in US Eastern time. "last night"/"yesterday" = yesterday. A late-night time "last night" (e.g. 11pm) = yesterday. No date mentioned = today, except "last time"/"most recent" questions: use the last 60 days. Weekday names = most recent such day (today or earlier).
- "time": "HH:MM" 24-hour ET if a time is mentioned, else "". A time with no AM/PM from 1:00 to 7:59 means PM (e.g. "1:15" = "13:15"); 8:00 to 11:59 means AM.
- "ask": one of "winner" (who won), "players" (who was on the winning team), "td" (who ran/hosted), "game" (game type/format/rules), "count_tours" (how many tours), "player_wins" (how many / which tours a player won), "last_win" (when a player last won), "list" (what tours ran / all winners), "player_tours" (how many / which tours a player played, entered or joined, when a player last played, a player's placings / 2nd / 3rd places / bux won), "unsupported" (anything else, e.g. standings, ratings, who played, scores).
- "player": player name exactly as written, or "". If the question says "I"/"me"/"my" and gives no name, use "".
- For "player_tours": if no date or period is mentioned, set "date_from" and "date_to" to "" (meaning all time).
Today is {TODAY} ({WEEKDAY}), current ET time {NOW}. Known leagues: {LEAGUES}.`;
const ANSWER_SYS = `You answer one question about MyLeague card tournaments using ONLY the DATA given. Rules:
- Reply with the answer only, in 1-3 short plain sentences. No greeting, no dialogue, no suggestions, no offers, no questions, no requests for clarification.
- Never invent or guess anything not in DATA. If DATA says the information isn't available, say so plainly in one sentence.
- If a tour status is "cancelled", say it was cancelled. If "not finished", say it has no winner yet.
- If DATA marks a tour as "nearest" (no tour at the asked time), say it is the nearest tour that day.
- Name the tour the answer is about (date and time) and give times exactly as in DATA (ET). Include the winning team's players when DATA lists them. Mention the TD when it is in DATA and relevant.`;

async function ai(env, sys, user, max = 300) {
  const r = await env.AI.run(MODEL, { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: max, temperature: 0 });
  const v = r?.response ?? r?.result?.response ?? "";
  return (typeof v === "string" ? v : JSON.stringify(v)).trim();
}
async function parse(env, q, now) {
  const sys = PARSE_SYS.replace("{TODAY}", now.date).replace("{WEEKDAY}", now.weekday).replace("{NOW}", now.time)
    .replace("{LEAGUES}", Object.values(REG.leagues).map(x => x.join("/")).join("; "));
  const txt = await ai(env, sys, q, 200);
  const m = txt.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}


// Player's full tour history: the league's public Ladderbux log (every entry fee + placing bux), cgi6.igl.net, no login.
async function buxlog(slug, player) {
  return cached(`bux/${slug}/${player.toLowerCase()}`, 300, async () => {
    const body = new URLSearchParams({ name: "", pass: "", final: "1", path: slug, playername: player, timespan: "all" });
    const t = await (await fetch("https://cgi6.igl.net/tourneysystem/buxlog.php", { method: "POST", body,
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } })).text();
    const nm = t.match(/([^\s>|]+) LadderBux Log \(Player I\.D\. is (\d+)\)/);
    if (!nm) return null;
    const cells = [...t.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
    const tours = {};
    for (let i = 0; i + 4 < cells.length; i++) {
      const d = cells[i].match(/^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)/);
      if (!d || !/^\d+$/.test(cells[i + 1])) continue;
      const id = cells[i + 1], act = cells[i + 3];
      // log time is Pacific; ET = +3h
      const et = new Date(Date.UTC(+d[3], +d[1] - 1, +d[2], +d[4] + 3, +d[5]));
      const x = tours[id] || (tours[id] = { id, date: et.toISOString().slice(0, 10), time: fmtTime(et.getUTCHours(), et.getUTCMinutes()), entered: false, place: "", bux: 0 });
      if (/^Entry Fee/.test(act)) x.entered = true;
      const pl = act.match(/(\d+)(?:st|nd|rd|th) Place/); if (pl && !x.place) x.place = pl[1];
      const w = act.match(/Won: ([\d,]+)/); if (w) x.bux += +w[1].replace(/,/g, "");
      i += 4;
    }
    return { name: nm[1], list: Object.values(tours).filter(x => x.entered).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id) };
  });
}

// ---------------- run the query
async function run(Q, now) {
  const slug = leagueFor(Q.league);
  if (!slug) return { info: `The league "${Q.league}" is not in the list of leagues this page can read.` };
  const lname = leagueName(slug);
  if (Q.ask === "player_tours") {
    if (!Q.player) return { league: lname, info: "The question does not name a player (\"I\" or \"me\" can't be identified here), so no player's tours could be counted." };
    const h = await buxlog(slug, Q.player);
    if (!h) return { league: lname, info: `No ${lname} tour history was found for a player named ${Q.player}.` };
    const all = validDate(Q.date_from) || validDate(Q.date_to);
    let f = validDate(Q.date_from) ? Q.date_from : "0000-00-00", t2 = validDate(Q.date_to) ? Q.date_to : (validDate(Q.date_from) ? Q.date_from : "9999-99-99");
    const L = h.list.filter(x => x.date >= f && x.date <= t2), first = h.list[0];
    const pc = n => L.filter(x => x.place === n).length;
    const r = { league: lname, player: display(h.name), period: all ? (f === t2 ? fmtDate(f) : `${fmtDate(f)} to ${fmtDate(t2)}`) : `all recorded tours (log starts ${first ? fmtDate(first.date) : "n/a"})`,
      tours_played: L.length, first_place: pc("1"), second_place: pc("2"), third_place: pc("3"), bux_won: L.reduce((a, x) => a + x.bux, 0),
      last_entry_time: L.length ? `${fmtDate(L[L.length - 1].date)} ${L[L.length - 1].time}` : "none",
      source: "the league's Ladderbux log (one entry fee per tour entered; times are when the entry was made)" };
    if (L.length <= 15) r.tours = L.map(x => `tour ${x.id}, entered ${fmtDate(x.date)} ${x.time}${x.place ? ` (place ${x.place})` : ""}`);
    return r;
  }
  let from = validDate(Q.date_from) ? Q.date_from : now.date, to = validDate(Q.date_to) ? Q.date_to : from;
  if (to < from) [from, to] = [to, from];
  if (Q.ask === "last_win") { to = now.date; from = addDays(now.date, -MAX_DAYS); }
  if (from < addDays(now.date, -MAX_DAYS)) return { info: `Only the last ${MAX_DAYS} days of tours can be searched.` };
  if (to > addDays(now.date, 14)) to = addDays(now.date, 14);
  const tours = await range(slug, from, to);
  const base = { league: lname, dates: from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}` };
  const ask = Q.ask;
  if (ask === "unsupported") return { ...base, info: "That kind of information is not in the MyLeague tour data this page can read (it only has tours, TDs, game types and winners)." };

  if (["winner", "players", "td", "game"].includes(ask) || (ask === "list" && Q.time)) {
    const day = tours.filter(t => t.date === to);
    if (!day.length) return { ...base, info: `No ${lname} tours are listed for ${fmtDate(to)}.` };
    if (!/^\d{1,2}:\d{2}$/.test(Q.time || "")) {
      if (ask === "list" || day.length > 1) return { ...base, tours_that_day: day.map(brief) };
    }
    const [hh, mm] = (Q.time || "00:00").split(":").map(Number), want = hh * 60 + mm;
    let best = day[0];
    for (const t of day) if (Math.abs(t.h * 60 + t.m - want) < Math.abs(best.h * 60 + best.m - want)) best = t;
    const exact = !Q.time || Math.abs(best.h * 60 + best.m - want) <= 20;
    const tour = brief(best);
    if (!exact) tour.nearest = `No tour at ${fmtTime(hh, mm)}; this is the nearest tour that day.`;
    const pl = await winnerPlayers(best, slug);
    if (pl) tour.winning_team_players = pl;
    else if (+best.perteam > 1 && best.winners.length === 1) tour.winning_team_players = "not available";
    return { ...base, tour };
  }
  if (ask === "count_tours" || ask === "list") {
    const done = tours.filter(t => t.status === "finished"), canc = tours.filter(t => t.status === "cancelled");
    const r = { ...base, tours_listed: tours.length, finished: done.length, cancelled: canc.length, not_finished: tours.length - done.length - canc.length };
    if (ask === "list" || tours.length <= 25) r.tours = tours.map(t => ({ time: fmtTime(t.h, t.m), date: fmtDate(t.date), td: t.td, game: t.game, status: t.status, winners: t.winners.map(display) }));
    return r;
  }
  if (ask === "player_wins" || ask === "last_win") {
    if (!Q.player) return { ...base, info: "No player name was found in the question." };
    const keys = playerKeys(Q.player);
    const won = tours.filter(t => t.winners.some(w => keys.has(w.toLowerCase())));
    const name = display(Q.player);
    if (ask === "last_win") {
      const last = won[won.length - 1];
      return last ? { ...base, player: name, last_win: brief(last) } : { ...base, player: name, info: `${name} has no ${lname} tour wins listed in the last ${MAX_DAYS} days.` };
    }
    return { ...base, player: name, wins: won.length, tours_won: won.map(t => `${fmtDate(t.date)} ${fmtTime(t.h, t.m)} ${t.game}`),
      note: "Counts tours where the feed lists the player as a winner; team tours that list only a team name are not counted." };
  }
  return { info: "That question could not be matched to MyLeague tour data." };
}

// ---------------- handler
export async function onRequestPost({ request, env, waitUntil }) {
  let q = "";
  try { q = String((await request.json()).q || "").trim().slice(0, 300); } catch (_) {}
  if (!q) return json({ answer: "No question was asked." });
  const now = etNow();
  const ansKey = `ans/${now.date}/${now.time.slice(0, 4)}/${q.toLowerCase().replace(/\s+/g, " ")}`;
  const c = caches.default, ak = new Request("https://ask-cache.local/" + encodeURIComponent(ansKey));
  const hit = await c.match(ak);
  if (hit) return json(await hit.json());
  // rate limit per IP (best effort, edge cache)
  const ip = request.headers.get("cf-connecting-ip") || "x", hr = new Date().toISOString().slice(0, 13);
  const rk = new Request(`https://ask-cache.local/rl/${encodeURIComponent(ip)}/${hr}`);
  const n = +(await (await c.match(rk))?.text() || 0);
  if (n >= RATE_PER_HOUR) return json({ answer: "Too many questions from this connection this hour." }, 429);
  await c.put(rk, new Response(String(n + 1), { headers: { "cache-control": "max-age=3600" } }));
  if (!env.AI) return json({ answer: "The answer service is not configured." }, 500);

  let Q, data, answer;
  let perr = "";
  try { Q = await parse(env, q, now); } catch (e) { perr = String(e && e.message || e).slice(0, 200); }
  if (!Q) return json({ answer: "The question could not be read.", error: perr });
  try { data = await run(Q, now); } catch (_) { data = { info: "MyLeague's tour data could not be reached right now." }; }
  try {
    answer = await ai(env, ANSWER_SYS, `QUESTION: ${q}\nDATA: ${JSON.stringify(data)}`, 350);
  } catch (_) {}
  if (!answer) answer = data.info || "The answer could not be produced.";
  const out = { answer, query: Q, data };
  waitUntil(c.put(ak, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=300" } })));
  return json(out);
}
export const onRequestGet = () => json({ answer: "Use POST with {\"q\": \"your question\"}." });
