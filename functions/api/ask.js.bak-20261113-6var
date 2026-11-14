// POST /api/ask {q} -> {answer}. One question, one answer from MyLeague's calendar feed (+ the tour's TEAMS page).
// Workers AI turns the question into a structured query; code runs it; the model phrases the answer ONLY from the result.
// Leagues: /ask/leagues.json. Limits: /ask/limits.md.
import REG from "../../ask/leagues.json";
import RATES from "../../ask/player_tours.json";

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
const leagueName = slug => (REG.leagues[slug] || [slug]).find(x => x.length > 3) || (REG.leagues[slug] || [])[0] || slug;
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
    for (let i = 0; i < 3; i++) {
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
    for (const srv of (REG.servers||{})[slug] === "plus2" ? ["plus2", "cgi6"] : ["cgi6", "plus2"]) {
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
- "date_from","date_to": YYYY-MM-DD in US Eastern time. "last night"/"yesterday" = yesterday. A late-night time "last night" (e.g. 11pm) = yesterday. No date mentioned = today, except "last time"/"most recent" questions: for "player_tours" leave both dates "" (whole history); for "last_win" use the last 60 days. Weekday names = most recent such day (today or earlier).
- "time": "HH:MM" 24-hour ET if a time is mentioned, else "". A time with no AM/PM from 1:00 to 7:59 means PM (e.g. "1:15" = "13:15"); 8:00 to 11:59 means AM.
- "ask": one of "winner" (who won a specific tour), "players" (who was on the winning team of a specific tour), "td" (who ran/hosted a specific tour), "game" (game type/format/rules of a specific tour), "count_tours" (how many tours), "player_wins" (how many / which tours a named player won), "last_win" (when a named player last won), "list" (what tours ran / all winners), "player_tours" (how many / which / what tours a named player played, entered or joined, e.g. "what tours did X play in today", when a player last played, a player's placings / 2nd / 3rd places / bux won), "participants" (who played / who entered / who is in a specific tour, e.g. "who played in the 6:15"; set "time" and no player), "leaderboard" (who won / played / hosted the most tours, most wins, top winners; no player name needed), "player_rate" (a named player's win rate / success rate / best or worst game type or variation, record by variation, percentage of wins; set "player"), "unsupported" (anything else, e.g. ratings, scores, hands).
- "player": player name exactly as written, or "". If the question says "I"/"me"/"my" and gives no name, use "Ochwiay". For "leaderboard" leave "player" "".
- "game": game type if mentioned (CUT, SINGLES, SUI PASS 2, REG PARTNERS, etc.), else "".
- "td": host/TD name if the question filters to tours hosted by someone, else "".
- "metric": for "leaderboard" only: "wins" (default), "played", or "hosted".
- "top": for "leaderboard", the N in "top N" if asked, else 5.
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
    const first = (REG.servers || {})[slug] || "cgi6";
    let t = "", nm = null;
    for (const srv of [first, first === "cgi6" ? "plus2" : "cgi6"]) {
      try {
        t = await (await fetch(`https://${srv}.igl.net/tourneysystem/buxlog.php`, { method: "POST", body,
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" } })).text();
        nm = t.match(/([^\s>|]+) LadderBux Log \(Player I\.D\. is (\d+)\)/);
      } catch (_) { nm = null; }
      if (nm) break;
    }
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

async function playerTours(slug, Q) {
  const lname = leagueName(slug);
  const h = await buxlog(slug, Q.player);
  const all = validDate(Q.date_from) || validDate(Q.date_to);
  let f = validDate(Q.date_from) ? Q.date_from : "0000-00-00", t2 = validDate(Q.date_to) ? Q.date_to : (validDate(Q.date_from) ? Q.date_from : "9999-99-99");
  if (!h) return { league: lname, tours_played: 0, info: `No ${lname} tour history was found for a player named ${Q.player}.`, period: all ? (f === t2 ? fmtDate(f) : `${fmtDate(f)} to ${fmtDate(t2)}`) : "" };
  const L = h.list.filter(x => x.date >= f && x.date <= t2), first = h.list[0];
  const pc = n => L.filter(x => x.place === n).length;
  const r = { league: lname, player: display(h.name), period: all ? (f === t2 ? fmtDate(f) : `${fmtDate(f)} to ${fmtDate(t2)}`) : `all recorded tours (log starts ${first ? fmtDate(first.date) : "n/a"})`,
    tours_played: L.length, first_place: pc("1"), second_place: pc("2"), third_place: pc("3"), bux_won: L.reduce((a, x) => a + x.bux, 0),
    last_entry_time: L.length ? `${fmtDate(L[L.length - 1].date)} ${L[L.length - 1].time}` : "none",
    source: "the league's Ladderbux log (one entry fee per tour entered; times are when the entry was made)" };
  r.tours = L.map(x => `tour ${x.id}, entered ${fmtDate(x.date)} ${x.time}${x.place ? ` (place ${x.place})` : ""}`);
  Object.defineProperty(r, "list", { value: L, enumerable: false });
  Object.defineProperty(r, "multiday", { value: f !== t2, enumerable: false });
  return r;
}


// ---------------- player participation (which tours did X play): Ladderbux log (ids the player was charged an entry fee for)
// joined to the league calendar (start time, game, TD) and the tour's TEAMS page (partner / entrants).
const ETC = { cfg: null };
async function loadCfg(ctx) {
  if (ETC.cfg && Date.now() - ETC.cfg.t < 60000) return ETC.cfg.v;
  let v = {};
  try { const r = await ctx.env.ASSETS.fetch(new Request(new URL("/live/config.json", ctx.url))); if (r.ok) v = await r.json(); } catch (_) {}
  ETC.cfg = { t: Date.now(), v };
  return v;
}
// Same board labels as /api/live (labels.json rules); other leagues use the feed's own game text, tidied.
function makeLabeler(cfg) {
  const L = cfg.labels || {}, noC = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("_")));
  const byId = noC(L.by_id), slot = Object.fromEntries(Object.entries(noC(L.by_slot)).map(([k, v]) => [k.toLowerCase(), v]));
  const rx = x => new RegExp(x, "i"), pad = n => String(n).padStart(2, "0");
  const raw = (L.raw_rules || []).map(r => [rx(r.match), r.perteam ?? null, r.label]);
  const rules = (L.rules || []).map(r => [rx(r.match), r.match2 ? rx(r.match2) : null, r.not ? rx(r.not) : null, r.perteam ?? null, r.label]);
  const norm = x => x.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim();
  function plain(text) {
    let x = norm(text);
    if (/^\d\s*VS\s*\d$/.test(x)) return "PARDS";
    x = x.replace(/\bPARD A BOT SUI(CIDE)?\b/g, "SUI PAB").replace(/\bPARD A BOT\b/g, "PAB").replace(/\bSUICIDE\b/g, "SUI").replace(/^REG(ULAR)? /, "");
    return x.replace(/\s+/g, " ").trim() || "SPADES";
  }
  function mapped(t) {
    if (byId[t.id] != null) return byId[t.id];
    const n = norm(t.game), k = `${t.td}|${pad(t.h)}:${pad(t.m)}|${n}`.toLowerCase();
    if (slot[k] != null) return slot[k];
    const pt = parseInt(t.perteam, 10) || 0;
    for (const [r, p, lab] of raw) if (r.test(t.game) && (p === null || p === pt)) return lab;
    for (const [r, r2, rn, p, lab] of rules) if (r.test(n) && (!r2 || r2.test(n)) && (!rn || !rn.test(n)) && (p === null || p === pt)) return lab;
    return null;
  }
  return (t, slug) => slug === (cfg.league || "diamondspaders") ? ((cfg.labels_by_id || {})[t.id] ?? mapped(t) ?? plain(t.game)) : plain(t.game);
}
function namesMatch(keys, n) { return keys.has(String(n || "").toLowerCase().replace(/\s+/g, "")) || keys.has(String(n || "").toLowerCase()); }
function keySet(name, canon) {
  const k = new Set();
  for (const x of [name, canon]) if (x) for (const y of playerKeys(x)) { k.add(y); k.add(y.replace(/\s+/g, "")); }
  return k;
}
const ordinal = p => p === "1" ? "won (1st place)" : p === "2" ? "2nd place" : p === "3" ? "3rd place" : `place ${p}`;
function periodFromQ(q, now) {
  const wd = new Date(now.date + "T12:00:00Z").getUTCDay(), mon = addDays(now.date, -((wd + 6) % 7));
  if (/\byesterday\b|\blast night\b/i.test(q)) return [addDays(now.date, -1), addDays(now.date, -1)];
  if (/\blast week\b/i.test(q)) return [addDays(mon, -7), addDays(mon, -1)];
  if (/\b(past|last)\s+(week|7 days)\b|\bpast\s+seven\s+days\b/i.test(q)) return [addDays(now.date, -6), now.date];
  if (/\bthis week\b/i.test(q)) return [mon, now.date];
  if (/\blast month\b|\bpast month\b|\bpast 30 days\b|\blast 30 days\b/i.test(q)) return [addDays(now.date, -29), now.date];
  if (/\btoday\b|\btonight\b/i.test(q)) return [now.date, now.date];
  return null;
}

// ---------------- leaderboard (who won / played / hosted the most)
const MONTH_NUM = { january:1, jan:1, february:2, feb:2, march:3, mar:3, april:4, apr:4, june:6, jun:6,
  july:7, jul:7, august:8, aug:8, september:9, sept:9, sep:9, october:10, oct:10, november:11, nov:11, december:12, dec:12 };
const pad2 = n => String(n).padStart(2, "0");
const monthLast = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1-12
function monthSpan(y, m, today) {
  const t = `${y}-${pad2(m)}-${pad2(monthLast(y, m))}`;
  return [`${y}-${pad2(m)}-01`, t > today ? today : t];
}
function boardPeriod(q, now, Q) {
  const [y, mo] = now.date.split("-").map(Number);
  if (/\bthis month\b/i.test(q)) return monthSpan(y, mo, now.date);
  if (/\blast month\b/i.test(q) && !/\blast 30\b|\bpast 30\b|\bpast month\b/i.test(q))
    return monthSpan(mo === 1 ? y - 1 : y, mo === 1 ? 12 : mo - 1, now.date);
  const named = q.match(/\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)(?:\s+(\d{4}))?\b/i);
  const may = !named && q.match(/\bin\s+may(?:\s+(\d{4}))?\b|\bmay\s+(\d{4})\b/i);
  if (named || may) {
    let month, year;
    if (may) { month = 5; year = +(may[1] || may[2] || 0); }
    else { month = MONTH_NUM[named[1].toLowerCase()]; year = +(named[2] || 0); }
    if (!year) { year = y; if (month > mo) year = y - 1; }
    return monthSpan(year, month, now.date);
  }
  const isoRng = q.match(/\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|and|through|-)\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (isoRng && validDate(isoRng[1]) && validDate(isoRng[2])) {
    const a = isoRng[1], b = isoRng[2];
    return a <= b ? [a, b > now.date ? now.date : b] : [b, a > now.date ? now.date : a];
  }
  const lastN = q.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/i);
  if (lastN) {
    const n = Math.max(1, Math.min(180, +lastN[1]));
    return [addDays(now.date, -(n - 1)), now.date];
  }
  const per = periodFromQ(q, now);
  if (per) return per;
  if (validDate(Q.date_from) && validDate(Q.date_to) && (Q.date_from !== now.date || Q.date_to !== now.date))
    return [Q.date_from, Q.date_to > now.date ? now.date : Q.date_to];
  if (validDate(Q.date_from) && Q.date_from !== now.date)
    return [Q.date_from, validDate(Q.date_to) ? (Q.date_to > now.date ? now.date : Q.date_to) : Q.date_from];
  return monthSpan(y, mo, now.date);
}
const NOT_PLAYER = /^(who|most|wins?|winner|winners|anyone|somebody|someone|everybody|the|top|players?|player|tour|tours|cut|singles|partners?|pards?|suicide|sui|october|november|december|january|february|march|april|may|june|july|august|september|today|yesterday|tonight|week|month|diamond|spaders|td|host|leaderboard)$/i;
function leaderboardIntent(q, Q) {
  if (/\bmost\s+recent(ly)?\b/i.test(q)) return null;
  const most = /\bwho\s+won\s+the\s+most\b/i.test(q)
    || /\bwho\s+(?:has|have|had|got)\s+(?:the\s+)?most\b/i.test(q)
    || /\b(?:which|what)\s+player\s+(?:won|has|have|had|played|hosted|ran)\s+(?:the\s+)?most\b/i.test(q)
    || /\b(?:most\s+wins?|winningest|leaderboard)\b/i.test(q)
    || /\bmost\s+(?:[\w']+\s+){0,6}wins?\b/i.test(q)
    || /\btop\s+\d+\b/i.test(q) && /\b(?:winners?|wins?|players?|hosts?|tds?|leaders?)\b/i.test(q)
    || /\bmost\s+[\w][\w\s]{0,40}\btours\b/i.test(q)
    || /\bwho\s+(?:played|entered|hosted|ran|td'?d?)\s+the\s+most\b/i.test(q)
    || /\bwhich\s+td\s+(?:ran|hosted|had)\s+the\s+most\b/i.test(q)
    || /\bwho\s+hosted\s+the\s+most\b/i.test(q);
  if (!most) return null;
  const named = Q.player && !NOT_PLAYER.test(String(Q.player).trim());
  if (named && (/\bhow\s+many\b/i.test(q) || /\b(?:which|what)\s+tours\s+did\b/i.test(q))) return null;
  const metric = /\b(?:who\s+(?:played|entered|joined)|most\s+(?:tours\s+)?(?:played|entries)|played\s+the\s+most)\b/i.test(q) ? "played"
    : /\b(?:who\s+(?:hosted|ran|td'?d?)|which\s+td|most\s+(?:tours\s+)?(?:hosted|ran|td)|hosted\s+the\s+most)\b/i.test(q) ? "hosted"
    : "wins";
  const topM = q.match(/\btop\s+(\d{1,2})\b/i);
  const top = topM ? Math.max(3, Math.min(15, +topM[1])) : 5;
  return { metric, top };
}
function officialize(label, official) {
  const u = String(label || "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!u) return u;
  if (official.includes(u)) return u;
  const s = u.replace(/\s+PARTNERS$/, "");
  if (official.includes(s)) return s;
  return u;
}
function gameFromQ(q, official, Q) {
  const aliases = [
    ["SETTER'S CHOICE SINGLES", /\bsetters?'?\s+choice(\s+singles)?\b/i],
    ["CUT MIRRORS", /\bcut\s+mirrors?\b|\bmirrors?\b/i],
    ["SUI PASS 2 RANDOM", /\b(?:sui(?:cide)?\s+)?pass\s*2\s+random\b/i],
    ["SUI PASS 2 PAB", /\b(?:sui(?:cide)?\s+)?(?:pass\s*2\s+)?pab\b|\bpard\s+a\s+bot\b/i],
    ["REG SPADES PAB", /\breg(?:ular)?\s+(?:spades\s+)?pab\b/i],
    ["REG SPADES RANDOM", /\breg(?:ular)?\s+(?:spades\s+)?random\b/i],
    ["REG PARTNERS", /\breg(?:ular)?\s+(?:partners|pards)\b|\b(?:partners|pards)\b/i],
    ["SUI PASS 2", /\bsui(?:cide)?(?:\s+pass\s*2)?\b|\bpass\s*2\b/i],
    ["LOSER WINS", /\bloser\s+wins?\b/i],
    ["SINGLES", /\bsingles\b|\b1\s*v(?:s)?\s*1\s*v(?:s)?\s*1\b/i],
    ["CUT", /\bcutthroat\b|\bcut\b/i]
  ];
  const off = official || [];
  // Prefer an official label mentioned verbatim (longest first) so "SUI PASS 2" does not also catch PAB/RANDOM.
  const mentioned = off.slice().sort((a, b) => b.length - a.length).find(lab => {
    const rx = new RegExp("\\b" + lab.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+") + "\\b", "i");
    return rx.test(q);
  });
  if (mentioned) return mentioned;
  if (Q && Q.game) {
    const g = officialize(Q.game, off);
    if (off.includes(g)) return g;
  }
  for (const [lab, rx] of aliases) if (rx.test(q) && (off.includes(lab) || !off.length)) return lab;
  return "";
}
function labelsMatch(want, label) {
  if (!want) return true;
  const n = s => String(s || "").toUpperCase().replace(/\bSUICIDE\b/g, "SUI").replace(/\bPARDS\b/g, "PARTNERS")
    .replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return n(want) === n(label);
}
function parseClock(s) {
  const m = String(s || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return { h: 0, m: 0 };
  let h = +m[1], mi = +m[2];
  if (/pm/i.test(m[3] || "") && h < 12) h += 12;
  if (/am/i.test(m[3] || "") && h === 12) h = 0;
  return { h, m: mi };
}
function closeDiv(html, start) {
  const open = html.indexOf(">", start);
  if (open < 0) return "";
  let depth = 1, p = open + 1;
  while (p < html.length && depth) {
    const a = html.indexOf("<div", p), b = html.indexOf("</div>", p);
    if (b < 0) break;
    if (a >= 0 && a < b) { depth++; p = a + 4; } else { depth--; p = b + 6; }
  }
  return html.slice(open + 1, p - 6);
}
function parseDailyReport(html, date, official) {
  const tours = [];
  const re = /<div class="t-time">([^<]+)<\/div><div class="t-label"><a href="[^"]*\/tournament\/(\d+)\/"[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const time = m[1].trim(), id = m[2], label = officialize(unxml(m[3]).trim(), official);
    const slice = html.slice(m.index, m.index + 3000);
    const tdM = slice.match(/<div class="t-td"><span class="tdl">TD <\/span>([^<]+)<\/div>/);
    const td = tdM ? unxml(tdM[1]).trim() : "";
    const wAt = slice.indexOf('<div class="t-win">');
    let winners = [], cancelled = /cancelled/i.test(slice.slice(0, wAt < 0 ? 800 : wAt + 80));
    if (wAt >= 0) {
      const inner = closeDiv(slice, wAt);
      if (/cancelled/i.test(inner)) cancelled = true;
      winners = [...inner.matchAll(/<div class="nm[^"]*"[^>]*>([^<]+)<\/div>/g)].map(x => unxml(x[1]).trim()).filter(Boolean);
    }
    const clk = parseClock(time);
    tours.push({ id, date, h: clk.h, m: clk.m, td, game: label, boardLabel: label, perteam: "",
      status: cancelled ? "cancelled" : "finished", winners, cancelled, fromReport: true,
      url: `https://www.myleague.com/diamondspaders/tournament/${id}/` });
  }
  return tours;
}
function parseMostPlayed(html) {
  const m = html.match(/MOST TOURS PLAYED<\/h3>([\s\S]*?)<\/div>\s*<p class="legend"/i);
  if (!m) return null;
  return [...m[1].matchAll(/<div class="nm[^"]*"[^>]*>([^<]+)<\/div><span class="n">(\d+)<\/span>/g)]
    .map(x => ({ name: unxml(x[1]).trim(), n: +x[2] }));
}
async function reportDay(iso, official, ctx) {
  return cached(`report/${iso}`, 3600, async () => {
    try {
      const r = await ctx.env.ASSETS.fetch(new Request(new URL(`/dailyreport/${iso}.html`, ctx.url)));
      if (!r.ok) return { tours: null, played: null };
      const html = await r.text();
      return { tours: parseDailyReport(html, iso, official), played: parseMostPlayed(html) };
    } catch (_) { return { tours: null, played: null }; }
  });
}
function aliasGraph(cfg) {
  const links = [];
  for (const [a, b] of Object.entries(REG.aliases || {})) links.push([a, b]);
  for (const [a, b] of Object.entries((cfg && cfg.aliases) || {})) links.push([a, String(b)]);
  const g = {};
  const add = (a, b) => { const x = a.toLowerCase(), y = b.toLowerCase(); (g[x] ||= new Set()).add(y); (g[y] ||= new Set()).add(x); };
  for (const [a, b] of links) add(a, b);
  const shown = {};
  for (const [s, r] of Object.entries(REG.aliases || {})) shown[r.toLowerCase()] = s;
  for (const [a, b] of Object.entries((cfg && cfg.aliases) || {})) {
    const av = String(b);
    if (!shown[a.toLowerCase()]) shown[a.toLowerCase()] = av;
  }
  return { g, shown };
}
function groupOf(name, graph) {
  const start = String(name || "").toLowerCase();
  const set = new Set([start]);
  const st = [start];
  while (st.length) {
    const x = st.pop();
    for (const y of (graph.g[x] || [])) if (!set.has(y)) { set.add(y); st.push(y); }
  }
  return set;
}
function canonKey(name, graph) { return [...groupOf(name, graph)].sort()[0]; }
function displayName(name, graph) {
  const set = groupOf(name, graph);
  for (const k of set) if (graph.shown[k]) return graph.shown[k];
  return name;
}
function nicerName(cur, incoming) {
  if (!cur) return incoming;
  const score = s => ((/[A-Z]/.test(s) && /[a-z]/.test(s)) ? 2 : /[A-Z]/.test(s) ? 1 : 0);
  return score(incoming) > score(cur) ? incoming : cur;
}
function applyWinners(t, cfg) {
  const id = String(t.id);
  if ((cfg.hidden || []).map(String).includes(id) || t.status === "cancelled" || t.cancelled) return null;
  const mo = cfg.manual_overrides || {}, mw = cfg.manual_winners || {};
  if (mo[id]?.length) return [...mo[id]];
  if (mw[id]?.length) return [...mw[id]];
  if (t.winners && t.winners.length) return [...t.winners];
  return [];
}
function hostFromQ(q, Q) {
  const m = q.match(/\b(?:hosted|run|ran|directed)\s+by\s+@?([\w.\-]+)/i) || q.match(/\b(?:td|host)\s+(?:is\s+|was\s+)?@?([\w.\-]+)/i);
  if (m && !/^(the|a|an|this|that|who|which)$/i.test(m[1])) return m[1];
  if (Q.td && !NOT_PLAYER.test(String(Q.td).trim())) return String(Q.td).trim();
  return "";
}
function topTied(rows, n) {
  if (!rows.length) return [];
  const cutoff = rows[Math.min(n, rows.length) - 1].count;
  const out = [];
  let rank = 0, prev = null, i = 0;
  for (const r of rows) {
    if (prev === null || r.count !== prev) { rank = i + 1; prev = r.count; }
    if (rank > n && r.count < cutoff) break;
    if (rank > n && r.count !== cutoff) break;
    out.push({ ...r, rank });
    i++;
  }
  return out;
}
function boardLine(list) {
  return list.map(r => `${r.rank}. ${r.name} — ${r.count}`).join("\n");
}
function joinAnd(arr) {
  if (arr.length <= 1) return arr[0] || "";
  if (arr.length === 2) return arr[0] + " and " + arr[1];
  return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
}
async function toursForBoard(slug, from, to, now, official, ctx) {
  let cal = [];
  try { cal = await range(slug, from, to); } catch (_) { cal = []; }
  const have = new Set(cal.map(t => t.date));
  const missing = [];
  const reportPlayed = {};
  if (slug === "diamondspaders") {
    for (let d = from; d <= to && d <= now.date; d = addDays(d, 1)) {
      if (have.has(d)) continue;
      const day = await reportDay(d, official, ctx);
      if (day.tours && day.tours.length) {
        cal.push(...day.tours);
        have.add(d);
        if (day.played) reportPlayed[d] = day.played;
      } else if (!day.tours) {
        missing.push(d);
      }
    }
  } else {
    for (let d = from; d <= to && d <= now.date; d = addDays(d, 1))
      if (!have.has(d)) missing.push(d);
  }
  cal = cal.filter(t => t.date >= from && t.date <= to)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.h * 60 + a.m) - (b.h * 60 + b.m));
  return { tours: cal, missing, reportPlayed };
}
async function leaderboard(q, Q, now, intent, ctx) {
  const slug = leagueFor(Q.league);
  if (!slug) return { info: `The league "${Q.league}" is not in the list of leagues this page can read.`, final: true };
  const lname = leagueName(slug);
  const [from, to] = boardPeriod(q, now, Q);
  if (from < addDays(now.date, -120))
    return { info: `Leaderboard questions can go back as far as daily reports and the recent MyLeague calendar allow (about the last few months), not all the way to ${fmtDate(from)}.`, final: true };
  const cfg = await loadCfg(ctx);
  const official = (cfg.labels && cfg.labels.official) || [];
  const labelOf = makeLabeler(cfg);
  const wantGame = gameFromQ(q, official, Q);
  const host = hostFromQ(q, Q);
  const graph = aliasGraph(cfg);
  const { tours, missing, reportPlayed } = await toursForBoard(slug, from, to, now, official, ctx);
  const period = from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}`;
  const gameBit = wantGame ? ` ${wantGame}` : "";
  const hostKeys = host ? groupOf(host, graph) : null;
  const hostBit = host ? ` hosted by ${displayName(host, graph)}` : "";
  const kept = tours.filter(t => {
    const lab = t.boardLabel || labelOf(t, slug);
    t._label = lab;
    if (t.status === "cancelled" || t.cancelled) return false;
    if ((cfg.hidden || []).map(String).includes(String(t.id))) return false;
    if (wantGame && !labelsMatch(wantGame, lab)) return false;
    if (hostKeys && !hostKeys.has(String(t.td || "").toLowerCase())) return false;
    return true;
  });
  const gap = missing.length
    ? (missing.length <= 6 ? ` No tour list was available for ${missing.map(fmtDate).join(", ")}.`
      : ` No tour list was available for ${missing.length} days in that range (including ${fmtDate(missing[0])}).`)
    : "";

  if (intent.metric === "played") {
    if (from !== to)
      return { info: `I can answer who played the most for a single day when a daily report exists, but not for a longer stretch (entrant lists are not kept for every tour). Who won the most${gameBit} tours is available for that period — ask that instead.`, final: true };
    let rows = reportPlayed[from];
    if (!rows) {
      const day = await reportDay(from, official, ctx);
      rows = day.played;
    }
    if (!rows || !rows.length)
      return { info: `Who played the most${gameBit} at ${lname} on ${period} is not in the tour calendar (that needs the day's entrant list or daily report, which was not available).`, final: true };
    if (wantGame)
      return { info: `The daily report's "most tours played" list is for all game types together, not just ${wantGame}. I can still tell you who won the most ${wantGame} tours that day.`, final: true };
    const merged = {};
    for (const r of rows) {
      const k = canonKey(r.name, graph);
      (merged[k] ||= { name: displayName(r.name, graph), count: 0 }).count += r.n;
      merged[k].name = nicerName(merged[k].name, displayName(r.name, graph));
    }
    const ranked = topTied(Object.values(merged).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)), intent.top);
    if (!ranked.length) return { info: `No play counts were listed for ${lname} on ${period}.`, final: true };
    const leads = ranked.filter(r => r.rank === 1);
    const lead = leads.length === 1
      ? `${leads[0].name} played the most tours at ${lname} on ${period}, with ${leads[0].count}.`
      : `${leads.map(r => r.name).join(" and ")} tied for the most tours played at ${lname} on ${period}, with ${leads[0].count} each.`;
    return { info: `${lead}\n\nTop ${intent.top}:\n${boardLine(ranked)}`, final: true, from, to, metric: "played" };
  }

  if (intent.metric === "hosted") {
    const counts = {};
    for (const t of kept) {
      const td = String(t.td || "").trim();
      if (!td) continue;
      const k = canonKey(td, graph);
      (counts[k] ||= { name: displayName(td, graph), count: 0 }).count++;
      counts[k].name = nicerName(counts[k].name, displayName(td, graph));
    }
    const ranked = topTied(Object.values(counts).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)), intent.top);
    if (!ranked.length)
      return { info: `No${gameBit} tours were listed at ${lname} ${from === to ? "on" : "from"} ${period}.${gap}`, final: true };
    const leads = ranked.filter(r => r.rank === 1);
    const lead = leads.length === 1
      ? `${leads[0].name} hosted the most${gameBit} tours at ${lname} ${from === to ? "on" : "from"} ${period}, with ${leads[0].count}.`
      : `${leads.map(r => r.name).join(" and ")} tied for the most${gameBit} tours hosted at ${lname} ${from === to ? "on" : "from"} ${period}, with ${leads[0].count} each.`;
    return { info: `${lead}\n\nTop ${intent.top}:\n${boardLine(ranked)}\n\n(${kept.length} ${wantGame || "listed"} tour${kept.length === 1 ? "" : "s"})${gap}`, final: true, from, to, metric: "hosted", counts };
  }

  // wins
  const counts = {};
  const skippedTeam = [];
  let credited = 0, noWin = 0;
  for (const t of kept) {
    const w = applyWinners(t, cfg);
    if (w === null) continue;
    if (!w.length) { noWin++; continue; }
    const pt = parseInt(t.perteam, 10) || (t.fromReport ? (w.length > 1 ? 2 : 1) : 0);
    if (pt > 1 && w.length === 1) { skippedTeam.push(t.id); continue; }
    credited++;
    for (const name of w) {
      const k = canonKey(name, graph);
      (counts[k] ||= { name: displayName(name, graph), count: 0 }).count++;
      counts[k].name = nicerName(counts[k].name, displayName(name, graph));
    }
  }
  const ranked = topTied(Object.values(counts).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)), intent.top);
  if (!ranked.length) {
    const why = !tours.length ? `No tours were listed at ${lname} ${from === to ? "on" : "from"} ${period}.`
      : !kept.length ? `No${gameBit} tours${hostBit} were listed at ${lname} ${from === to ? "on" : "from"} ${period}.`
      : `No winners are posted yet for${gameBit} tours${hostBit} at ${lname} ${from === to ? "on" : "from"} ${period}.`;
    return { info: why + gap, final: true, from, to, metric: "wins" };
  }
  const leads = ranked.filter(r => r.rank === 1);
  const when = from === to ? `on ${period}` : `from ${period}`;
  const verb = `won the most${gameBit} tours${hostBit}`;
  const lead = leads.length === 1
    ? `${leads[0].name} ${verb} at ${lname} ${when}, with ${leads[0].count} win${leads[0].count === 1 ? "" : "s"}.`
    : `${leads.map(r => r.name).join(" and ")} tied for the most${gameBit} tours${hostBit} at ${lname} ${when}, with ${leads[0].count} wins each.`;
  let extra = `${credited} ${wantGame || "listed"} tour${credited === 1 ? "" : "s"} with a posted winner`;
  if (noWin) extra += `; ${noWin} with no winner posted`;
  if (skippedTeam.length) extra += `; ${skippedTeam.length} partner tour${skippedTeam.length === 1 ? "" : "s"} could not be credited to individual players`;
  if (!wantGame) extra += "; partner-tour wins are credited to each partner";
  return { info: `${lead}\n\nTop ${intent.top}:\n${boardLine(ranked)}\n\n(${extra}.)` + gap, final: true, from, to, metric: "wins", game: wantGame, credited, ranked };
}

// ---------------- per-player win rate by game variation (from /ask/player_tours.json)
const ME = "Ochwiay";
const SAYS_ME = /\b(?:i|me|my|mine|i've|i'd|i'm|ive)\b/i;
function isMePronoun(p) { return /^(i|me|my|mine|ive)$/i.test(String(p || "").trim()); }
function okPlayerName(n) {
  return n && !NOT_PLAYER.test(n) && !isMePronoun(n) && !/^(in|on|at|this|last|the|a|an|any|his|her|their|what|whats|whatis|whats?|win|rate|best|worst|record)$/i.test(n);
}
function resolveAskPlayer(q, Q) {
  let p = String(Q.player || "").trim();
  if (p && isMePronoun(p)) return ME;
  if (p && !NOT_PLAYER.test(p)) return p;
  if (SAYS_ME.test(q)) return ME;
  const pats = [
    /\b(?:has|have|had|did|does|for|of)\s+@?([A-Za-z][\w.\-]{1,24})\b/i,
    /(?:^|\s)@?([A-Za-z][\w.\-]{1,24})'s\s+(?:win\s*rate|success|best|worst|record|game\s*type|variation)/i,
    /^(?:what(?:'s|\s+is)\s+)?@?([A-Za-z][\w.\-]{1,24})(?:'s)?\s+(?:win\s*rate|success|best|worst|record)\b/i,
  ];
  for (const rx of pats) {
    const m = q.match(rx);
    if (m && okPlayerName(m[1])) return m[1];
  }
  return "";
}
function successRateIntent(q, Q) {
  const worst = /\bworst|least\s+success|lowest\s+win\s*rate|weakest\b/i.test(q);
  if (Q.ask === "player_rate") return { worst };
  // Don't steal single-tour questions ("what game type was the 6:15") or leaderboards.
  if (Q.ask && /^(game|winner|players|td|count_tours|list|participants)$/i.test(Q.ask)) return null;
  if (/\b(?:the\s+)?\d{1,2}:\d{2}\b/.test(q) && !/\b(?:win\s*rates?|success|percentage[- ]wise|percent(?:age)?\s*wise|record\s+by)\b/i.test(q)) return null;
  if (/\bwho\s+won\s+the\s+most\b|\bwho\s+(?:played|hosted|ran)\s+the\s+most\b|\btop\s+\d+\b/i.test(q) && !SAYS_ME.test(q) && !(Q.player && !NOT_PLAYER.test(String(Q.player).trim()) && !isMePronoun(Q.player))) return null;
  const named = (Q.player && okPlayerName(String(Q.player).trim())) || SAYS_ME.test(q);
  const rate = /\b(?:win\s*rates?|win\s*%|winning\s+percentage|success\s+rates?|percentage[- ]wise|percent(?:age)?\s*wise|most\s+success|success\s+with)\b/i.test(q)
    || /\b(?:best|worst|strongest|weakest)\s+(?:variation|game\s*types?|formats?|game)\b/i.test(q)
    || /\brecord\s+by\s+(?:variation|game\s*types?|formats?)\b/i.test(q)
    || /\b(?:by|per|each|every|broken\s+down\s+by)\s+(?:variation|game\s*types?|formats?)\b/i.test(q)
    || /\b(?:variation|game\s*types?|formats?)\b.{0,50}\b(?:success|win\s*rate|percent|best|worst)\b/i.test(q)
    || /\b(?:success|win\s*rate|percent|best|worst)\b.{0,50}\b(?:variation|game\s*types?|formats?)\b/i.test(q)
    || (/\b(?:which|what)\s+(?:variation|game\s*types?|formats?)\b/i.test(q) && (named || /\b(?:success|win\s*rate|percent|best|worst|record|played)\b/i.test(q)));
  if (!rate) return null;
  return { worst };
}
function fmtPct(wins, played) {
  if (!played) return "0%";
  const n = (100 * wins) / played;
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? `${r}%` : `${r}%`;
}
function fmtRange(from, to) {
  const a = new Date(from + "T12:00:00Z"), b = new Date(to + "T12:00:00Z");
  const mon = d => d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" });
  const day = d => d.getUTCDate();
  if (from === to) return `${mon(a)} ${day(a)}, ${a.getUTCFullYear()}`;
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth())
    return `${mon(a)} ${day(a)}–${day(b)}, ${a.getUTCFullYear()}`;
  if (a.getUTCFullYear() === b.getUTCFullYear())
    return `${mon(a)} ${day(a)} – ${mon(b)} ${day(b)}, ${a.getUTCFullYear()}`;
  return `${mon(a)} ${day(a)}, ${a.getUTCFullYear()} – ${mon(b)} ${day(b)}, ${b.getUTCFullYear()}`;
}
function periodWords(q, from, to, now) {
  const span = fmtRange(from, to);
  if (/\bthis month\b/i.test(q)) return `this month (${span})`;
  if (/\blast month\b/i.test(q) && !/\blast 30\b|\bpast 30\b|\bpast month\b/i.test(q)) return `last month (${span})`;
  if (/\btoday\b|\btonight\b/i.test(q)) return `today (${span})`;
  if (/\byesterday\b|\blast night\b/i.test(q)) return `yesterday (${span})`;
  if (/\bthis week\b/i.test(q)) return `this week (${span})`;
  if (/\blast week\b/i.test(q) && !/\blast 7\b|\bpast 7\b/i.test(q)) return `last week (${span})`;
  const lastN = q.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/i);
  if (lastN) return `the last ${+lastN[1]} days (${span})`;
  const may = q.match(/\bin\s+may(?:\s+\d{4})?\b|\bmay\s+\d{4}\b/i);
  if (may) return `May (${span})`;
  const named = q.match(/\b(january|february|march|april|june|july|august|september|october|november|december)\b/i);
  if (named) return `${named[1][0].toUpperCase()}${named[1].slice(1).toLowerCase()} (${span})`;
  return from === to ? `on ${span}` : `from ${span}`;
}
async function loadRates(ctx) {
  if (ETC.rates && Date.now() - ETC.rates.t < 60000) return ETC.rates.v;
  let v = null;
  try {
    const r = await ctx.env.ASSETS.fetch(new Request(new URL("/ask/player_tours.json", ctx.url)));
    if (r.ok) v = await r.json();
  } catch (_) {}
  // Bundled copy: always available even if the asset fetch is gated or fails.
  if (!v || !Array.isArray(v.tours) || !v.tours.length) v = RATES;
  ETC.rates = { t: Date.now(), v };
  return v;
}
function rateNameKeys(name, cfg) {
  const graph = aliasGraph(cfg);
  const keys = new Set(groupOf(name, graph));
  for (const k of [...keys]) for (const y of playerKeys(k)) { keys.add(y); keys.add(y.replace(/\s+/g, "")); }
  return keys;
}
function playerIn(list, keys) {
  return (list || []).some(n => namesMatch(keys, n));
}
function shownOf(name, cfg, fallback) {
  return displayName(name, aliasGraph(cfg)) || fallback || name;
}
async function playerRate(q, Q, now, intent, ctx) {
  const who = resolveAskPlayer(q, Q);
  if (!who) return { info: "Name the player, or ask with \"I\" / \"me\" (that is treated as Ochwiay).", final: true };
  const data = await loadRates(ctx);
  if (!data || !Array.isArray(data.tours) || !data.tours.length)
    return { info: "The tour-entry records this page uses for win rates are not available right now.", final: true };
  const cfg = await loadCfg(ctx);
  const official = ((cfg.labels || {}).official) || [];
  const [from, to] = boardPeriod(q, now, Q);
  const coverFrom = data.from, coverTo = data.to;
  const lname = data.league_name || "Diamond Spaders";
  if (to < coverFrom || from > coverTo) {
    return { info: `Win-rate records for ${lname} currently cover ${fmtRange(coverFrom, coverTo)}, which does not include the period asked about (${fmtRange(from, to)}). The MyLeague calendar only keeps about the last 35 days.`, final: true, from, to };
  }
  const keys = rateNameKeys(who, cfg);
  const wantGame = gameFromQ(q, official, Q);
  const by = new Map();
  let pending = 0, openN = 0, skipped = 0;
  const playedRows = [];
  for (const t of data.tours) {
    if (t.date < from || t.date > to) continue;
    if (!playerIn(t.players, keys)) continue;
    if (t.status && t.status !== "finished") { openN++; continue; }
    if (!t.winners || !t.winners.length) { pending++; continue; }
    const LABEL_FIX = { "SETTERS CHOICE SINGLES": "SETTER'S CHOICE SINGLES", "PARTNERS": "REG PARTNERS", "CUT 400100": "CUT" };
    let rawLab = t.label || "";
    if (String(rawLab).toUpperCase() === "PASS 2")
      rawLab = String(t.perteam) === "1" ? "SUI PASS 2 PAB" : "SUI PASS 2";
    const label = officialize(LABEL_FIX[rawLab] || rawLab, official) || rawLab || "UNKNOWN";
    if (wantGame && !labelsMatch(wantGame, label)) { skipped++; continue; }
    const rec = by.get(label) || { label, played: 0, wins: 0 };
    rec.played++;
    if (playerIn(t.winners, keys)) rec.wins++;
    by.set(label, rec);
    playedRows.push(t);
  }
  const disp = shownOf(who, cfg, who);
  const when = periodWords(q, from, to, now);
  const rows = [...by.values()].map(r => ({ ...r, pct: r.played ? (100 * r.wins) / r.played : 0 }));
  rows.sort((a, b) => b.pct - a.pct || b.wins - a.wins || b.played - a.played || a.label.localeCompare(b.label));
  const coverEnd = coverTo < now.date ? coverTo : now.date;
  // Don't nag when coverage goes through yesterday and today's tours have not finished yet.
  const stale = to > coverTo && coverTo < addDays(now.date, -1);
  const clipNote = (from < coverFrom || stale)
    ? ` Records in the file cover ${fmtRange(coverFrom, coverEnd)}.`
    : "";
  const gaps = (data.gaps || []).filter(d => d >= from && d <= to);
  const gapNote = gaps.length ? ` No entry lists for ${gaps.length} day${gaps.length === 1 ? "" : "s"} in that span (${gaps[0]}${gaps.length > 1 ? "…" : ""}).` : "";
  const pendNote = pending || openN
    ? ` ${pending ? `${pending} finished tour${pending === 1 ? "" : "s"} with no winner posted` : ""}${pending && openN ? " and " : ""}${openN ? `${openN} still in progress` : ""} ${pending && openN ? "were" : "was"} not counted.`
    : "";
  if (!rows.length) {
    const why = wantGame
      ? `${disp} did not play any finished ${wantGame} tours at ${lname} ${when} that have a posted winner.`
      : `${disp} did not play any finished tours at ${lname} ${when} that have a posted winner.`;
    return { info: why + clipNote + gapNote + pendNote, final: true, from, to, player: disp };
  }
  const totalP = rows.reduce((a, r) => a + r.played, 0);
  const totalW = rows.reduce((a, r) => a + r.wins, 0);
  // For "worst", prefer the lowest % and, on a tie, the type with more tours played.
  const ordered = intent.worst
    ? [...rows].sort((a, b) => a.pct - b.pct || a.wins - b.wins || b.played - a.played || a.label.localeCompare(b.label))
    : rows;
  const bestPct = ordered[0].pct;
  const leads = ordered.filter(r => r.pct === bestPct);
  const one = r => `${r.label}, with ${r.wins} win${r.wins === 1 ? "" : "s"} in ${r.played} tour${r.played === 1 ? "" : "s"} (${fmtPct(r.wins, r.played)})`;
  const kind = wantGame || "game type";
  let head;
  if (wantGame && rows.length === 1) {
    const r = rows[0];
    head = `${disp}'s ${wantGame} record at ${lname} ${when} is ${r.wins} win${r.wins === 1 ? "" : "s"} in ${r.played} tour${r.played === 1 ? "" : "s"} (${fmtPct(r.wins, r.played)}).`;
  } else if (intent.worst) {
    head = leads.length === 1
      ? `${disp}'s worst ${kind} at ${lname} ${when} is ${one(leads[0])}.`
      : `${disp}'s worst ${kind}s at ${lname} ${when} are tied: ${joinAnd(leads.map(r => `${r.label} (${fmtPct(r.wins, r.played)}, ${r.wins}/${r.played})`))}.`;
  } else {
    head = leads.length === 1
      ? `${disp}'s best ${kind} at ${lname} ${when} is ${one(leads[0])}.`
      : `${disp}'s best ${kind}s at ${lname} ${when} are tied: ${joinAnd(leads.map(r => `${r.label} (${fmtPct(r.wins, r.played)}, ${r.wins}/${r.played})`))}.`;
  }
  // If the leader is a 1-tour sample, mention the best among types played more than once.
  if (!intent.worst && !wantGame && leads.length === 1 && leads[0].played === 1) {
    const fuller = rows.filter(r => r.played > 1);
    if (fuller.length && fuller[0].label !== leads[0].label)
      head += ` Among game types played more than once, the best is ${one(fuller[0])}.`;
  }
  const table = rows.map(r => `${r.label} — ${r.played} played, ${r.wins} win${r.wins === 1 ? "" : "s"}, ${fmtPct(r.wins, r.played)}`).join("\n");
  const overall = `Overall: ${totalW} win${totalW === 1 ? "" : "s"} in ${totalP} tour${totalP === 1 ? "" : "s"} (${fmtPct(totalW, totalP)}).`;
  const body = wantGame && rows.length === 1 ? overall : `By variation, highest win % first:\n${table}\n\n${overall}`;
  return { info: `${head}\n\n${body}${clipNote}${gapNote}${pendNote}`.trim(), final: true, from, to, player: disp, rows, totalP, totalW };
}

// Every tour the player played in [from,to] across the given leagues, newest info first from the logs.
async function playerDetail(Q, now, slugs, ctx) {
  const cfg = await loadCfg(ctx), labelOf = makeLabeler(cfg), hidden = new Set((cfg.hidden || []).map(String));
  let from = validDate(Q.date_from) ? Q.date_from : now.date, to = validDate(Q.date_to) ? Q.date_to : from;
  if (to < from) [from, to] = [to, from];
  if (to > now.date) to = now.date > from ? now.date : from;           // played = today or earlier (plus today's not-yet-finished)
  if (from < addDays(now.date, -MAX_DAYS)) return { info: `Only the last ${MAX_DAYS} days of tours can be searched for who played.`, final: true };
  let regBudget = 10, partnerBudget = 12;                               // max TEAMS-page lookups per question (registration / partner checks)
  const out = { player: display(Q.player), from, to, leagues: [], notfound: [], err: [] };
  await Promise.all(slugs.map(async slug => {
    try {
      let h = null, canon = null;
      for (const nm of [Q.player, ...[...playerKeys(Q.player)].filter(x => x !== Q.player.toLowerCase())]) { h = await buxlog(slug, nm); if (h) break; }
      if (h) canon = h.name;
      const keys = keySet(Q.player, canon);
      if (canon) out.player = display(canon);
      const cal = await range(slug, from, to);
      const logged = new Map((h ? h.list : []).map(x => [String(x.id), x]));
      const rows = []; let leagueReg = 0;
      for (const t of cal) {
        if (t.status === "cancelled") continue;
        const lg = logged.get(String(t.id));
        const base = { slug, league: leagueName(slug), id: t.id, date: t.date, h: t.h, m: t.m, td: t.td, game: labelOf(t, slug), perteam: +t.perteam || 1,
          status: t.status, winners: t.winners, place: lg ? lg.place : "" };
        if (hidden.has(String(t.id)) && !(lg && lg.place)) continue; // hidden = cancelled/withdrawn from the board
        if (lg) { rows.push({ ...base, how: "log" }); continue; }
        const feedWin = t.winners.some(w => namesMatch(keys, w));
        if (feedWin) { rows.push({ ...base, how: "feed", place: "1" }); continue; }
        if (t.status === "not finished" && t.date >= addDays(now.date, -1) && ++leagueReg <= 4 && regBudget-- > 0) {   // registered but no fee/placing yet
          const ts = await teams(t, slug).catch(() => null);
          if (ts && ts.some(x => x.players.some(p => namesMatch(keys, p)))) rows.push({ ...base, how: "reg" });
        }
      }
      // partner / team for team tours
      await Promise.all(rows.filter(r => r.perteam > 1).map(async r => {
        if (partnerBudget-- <= 0) return;
        const t = cal.find(x => String(x.id) === String(r.id));
        const ts = await teams(t, slug).catch(() => null);
        const mine = ts && ts.find(x => x.players.some(p => namesMatch(keys, p)));
        if (mine) { r.team = mine.team; r.partners = mine.players.filter(p => !namesMatch(keys, p)).map(display); if (r.place === "" && t.winners.length === 1 && mine.team.toLowerCase().replace(/\s*\(\d+\)$/, "") === t.winners[0].toLowerCase().replace(/\s*\(\d+\)$/, "")) r.place = "1"; }
      }));
      rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.h * 60 + a.m) - (b.h * 60 + b.m));
      if (!h && !rows.length) out.notfound.push(leagueName(slug)); else out.leagues.push({ slug, league: leagueName(slug), rows, known: !!h });
    } catch (e) { out.err.push(leagueName(slug)); if (ctx.debug) console.log("ERR", slug, e && e.stack); }
  }));
  const ord = Object.keys(REG.leagues); out.leagues.sort((a, b) => ord.indexOf(a.slug) - ord.indexOf(b.slug));
  return out;
}
function rowLine(r, multiday) {
  let res;
  if (r.place) res = ordinal(r.place);
  else if (r.how === "reg") res = "registered, not finished yet";
  else if (r.status === "finished") res = "played, did not place";
  else res = "in progress / no result yet";
  const bits = [`${multiday ? fmtDate(r.date).replace(/, \d{4}$/, "") + " " : ""}${fmtTime(r.h, r.m)}`, r.game + (r.td ? ` (TD ${display(r.td)})` : ""), res];
  if (r.partners && r.partners.length) bits.push(`with ${r.partners.join(" & ")}${r.team ? ` as "${r.team}"` : ""}`);
  return "• " + bits.join(" — ");
}
function playedAnswer(D, Q, mode) {
  const period = D.from === D.to ? (D.to === etNow().date ? `today (${fmtDate(D.to)})` : `on ${fmtDate(D.to)}`) : `from ${fmtDate(D.from)} to ${fmtDate(D.to)}`;
  const multiday = D.from !== D.to, who = D.player;
  let rows = D.leagues.flatMap(l => l.rows);
  if (mode === "wins") rows = rows.filter(r => r.place === "1");
  const nl = D.leagues.filter(l => (mode === "wins" ? l.rows.some(r => r.place === "1") : l.rows.length)).length;
  if (!rows.length) {
    if (!D.leagues.some(l => l.known) && D.leagues.length === 0 && D.err.length === 0) return `No player named ${who} was found in ${D.notfound.join(", ")}.`;
    return `${who} ${mode === "wins" ? "didn't win any tours" : "didn't play in any tours"} ${period} (searched ${[...D.leagues.map(l => l.league), ...D.notfound].join(", ")}).`
      + (D.err.length ? ` Could not be read: ${D.err.join(", ")}.` : "");
  }
  const won = rows.filter(r => r.place === "1").length;
  let txt = mode === "wins"
    ? `${who} won ${rows.length} tour${rows.length > 1 ? "s" : ""} ${period}:`
    : `${who} played ${rows.length} tour${rows.length > 1 ? "s" : ""} ${period}${won ? ` and won ${won}` : ""}:`;
  for (const l of D.leagues) {
    const rs = mode === "wins" ? l.rows.filter(r => r.place === "1") : l.rows;
    if (!rs.length) continue;
    if (nl > 1) txt += `\n${l.league}:`;
    txt += "\n" + rs.map(r => rowLine(r, multiday)).join("\n");
  }
  if (D.err.length) txt += `\n(Could not be read: ${D.err.join(", ")}.)`;
  return txt;
}

// Who played in a tour: the tour's TEAMS page.
async function participants(Q, now, slug, ctx) {
  const cfg = await loadCfg(ctx), labelOf = makeLabeler(cfg), lname = leagueName(slug);
  const day = validDate(Q.date_to) ? Q.date_to : validDate(Q.date_from) ? Q.date_from : now.date;
  const tours = (await range(slug, day, day)).filter(t => t.status !== "cancelled");
  if (!tours.length) return { info: `No ${lname} tours are listed for ${fmtDate(day)}.`, final: true };
  if (!/^\d{1,2}:\d{2}$/.test(Q.time || "")) return { info: `Which tour? Name its start time, for example "who played in the 6:15" (${lname} tours on ${fmtDate(day)}: ${tours.map(t => fmtTime(t.h, t.m).replace(" ET", "")).join(", ")}).`, final: true };
  const [hh, mm] = Q.time.split(":").map(Number), want = hh * 60 + mm;
  let best = tours[0];
  for (const t of tours) if (Math.abs(t.h * 60 + t.m - want) < Math.abs(best.h * 60 + best.m - want)) best = t;
  const near = Math.abs(best.h * 60 + best.m - want) > 20 ? `No ${lname} tour at ${fmtTime(hh, mm)}; nearest is ` : "";
  const head = `${fmtTime(best.h, best.m)} ${labelOf(best, slug)} (TD ${display(best.td)}, ${fmtDate(best.date)}, ${lname})`;
  const ts = await teams(best, slug).catch(() => null);
  if (!ts || !ts.length) return { info: `${near}${head}: the entrant list could not be read.`, final: true };
  const n = ts.reduce((a, x) => a + x.players.length, 0);
  const lines = ts.map(x => x.players.length > 1 || best.perteam > 1 ? `${x.team ? x.team + ": " : ""}${x.players.map(display).join(" & ")}` : x.players.map(display).join(""));
  const sep = best.perteam > 1 ? "\n• " : ", ";
  let txt = `${near}${head} has ${n} player${n === 1 ? "" : "s"} entered${best.perteam > 1 ? ` (${ts.length} teams)` : ""}:${best.perteam > 1 ? sep : " "}${lines.join(sep)}`;
  if (best.winners.length) txt += `\nWinner: ${best.winners.map(display).join(" & ")}.`;
  else if (best.status === "not finished") txt += "\nNo winner yet.";
  return { info: txt, final: true };
}

// ---------------- run the query
async function run(Q, now, ctx) {
  const slug = leagueFor(Q.league);
  if (!slug) return { info: `The league "${Q.league}" is not in the list of leagues this page can read.` };
  const lname = leagueName(slug);
  if (Q.ask === "participants") {
    if (!Q.player) return participants(Q, now, slug, ctx);
    Q.ask = "player_tours";
  }
  if (Q.ask === "player_tours" && Q.detail) {
    if (!Q.player) return { league: lname, info: "The question does not name a player (\"I\" or \"me\" can't be identified here), so no player's tours could be listed.", final: true };
    const D = await playerDetail(Q, now, Q.all_leagues ? Object.keys(REG.leagues) : [slug], ctx);
    if (D.final) return D;
    return { info: playedAnswer(D, Q, Q.wins ? "wins" : "played"), final: true };
  }
  if (Q.ask === "player_tours") {
    if (!Q.player) return { league: lname, info: "The question does not name a player (\"I\" or \"me\" can't be identified here), so no player's tours could be counted." };
    if (Q.latest) { // "last/most recent tour": answer only the single newest tour
      const slugs = Q.all_leagues ? Object.keys(REG.leagues) : [slug];
      const res = await Promise.all(slugs.map(s => playerTours(s, Q).catch(() => null)));
      const mins = x => { const m = String(x.time).match(/(\d+):(\d+)\s*([AP]M)/i); return m ? (+m[1] % 12 + (/p/i.test(m[3]) ? 12 : 0)) * 60 + +m[2] : 0; };
      let best = null, who = display(Q.player);
      for (const r of res) { if (!r || !r.list || !r.list.length) continue; if (r.player) who = r.player;
        const x = r.list[r.list.length - 1], k = `${x.date} ${String(mins(x)).padStart(4, "0")}`;
        if (!best || k > best.k) best = { k, x, league: r.league }; }
      if (!best) return { info: `No tour history was found for a player named ${who}.`, final: true };
      const x = best.x;
      return { info: `${who}'s last recorded tour: ${best.league}, tour ${x.id}, entered ${x.time} ${fmtDate(x.date)}${x.place ? `, finished place ${x.place}` : ""}.`, final: true };
    }
    if (Q.all_leagues) {
      const slugs = Object.keys(REG.leagues);
      const res = await Promise.all(slugs.map(s => playerTours(s, Q).catch(() => ({ league: leagueName(s), error: true }))));
      const lines = [], none = [], nohist = [], err = [];
      let who = display(Q.player), period = "";
      for (const r of res) {
        if (r.error) { err.push(r.league); continue; }
        if (r.player) who = r.player;
        if (!period && r.period) period = r.period;
        if (!r.tours_played) { (r.player ? none : nohist).push(r.league); continue; }
        const L = r.list || [];
        let detail;
        if (L.length <= 15) detail = L.map(x => `tour ${x.id} (entered ${x.time}${r.multiday ? " " + fmtDate(x.date) : ""}${x.place ? `, place ${x.place}` : ""})`).join("; ");
        else { // long history: group by day, newest first, so every tour is still listed
          const byDay = new Map();
          for (const x of [...L].reverse()) { if (!byDay.has(x.date)) byDay.set(x.date, []); byDay.get(x.date).push(`${x.id} ${x.time}${x.place ? ` (place ${x.place})` : ""}`); }
          detail = [...byDay].map(([d, a]) => `${fmtDate(d)}: ${a.join(", ")}`).join(" | ");
        }
        lines.push(`${r.league}: ${r.tours_played} tour${r.tours_played > 1 ? "s" : ""}${detail ? " - " + detail : ""}.`);
      }
      const ranged = !!(validDate(Q.date_from) || validDate(Q.date_to));
      let txt = lines.length ? `${who}, ${ranged ? period : "all recorded tours"}: ${lines.join(" ")}` : `${who} played in no tours in any league${ranged ? ` (${period})` : ""}. Leagues searched: ${slugs.map(leagueName).join(", ")}.`;
      if (lines.length && none.length) txt += ` No tours in: ${none.join(", ")}.`;
      if (nohist.length) txt += ` No player named ${who} in: ${nohist.join(", ")}.`;
      if (err.length) txt += ` Could not be read: ${err.join(", ")}.`;
      return { info: txt, final: true };
    }
    return playerTours(slug, Q);
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


function phraseTour(Q, data) {
  if (!data) return "";
  if (data.info && (data.final || !data.tour)) return data.info;
  const t = data.tour;
  if (!t) return data.info || "";
  const when = `${t.date} ${t.time}`, game = t.game || "tour", td = t.td ? `, hosted by ${t.td}` : "";
  const st = String(t.status || "");
  if (/cancel/i.test(st)) return `The ${when} ${game}${td} was cancelled.`;
  const wins = (t.winners || []).filter(Boolean);
  const team = Array.isArray(t.winning_team_players) ? t.winning_team_players.filter(Boolean) : [];
  const who = (team.length ? team : wins).join(" and ");
  if (Q.ask === "td") return `The ${when} ${game} was hosted by ${t.td || "an unlisted TD"}.`;
  if (Q.ask === "game") return `The ${when} tour${td} is ${game}.`;
  if (!wins.length) return `The ${when} ${game}${td} has no winner posted yet.`;
  const near = t.nearest ? ` ${t.nearest}` : "";
  const extra = team.length && team.join(" and ") !== wins.join(" and ") ? ` The winning team was ${team.join(" and ")}.` : "";
  return `The ${when} ${game}${td} was won by ${who}.${extra}${near}`.replace(/\.\s*\./g, ".").trim();
}

// Classify common questions without waiting on Workers AI (which can hang and freeze the page).
function simpleTourQ(q, now) {
  const tm = q.match(/\b(?:the\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (!tm) return null;
  let h = +tm[1], mi = +tm[2];
  const ap = (tm[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 7) h += 12; // same convention as PARSE_SYS
  let ask = "";
  if (/\bwho\s+(?:ran|hosted)\b|\bwho\s+was\s+the\s+td\b|\bwhich\s+td\b/i.test(q)) ask = "td";
  else if (/\b(?:what|which)\s+(?:game|format|variation|type)\b/i.test(q)) ask = "game";
  else if (/\bwho\s+(?:played|entered|is\s+in|was\s+in)\b/i.test(q)) ask = "participants";
  else if (/\bwho\s+won\b|\bwinners?\b/i.test(q)) ask = "winner";
  else return null;
  const per = periodFromQ(q, now);
  const from = per ? per[0] : now.date, to = per ? per[1] : now.date;
  return { ask, player: "", date_from: from, date_to: to, league: "", game: "", time: `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`, td: "" };
}

function shouldCacheAnswer(answer) {
  const t = String(answer || "");
  return t && !/could not be reached/i.test(t) && !/not configured/i.test(t) && !/taking too long/i.test(t);
}

// ---------------- handler
export async function onRequestPost({ request, env, waitUntil }) {
  let q = "";
  try { q = String((await request.json()).q || "").trim().slice(0, 300); } catch (_) {}
  if (!q) return json({ answer: "No question was asked." });
  const now = etNow();
  const ansKey = `ans/v5/${now.date}/${now.time.slice(0, 4)}/${q.toLowerCase().replace(/\s+/g, " ")}`;
  const c = caches.default, ak = new Request("https://ask-cache.local/" + encodeURIComponent(ansKey));
  const hit = await c.match(ak);
  if (hit) return json(await hit.json());
  // rate limit per IP (best effort, edge cache)
  const ip = request.headers.get("cf-connecting-ip") || "x", hr = new Date().toISOString().slice(0, 13);
  const rk = new Request(`https://ask-cache.local/rl/${encodeURIComponent(ip)}/${hr}`);
  const n = +(await (await c.match(rk))?.text() || 0);
  if (n >= RATE_PER_HOUR) return json({ answer: "Too many questions from this connection this hour." }, 429);
  await c.put(rk, new Response(String(n + 1), { headers: { "cache-control": "max-age=3600" } }));

  let Q, data, answer;
  // Fast path first — never block these on Workers AI.
  const stub = { ask: "", player: "", date_from: "", date_to: "", league: "", game: "", time: "", td: "", metric: "", top: 5 };
  stub.player = resolveAskPlayer(q, stub);
  const rateIntent = successRateIntent(q, stub);
  if (rateIntent) {
    Q = stub;
    Q.ask = "player_rate";
    const ctx = { env, url: request.url, debug: !!env.DEBUG };
    try { data = await playerRate(q, Q, now, rateIntent, ctx); } catch (_) { data = { info: "The tour-entry records this page uses for win rates could not be read right now.", final: true }; }
    answer = data.info || "The answer could not be produced.";
    const out = { answer, query: { ...Q, ask: "player_rate", player: data.player || Q.player }, data };
    if (shouldCacheAnswer(out.answer)) waitUntil(c.put(ak, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=300" } })));
    return json(out);
  }
  const lb = leaderboardIntent(q, stub) || (stub.ask === "leaderboard" ? { metric: /played|hosted/.test(String(stub.metric||"")) ? stub.metric : "wins", top: Math.max(3, Math.min(15, +stub.top || 5)) } : null);
  if (lb) {
    Q = stub;
    const ctx = { env, url: request.url, debug: !!env.DEBUG };
    try { data = await leaderboard(q, Q, now, lb, ctx); } catch (_) { data = { info: "MyLeague's tour data could not be reached right now.", final: true }; }
    answer = data.info || "The answer could not be produced.";
    const out = { answer, query: { ...Q, ask: "leaderboard", metric: lb.metric, top: lb.top }, data };
    if (shouldCacheAnswer(out.answer)) waitUntil(c.put(ak, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=300" } })));
    return json(out);
  }
  const simple = simpleTourQ(q, now);
  if (simple) {
    Q = simple;
    const ctx = { env, url: request.url, debug: !!env.DEBUG };
    try { data = await run(Q, now, ctx); } catch (_) { data = { info: "MyLeague's tour data could not be reached right now.", final: true }; }
    answer = phraseTour(Q, data) || data.info || "The answer could not be produced.";
    const out = { answer, query: Q, data };
    if (shouldCacheAnswer(out.answer)) waitUntil(c.put(ak, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=300" } })));
    return json(out);
  }

  // Other questions still use Workers AI to classify, then to phrase if needed.
  if (!env.AI) return json({ answer: "The answer service is not configured." }, 500);
  let perr = "";
  try { Q = await parse(env, q, now); } catch (e) { perr = String(e && e.message || e).slice(0, 200); }
  if (!Q) return json({ answer: "The question could not be read.", error: perr });
  if (isMePronoun(Q.player) || (!Q.player && SAYS_ME.test(q))) Q.player = ME;
  // Player-history questions with no period in the question: search the whole log, never a default window
  const PERIOD = /\b(today|tonight|yesterday|night|morning|afternoon|evening|week|month|year|since|between|before|after|until|days?|ago|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|20\d\d)\b|\d{1,2}\/\d{1,2}/i;
  if (Q.ask === "player_tours" && !PERIOD.test(q)) { Q.date_from = ""; Q.date_to = ""; }
  // Tours-played questions: "any/all/every league" or no league named -> search every league
  if (Q.ask === "player_tours" && (/\b(any|all|every|each)\s+(of\s+the\s+)?leagues?\b|\bleagues\b/i.test(q) || !String(Q.league || "").trim())) { Q.all_leagues = true; Q.league = ""; }
  if (Q.ask === "player_tours" && /\b(last|latest|most\s+recent(ly)?|recent|newest)\b/i.test(q) && !/\b(all|every|list|how many)\b/i.test(q)) Q.latest = true;
  // Player-participation questions: which tours did X play / win in a period, who played in a given tour
  if (Q.ask === "unsupported" && /\b(play(ed|ing)?|entered|joined|participat\w*)\b/i.test(q)) {
    const m = q.match(/\b(?:did|has|have|was|is|does)\s+@?([\w.\-]+)\s+(?:play|enter|join|participate|win|won)/i);
    if (!Q.player && m && !/^(i|we|you|anyone|anybody|everyone|he|she|they)$/i.test(m[1])) Q.player = m[1];
    if (Q.player) Q.ask = "player_tours"; else if (Q.time) Q.ask = "participants";
  }
  if (Q.ask === "participants" && Q.player) Q.ask = "player_tours";
  if (Q.ask === "player_wins" && Q.player && (/\b(any|all|every|each)\s+(of\s+the\s+)?leagues?\b|\bleagues\b/i.test(q) || !String(Q.league || "").trim())) { Q.all_leagues = true; Q.league = ""; }
  if (Q.player && (Q.ask === "player_tours" || Q.ask === "player_wins") && !Q.latest) {
    const per = periodFromQ(q, now);
    let f = validDate(Q.date_from) ? Q.date_from : "", t2 = validDate(Q.date_to) ? Q.date_to : f;
    if (per) [f, t2] = per;
    if (Q.ask === "player_wins" && !PERIOD.test(q)) { f = addDays(now.date, -29); t2 = now.date; }
    if (f && t2 && t2 >= f && f >= addDays(now.date, -MAX_DAYS) && Math.round((Date.parse(t2) - Date.parse(f)) / 864e5) <= 31 && (Q.ask === "player_wins" || PERIOD.test(q))) {
      Q.detail = true; Q.date_from = f; Q.date_to = t2; Q.ask = "player_tours"; Q.wins = /\b(win|won|wins|winner|winners|winning)\b/i.test(q) && !/\bplay(ed)?\b/i.test(q);
      if (!Q.all_leagues && !String(Q.league || "").trim()) Q.all_leagues = true;
    }
  }
  if (Q.ask === "participants" && !Q.player) { const per = periodFromQ(q, now); if (per) { Q.date_from = per[0]; Q.date_to = per[1]; } }
  const ctx = { env, url: request.url, debug: !!env.DEBUG };
  try { data = await run(Q, now, ctx); } catch (_) { data = { info: "MyLeague's tour data could not be reached right now." }; }
  if (data.final) answer = data.info;
  else if (data.info && Object.keys(data).every(k => ["info", "league", "dates", "player"].includes(k))) answer = data.info;
  else try {
    answer = await ai(env, ANSWER_SYS, `QUESTION: ${q}\nDATA: ${JSON.stringify(data)}`, 350);
  } catch (_) {}
  if (!answer) answer = data.info || "The answer could not be produced.";
  const out = { answer, query: Q, data };
  if (shouldCacheAnswer(out.answer)) waitUntil(c.put(ak, new Response(JSON.stringify(out), { headers: { "cache-control": "max-age=300" } })));
  return json(out);
}
export const onRequestGet = () => json({ answer: "Use POST with {\"q\": \"your question\"}." });
