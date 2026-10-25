// GET /api/live -> live Diamond Spaders results straight from the MyLeague calendar feed, so the page stays current
// even when the box that commits index.html is asleep. Rendering mirrors spades-updater/update_winners.py exactly
// (labels, manual winners/overrides/teams, hidden tours, aliases, avatars all come from /live/config.json, which
// that script exports on every publish). Winners shown are ONLY those in the feed or the manual files - never guessed.
// Response (cached ~60 s at the edge):
//   {ok, now, today, days:{ "YYYY-MM-DD": {heading, cells:[html...], keys:[...]} } (today, yesterday, day before),
//    tours:[{dt,h,m,game,td,url,ava}]}
const CAL_URL = "https://www.myleague.com/pages/remote/tournamentCalendar.php";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120";
const TTL = 60;
const SVG_ICON = '<circle cx="11" cy="11" r="10" fill="#2a1608" stroke="#fbe646"/><path d="M11 4 C8 8 6 10 6 13 C6 16 8.5 17.5 '
  + '11 16 C13.5 17.5 16 16 16 13 C16 10 14 8 11 4 Z" fill="#fbe646"/>';
const BG_EVEN = "#1a1200", BORDER = "#fbe646";

// ---------------------------------------------------------------- dates (America/New_York)
function etParts(d) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d)) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
function dayLabel(day, today) {
  if (day === today) return "TODAY";
  if (day === addDays(today, -1)) return "YESTERDAY";
  return WEEKDAYS[new Date(day + "T12:00:00Z").getUTCDay()];
}

// ---------------------------------------------------------------- feed
function unxml(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
async function fetchCalendar(start, end, league) {
  const [sy, sm, sd] = start.split("-").map(Number), [ey, em, ed] = end.split("-").map(Number);
  const body = new URLSearchParams({ range: "daily", strLadder: league, DisplayCount: "300", page: "1", sort: "1",
    sd, sm, sy, ed, em, ey });
  let last;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(CAL_URL, { method: "POST", body, headers: { "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded" } });
      const t = await r.text();
      if (r.ok && /<SQLResults/.test(t)) return t;
      last = new Error(`calendar HTTP ${r.status}${/Just a moment/i.test(t) ? " (challenge)" : ""}`);
    } catch (e) { last = e; }
  }
  throw last;
}

// Winning team name straight from the tour's TEAMS page, so names show even while the box is asleep
function defaultTeam(name, players) {
  const n = name.replace(/\s+/g, "").toLowerCase();
  if (players.length !== 2) return false;
  const parts = name.split("&").map(x => x.trim().replace(/\.+$/, "").toLowerCase());
  const pl = players.map(x => x.toLowerCase());
  if (parts.length === 2 && parts.every(Boolean) &&
      ((pl[0].startsWith(parts[0]) && pl[1].startsWith(parts[1])) || (pl[1].startsWith(parts[0]) && pl[0].startsWith(parts[1])))) return true;
  // Require a substantial first-name prefix (min 8 chars, or the whole name if shorter)
  // so real names like HotEgammer are not treated as MyLeague's auto default.
  for (const [a, b] of [[pl[0], pl[1]], [pl[1], pl[0]]]) {
    if (!(n.endsWith(b) && n.length > b.length)) continue;
    const prefix = n.slice(0, n.length - b.length);
    if (a.startsWith(prefix) && prefix.length >= Math.min(8, a.length)) return true;
  }
  return false;
}
function unhtml(s) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'"); }
async function fetchTeam(t, league) {
  const cache = caches.default, ck = new Request(`https://team-cache.local/v2/${t.id}/${t.winners.join(",").toLowerCase()}`);
  const hit = await cache.match(ck);
  if (hit) return (await hit.text()) || null;
  const want = t.winners.map(w => w.toLowerCase()).sort().join("|");
  let found = null, ok = false;
  for (const srv of ["cgi6", "plus2"]) {
    try {
      const r = await fetch(`https://${srv}.igl.net/tourneysystem/players.php?tcount=${t.id}&path=${league}`, { headers: { "User-Agent": UA } });
      const page = await r.text();
      const m = page.match(/\$\.parseJSON\('([\s\S]*?)'\);/);
      if (!m) continue;
      const d = JSON.parse(m[1].replace(/\\\\/g, "\x00").replace(/\\'/g, "'").replace(/\x00/g, "\\"));
      ok = true;
      for (const tm of d.teams || []) {
        const names = (tm.players || []).map(p => { const mm = String(p).match(/<strong>([\s\S]*?)<\/strong>/); return unhtml(mm ? mm[1] : String(p).replace(/<[^>]+>/g, "")).trim(); });
        if (names.map(n => n.toLowerCase()).sort().join("|") === want) {
          const name = unhtml(String(tm.team || "")).trim();
          found = name && !defaultTeam(name, names) ? name : null;
          break;
        }
      }
      break;
    } catch (e) { continue; }
  }
  if (ok) await cache.put(ck, new Response(found || "", { headers: { "cache-control": "max-age=86400" } }));
  return found;
}
function parseCalendar(xml) {
  const out = [], seen = new Set();
  for (const rec of xml.match(/<objRecord>[\s\S]*?<\/objRecord>/g) || []) {
    const d = {};
    for (const m of rec.slice(11, -12).matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) d[m[1]] = unxml(m[2]).trim();
    const t = parseInt(d.time, 10), y = parseInt(d.year, 10), mo = parseInt(d.month, 10), dd = parseInt(d.day, 10);
    if ([t, y, mo, dd].some(Number.isNaN)) continue;
    if (d.tcount && seen.has(d.tcount)) continue;
    seen.add(d.tcount);
    const date = `${y}-${String(mo + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;   // month is 0-based in the feed
    out.push({ id: d.tcount || "", date, h: Math.floor(t / 100), m: t % 100, td: d.td || "", game: d.location || "",
      status: d.status || "", perteam: d.perteam || "",
      winners: (d.winner || "").split(",").map(s => s.trim()).filter(Boolean) });
  }
  out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.h - b.h) || (a.m - b.m) || (a.id < b.id ? -1 : 1));
  return out;
}

// ---------------------------------------------------------------- port of update_winners.py rendering
// partner tours whose feed text says nothing ("2 VS 2"): the TD's tour name from the tour page ("SUICIDE PARDS", ...)
const ambiguous = t => String(t.perteam) === "2"
  && /^(\d ?VS\.? ?\d|SPADES)?$/.test(t.game.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim());
async function tourName(tid, league) {
  const ck = new Request(`https://diamondspaders.online/__tourname/${league}/${tid}`);
  try {
    const hit = await caches.default.match(ck);
    if (hit) return await hit.text();
    const r = await fetch(`https://cgi6.igl.net/tourney/${league}/${tid}/`, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const page = await r.text();
    const m = page.match(/<h2>([\s\S]*?)<\/h2>/) || page.match(/<title>[^<]*?'s ([\s\S]*?) Tournament\s*<\/title>/);
    const name = m ? unxml(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
    await caches.default.put(ck, new Response(name, { headers: { "cache-control": "public, max-age=21600" } }));
    return name;
  } catch (e) { return null; }
}

function makeRenderer(cfg, names = {}) {
  const aliases = cfg.aliases || {};
  const shown = n => aliases[n] ?? n;
  const key = n => shown(n).toLowerCase();
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const L = cfg.labels || {};
  const noC = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !k.startsWith("_")));
  const byId = noC(L.by_id), slot = Object.fromEntries(Object.entries(noC(L.by_slot)).map(([k, v]) => [k.toLowerCase(), v]));
  const rx = s => new RegExp(s, "i");
  const raw = (L.raw_rules || []).map(r => [rx(r.match), r.perteam ?? null, r.label]);
  const rules = (L.rules || []).map(r => [rx(r.match), r.match2 ? rx(r.match2) : null, r.not ? rx(r.not) : null, r.perteam ?? null, r.label]);
  const normFeed = s => s.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim();
  const pad = n => String(n).padStart(2, "0");
  function gameLabel(text) {
    let s = text.toUpperCase().replace(/\d+\s*\/\s*\d+/g, " ").replace(/\s+/g, " ").trim();
    if (/^\d\s*VS\s*\d$/.test(s)) return "PARDS";
    s = s.replace(/\bPARD A BOT SUI(CIDE)?\b/g, "SUI PAB").replace(/\bPARD A BOT\b/g, "PAB").replace(/\bSUICIDE\b/g, "SUI").replace(/^REG(ULAR)? /, "");
    return s.replace(/\s+/g, " ").trim() || "SPADES";
  }
  function mapped(t) {
    if (byId[t.id] != null) return byId[t.id];
    const n = normFeed(t.game);
    const k = `${t.td}|${pad(t.h)}:${pad(t.m)}|${n}`.toLowerCase();
    if (slot[k] != null) return slot[k];
    const pt = parseInt(t.perteam, 10) || 0;
    for (const [r, p, lab] of raw) if (r.test(t.game) && (p === null || p === pt)) return lab;
    for (const [r, r2, rn, p, lab] of rules)
      if (r.test(n) && (!r2 || r2.test(n)) && (!rn || !rn.test(n)) && (p === null || p === pt)) return lab;
    return null;
  }
  // known tours: exactly the label the updater chose; new tours: the same rules, else the raw-text fallback
  function mapped2(t) {
    if (byId[t.id] != null) return byId[t.id];
    if (ambiguous(t) && names[t.id]) {
      const saved = t.game; t.game = names[t.id];
      const lab = mapped({ ...t, id: "" }); t.game = saved;     // the name through the same rules (pins already checked)
      if (lab) return lab;
    }
    return mapped(t);
  }
  const label = t => (cfg.labels_by_id || {})[t.id] ?? mapped2(t) ?? gameLabel(t.game);
  const clock12 = (h, m) => `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
  const nameSize = n => n.length <= 9 ? 22 : n.length <= 12 ? 20 : n.length <= 15 ? 18 : 16;
  function avatar(name) {
    if ((cfg.avatar_overrides || {})[name]) return cfg.avatar_overrides[name];
    const av = cfg.avatars || {};
    for (const k of [key(name), shown(name).replace(/\s+/g, "").toLowerCase(), name.replace(/\s+/g, "").toLowerCase()])
      if (av[k]) return av[k];
    return null;
  }
  const icon = (url, size, radius) => url
    ? `<img src="${url}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:${radius}px;border:1px solid ${BORDER};">`
    : `<svg width="${size}" height="${size}" viewBox="0 0 22 22">${SVG_ICON}</svg>`;
  const prof = (name, inner) => `<a href="https://www.myleague.com/diamondspaders/profile/${encodeURIComponent(name)}" title="${attr(name)}" style="display:block;line-height:0;color:inherit;text-decoration:none;cursor:pointer;">${inner}</a>`;
  function teamName(t) {
    const n = (cfg.manual_teams || {})[String(t.id)];
    if (n) return n;
    return t.winners.length === 2 ? t.winners.map(shown).join(" & ") : null;
  }
  const attr = s => esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  const champ = sub => sub ? ` <span class="ds-champ" title="${attr(sub)}">${esc(sub.split(/\s+/).filter(Boolean).map(w => w[0]).join("").toUpperCase())}</span>` : "";
  const subtitle = t => (cfg.subtitles || {})[String(t.id)] || null;
  function winnerCell(i, lab, names, size, team, sub) {
    const bg = i % 2 === 0 ? `background:${BG_EVEN};` : "background:#000;";
    if (names.length === 1) {
      const n = shown(names[0]);
      return `<div style="padding:14px 10px;${bg}"><div style="display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center;">${prof(names[0], icon(avatar(names[0]), 64, 8))}`
        + `<div><div style="font-size:13px;font-weight:700;">${esc(lab)}${champ(sub)}</div><div style="font-size:${size || nameSize(n)}px;font-weight:800;">${esc(n)}</div></div></div></div>`;
    }
    const longest = Math.max(...names.map(w => shown(w).length));
    const fs = longest <= 7 ? 15 : longest <= 9 ? 14 : longest <= 11 ? 13 : 12;
    const pairs = names.map(w => `<div style="display:flex;align-items:center;gap:6px;min-width:0;">${prof(w, icon(avatar(w), 44, 8))}<div style="font-size:${fs}px;font-weight:800;overflow-wrap:anywhere;line-height:1.1;">${esc(shown(w))}</div></div>`).join("");
    const teamHtml = team ? `<div style="font-size:14px;font-weight:600;color:#fbe646;margin-bottom:6px;text-align:center;">${esc(team)}</div>` : '<div style="margin-bottom:4px;"></div>';
    return `<div style="padding:14px 10px;${bg}"><div style="font-size:13px;font-weight:700;margin-bottom:2px;">${esc(lab)}${champ(sub)}</div>${teamHtml}`
      + `<div style="display:grid;grid-template-columns:auto auto;justify-content:space-between;gap:6px;">${pairs}</div></div>`;
  }
  function day(tours, d, today) {
    const dl = dayLabel(d, today), cells = [], keys = [];
    const bot = (cfg.bottom || []).map(String), bk = t => { const i = bot.indexOf(String(t.id)); return i < 0 ? 0 : i + 1; };
    for (const t of [...tours].sort((a, b) => bk(a) - bk(b))) {   // bottom_tours.json: these tiles go last in their day
      if (t.date !== d || !t.winners.length || (cfg.hidden || []).map(String).includes(String(t.id))) continue;
      const clk = clock12(t.h, t.m), lab = label(t);
      const text = dl === "TODAY" || dl === "YESTERDAY" ? `${clk} ${lab}` : `${dl} ${clk} ${lab}`;
      const size = (cfg.fonts || {})[`${clk}|${t.winners.map(n => shown(n).toLowerCase()).join(",")}`];
      cells.push(winnerCell(cells.length, text, t.winners, size, teamName(t), subtitle(t)));
      keys.push(`${clk}|${lab}|${t.winners.map(n => shown(n).toLowerCase()).join("&")}|${t.winners.length === 2 ? teamName(t) : ""}`);
    }
    return { heading: dl, cells, keys,
      heading_html: `<div style="grid-column:1/-1;padding:12px 10px 4px;font-size:15px;font-weight:800;letter-spacing:0.14em;color:#fbe646;">${dl}</div>`,
      empty_html: `<div style="grid-column:1/-1;padding:14px 10px;font-size:13px;font-weight:700;">${dl} &mdash; ${d === today ? "no winners yet" : "no winners recorded"}</div>` };
  }
  return { label, avatar, day, subtitle };
}

async function build(env, origin) {
  const cfgRes = await env.ASSETS.fetch(new Request(origin + "/live/config.json"));
  if (!cfgRes.ok) throw new Error("config.json " + cfgRes.status);
  const cfg = await cfgRes.json();
  const now = new Date(), et = etParts(now), today = et.date;
  const xml = await fetchCalendar(addDays(today, -2), addDays(today, 2), cfg.league || "diamondspaders");
  const tours = parseCalendar(xml);
  for (const e of cfg.extra_tours || []) {     // extra_tours.json: hand-run tours not in the feed (never upcoming)
    const [hh, mm] = String(e.time || "").split(":").map(Number);
    if (!e.id || !e.date || Number.isNaN(hh) || Number.isNaN(mm)) continue;
    tours.push({ id: String(e.id), date: e.date, h: hh, m: mm, td: e.td || "", game: e.label || "", status: "extra", perteam: "",
      winners: [...(e.winners || [])] });
    if (e.label) { cfg.labels_by_id = { ...(cfg.labels_by_id || {}) }; if (cfg.labels_by_id[e.id] == null) cfg.labels_by_id[e.id] = e.label; }
  }
  tours.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.h - b.h) || (a.m - b.m) || (String(a.id) < String(b.id) ? -1 : 1));
  const mw = cfg.manual_winners || {}, mo = cfg.manual_overrides || {};
  for (const t of tours) {
    // User-reported winners always beat the MyLeague feed (and page fallbacks).
    if (mw[t.id]?.length) t.winners = [...mw[t.id]];
    if (mo[t.id]?.length) t.winners = [...mo[t.id]];   // overrides win over manual_winners

    // HARD RULE: singles/CUT/PAB = 1 winner; partners = one team of 2. LadderBux payouts are never winners.
    { const txt = `${t.game || ""} ${t.name || ""} ${(cfg.labels_by_id || {})[t.id] || ""}`;
      const pard = String(t.perteam) === "2" ? true : String(t.perteam) === "1" ? false
        : /\b(CUT|SINGLES?|SOLO|PAB|1 ?VS\.? ?1)\b/i.test(txt) ? false : /PAR(TNER)?D?S|SUI|SUICIDE|PASS ?2|RANDOM|2 ?VS\.? ?2/i.test(txt);
      if (t.winners.length > (pard ? 2 : 1)) t.winners = t.winners.slice(0, pard ? 2 : 1); }
  }
  cfg.manual_teams = { ...(cfg.manual_teams || {}) };
  await Promise.all(tours.filter(t => t.date >= addDays(today, -1) && t.winners.length === 2 && t.id && !cfg.manual_teams[String(t.id)])
    .map(async t => { try { const n = await fetchTeam(t, cfg.league || "diamondspaders"); if (n) cfg.manual_teams[String(t.id)] = n; } catch (e) {} }));
  const names = {};
  await Promise.all(tours.filter(t => t.date >= today && ambiguous(t) && (cfg.labels_by_id || {})[t.id] == null)
    .map(async t => { const n = await tourName(t.id, cfg.league || "diamondspaders"); if (n) names[t.id] = n; }));
  const R = makeRenderer(cfg, names), hidden = new Set((cfg.hidden || []).map(String));
  const days = {};
  for (const d of [today, addDays(today, -1), addDays(today, -2)]) days[d] = R.day(tours, d, today);
    const upcoming = tours.filter(t => !hidden.has(String(t.id)) && t.date === today && !t.winners.length && t.status !== "2" && t.status !== "extra"
    && (t.status !== "-1" || et.min < t.h * 60 + t.m + 15))   // keep started tours until a winner posts; drop only not-started ones 15 min past start
    .map(t => ({ dt: t.date, h: t.h, m: t.m, game: R.label(t), td: t.td, url: (cfg.tour_url || "").replace("%s", t.id), ava: R.avatar(t.td) || "", ...(R.subtitle(t) ? { sub: R.subtitle(t) } : {}) }));
  return { ok: true, now: now.toISOString(), today, days, tours: upcoming };
}

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const cache = caches.default, ck = new Request(url.origin + "/api/live?cache=v4");
  const hit = await cache.match(ck);
  if (hit) return hit;
  let body, status = 200;
  try { body = await build(env, url.origin); }
  catch (e) { body = { ok: false, error: String(e && e.message || e) }; status = 502; }
  const res = new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8",
    "cache-control": `public, max-age=${status === 200 ? 30 : 0}`, "access-control-allow-origin": "*" } });
  if (status === 200) {
    const c = new Response(res.clone().body, res);
    c.headers.set("cache-control", `public, max-age=${TTL}`);
    waitUntil(cache.put(ck, c));
  }
  return res;
}
