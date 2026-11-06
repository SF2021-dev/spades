import { readFileSync, writeFileSync } from "node:fs";
function standingsWinner(html) {
  const table = html.match(/<table border="0" cellspacing="0" cellpadding="0">([\s\S]*?)<\/table>/i);
  if (!table) return null;
  let maxCol = -1;
  const names = [];
  const openCols = new Set();
  for (const row of table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    let col = 0;
    for (const cell of row[1].matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)) {
      const title = cell[2].match(/title="([^"]+)"/i)?.[1]?.trim() ?? "";
      const text = cell[2].replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&/gi, "&").replace(/\s+/g, " ").trim();
      if (/a\.s\.a\.p/i.test(text)) { openCols.add(col); if (col > maxCol) maxCol = col; }
      else if (text) { names.push({ col, name: text, title }); if (col > maxCol) maxCol = col; }
      col += 1;
    }
  }
  if (openCols.has(maxCol)) return null;
  const finals = names.filter((entry) => entry.col === maxCol && !/bye|\(n\/a\)/i.test(entry.name));
  if (finals.length !== 1) return null;
  const champ = finals[0];
  if (champ.title.includes(",")) return champ.title.split(",").map((part) => part.trim()).filter(Boolean);
  const one = champ.name.replace(/^\(\d+\)\s*/, "").replace(/\.$/, "").trim();
  return one ? [one] : null;
}


const mem = new Map();
let disk = { winners: {}, teams: {}, names: {} };
globalThis.caches = { default: {
  async match(req) {
    const hit = mem.get(typeof req === "string" ? req : req.url);
    return hit ? new Response(hit) : undefined;
  },
  async put(req, res) {
    mem.set(typeof req === "string" ? req : req.url, await res.clone().text());
  },
}};
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
  const key = `${t.id}|${[...t.winners].map(w => w.toLowerCase()).sort().join("|")}`;
  if (Object.prototype.hasOwnProperty.call(disk.teams, key)) return disk.teams[key] || null;
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
      let byPlayers = undefined, byWinner = undefined;
      for (const tm of d.teams || []) {
        const names = (tm.players || []).map(p => {
          const mm = String(p).match(/<strong>([\s\S]*?)<\/strong>/);
          return unhtml(mm ? mm[1] : String(p).replace(/<[^>]+>/g, "")).trim();
        });
        if (names.map(n => n.toLowerCase()).sort().join("|") !== want) continue;
        const name = unhtml(String(tm.team || "")).trim();
        const resolved = name && !defaultTeam(name, names) ? name : null;
        if (String(tm.status || "").toLowerCase().includes("winner")) byWinner = resolved;
        else if (byPlayers === undefined) byPlayers = resolved;
      }
      found = byWinner !== undefined ? byWinner : (byPlayers !== undefined ? byPlayers : null);
      break;
    } catch (e) { continue; }
  }
  if (ok) disk.teams[key] = found || "";
  return found;
}
async function fetchWinnerTeam(id, league) {
  for (const srv of ["cgi6", "plus2"]) {
    try {
      const r = await fetch(`https://${srv}.igl.net/tourneysystem/players.php?tcount=${id}&path=${league}`, { headers: { "User-Agent": UA } });
      const page = await r.text();
      const m = page.match(/\$\.parseJSON\('([\s\S]*?)'\);/);
      if (!m) continue;
      const d = JSON.parse(m[1].replace(/\\\\/g, "\x00").replace(/\\'/g, "'").replace(/\x00/g, "\\"));
      for (const tm of d.teams || []) {
        if (!String(tm.status || "").toLowerCase().includes("winner")) continue;
        const names = (tm.players || []).map(p => {
          const mm = String(p).match(/<strong>([\s\S]*?)<\/strong>/);
          return unhtml(mm ? mm[1] : String(p).replace(/<[^>]+>/g, "")).trim();
        }).filter(Boolean);
        if (names.length) return { team: unhtml(String(tm.team || "")).trim(), names };
      }
      return null;
    } catch (e) { continue; }
  }
  return null;
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
  if (disk.names[tid]) return disk.names[tid];
  const ck = new Request(`https://diamondspaders.online/__tourname/${league}/${tid}`);
  try {
    const hit = await caches.default.match(ck);
    if (hit) return await hit.text();
    const r = await fetch(`https://cgi6.igl.net/tourney/${league}/${tid}/`, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const page = await r.text();
    const m = page.match(/<h2>([\s\S]*?)<\/h2>/) || page.match(/<title>[^<]*?'s ([\s\S]*?) Tournament\s*<\/title>/);
    const name = m ? unxml(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
    if (name) disk.names[tid] = name;
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
    const id = String(t.id);
    // User manual_teams always win; auto_teams is learned and may be refreshed below for today/yesterday.
    const n = (cfg.manual_teams || {})[id] || (cfg.auto_teams || {})[id];
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
      // Winners section: only real winners (never "winner pending"). Unfinished tours stay in the tour list only.
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
  for (const e of cfg.added_tours || []) {     // tours the feed missed; stay on the list until a winner is recorded
    const [hh, mm] = String(e.time || "").split(":").map(Number);
    if (!e.date || Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const td = e.td || "";
    if (tours.some(t => t.status !== "extra" && t.date === e.date && t.h === hh && t.m === mm && String(t.td || "").toLowerCase() === td.toLowerCase())) continue;
    tours.push({ id: String(e.id || ""), date: e.date, h: hh, m: mm, td, game: e.label || "", status: "added", perteam: "",
      winners: [], url: e.url || "https://www.myleague.com/diamondspaders/tournaments" });
  }
  tours.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.h - b.h) || (a.m - b.m) || (String(a.id) < String(b.id) ? -1 : 1));
  const mw = cfg.manual_winners || {}, mo = cfg.manual_overrides || {};
  for (const t of tours) {
    // ABSOLUTE RULES (user t86u): 1) winners ONLY from the user (manual_winners/overrides/extra tours) or a standings.php
    // champion (verified by update_winners.py and shipped in manual_winners) -- the raw feed "winner" field is never trusted
    // for today/yesterday; 2) never >1 player / >1 team -- there are NO ties, extra names = invalid = no winner.
    if (t.status !== "extra" && t.date >= addDays(today, -1)) t.winners = [];
    // User report always wins (never blocked by calendar feed status). Standings-verified names ship in cfg.manual_winners via page_winners.
    if (mw[t.id]?.length) t.winners = [...mw[t.id]];
    if (mo[t.id]?.length) t.winners = [...mo[t.id]];

    // 2026-10-31: no winner before a tour starts (MyLeague reuses recurring tour ids; old manual entries must not attach to a future slot).
    if (t.date > today || (t.date === today && et.min < t.h * 60 + t.m)) t.winners = [];

    // HARD RULE: singles/CUT/PAB = 1 winner; partners = one team of 2. LadderBux payouts are never winners.
    { const txt = `${t.game || ""} ${t.name || ""} ${(cfg.labels_by_id || {})[t.id] || ""}`;
      const pard = String(t.perteam) === "2" ? true : String(t.perteam) === "1" ? false
        : /\b(CUT|SINGLES?|SOLO|PAB|1 ?VS\.? ?1)\b/i.test(txt) ? false : /PAR(TNER)?D?S|SUI|SUICIDE|PASS ?2|RANDOM|2 ?VS\.? ?2/i.test(txt);
      if (t.winners.length > (pard ? 2 : 1)) t.winners = []; }
    // Only a tour in its window is worth a standings read. A known winner is never read again.
    if (!t.winners.length && disk.winners[t.id]?.length) t.winners = [...disk.winners[t.id]];
    const startMin = t.h * 60 + t.m;
    const startedToday = t.date === today && et.min >= startMin;
    if (!t.winners.length && t.id && t.status !== "extra" && startedToday && et.min <= startMin + 180) t.pending = true;
  }
  await Promise.all(tours.filter(t => t.pending && t.id).map(async t => {
    const league = cfg.league || "diamondspaders";
    const txt = `${t.game || ""} ${(cfg.labels_by_id || {})[t.id] || ""}`;
    const pard = String(t.perteam) === "2" || /PAR(TNER)?D?S|SUI|SUICIDE|PASS ?2|2 ?VS/i.test(txt);
    try {
      const r = await fetch(`https://cgi6.igl.net/tourneysystem/standings.php?tcount=${t.id}&path=${league}`, { headers: { "User-Agent": UA } });
      const names = standingsWinner(await r.text());
      if (names && names.length && (!pard || names.length >= 2)) {
        t.winners = pard ? names.slice(0, 2) : names.slice(0, 1);
        if (t.winners.length) { t.pending = false; disk.winners[t.id] = [...t.winners]; return; }
      }
    } catch (e) {}
    try {
      const win = await fetchWinnerTeam(t.id, league);
      if (!win) return;
      t.winners = pard ? win.names.slice(0, 2) : win.names.slice(0, 1);
      if (win.team && t.winners.length === 2) disk.teams[`${t.id}|${[...t.winners].map(w => w.toLowerCase()).sort().join("|")}`] = win.team;
      if (t.winners.length) { t.pending = false; disk.winners[t.id] = [...t.winners]; }
    } catch (e) {}
  }));
  cfg.manual_teams = { ...(cfg.manual_teams || {}) };
  cfg.auto_teams = { ...(cfg.auto_teams || {}) };
  // Team names already on file are not read again.
  await Promise.all(tours.filter(t => t.date >= addDays(today, -1) && t.winners.length === 2 && t.id && !cfg.manual_teams[String(t.id)])
    .map(async t => { try { const n = await fetchTeam(t, cfg.league || "diamondspaders"); if (n) cfg.auto_teams[String(t.id)] = n; } catch (e) {} }));
  const names = {};
  await Promise.all(tours.filter(t => t.date >= today && ambiguous(t) && (cfg.labels_by_id || {})[t.id] == null)
    .map(async t => { const n = await tourName(t.id, cfg.league || "diamondspaders"); if (n) names[t.id] = n; }));
  const R = makeRenderer(cfg, names), hidden = new Set((cfg.hidden || []).map(String));
  const days = {};
  for (const d of [today, addDays(today, -1), addDays(today, -2)]) days[d] = R.day(tours, d, today);
    // A tour leaves the list 75 minutes after it starts unless it is still the live one. Canceled tours are in hidden.
    const liveSlot = t => t.date === today && !t.winners.length && et.min <= t.h * 60 + t.m + 75;
    const upcoming = tours.filter(t => !hidden.has(String(t.id)) && t.status !== "extra" && liveSlot(t))
    .map(t => ({ dt: t.date, h: t.h, m: t.m, game: R.label(t), td: t.td, url: t.url || (cfg.tour_url || "").replace("%s", t.id), ava: R.avatar(t.td) || "", ...(R.subtitle(t) ? { sub: R.subtitle(t) } : {}) }));
  const board = tours.filter(t => !hidden.has(String(t.id)) && t.date === today && t.status !== "extra").map(t => ({
    date: t.date, h: t.h, m: t.m, game: R.label(t), td: t.td,
    url: t.url || (cfg.tour_url || "https://www.myleague.com/diamondspaders/tournament/%s/").replace("%s", t.id),
    id: t.id, winners: t.winners || [], pending: !!t.pending,
  }));
  const schedule = tours.filter(t => !hidden.has(String(t.id)) && t.status !== "extra" && (t.date > today || liveSlot(t))).map(t => ({
    dt: t.date, h: t.h, m: t.m, game: R.label(t), td: t.td,
    url: t.url || (cfg.tour_url || "https://www.myleague.com/diamondspaders/tournament/%s/").replace("%s", t.id),
  }));
  return { ok: true, now: now.toISOString(), today, days, tours: upcoming, board, schedule };
}


function loadJson(url) {
  try { return JSON.parse(readFileSync(url, "utf8")); } catch { return null; }
}
function signature(body) {
  const days = {};
  for (const [k, v] of Object.entries(body.days || {})) days[k] = v.keys;
  return JSON.stringify({ today: body.today, tours: body.tours, board: body.board, schedule: body.schedule, days });
}
const liveUrl = new URL("../update/live.json", import.meta.url);
const cacheUrl = new URL("../update/fetch-cache.json", import.meta.url);
const prev = loadJson(liveUrl);
disk = Object.assign(disk, loadJson(cacheUrl) || {});
disk.winners = disk.winners || {};
disk.teams = disk.teams || {};
disk.names = disk.names || {};
const etNow = etParts(new Date());
const idleMin = prev?.now ? (Date.now() - Date.parse(prev.now)) / 60000 : 999;
const slots = [];
for (const t of prev?.board || []) slots.push([t.date, t.h * 60 + t.m]);
for (const t of prev?.schedule || []) slots.push([t.dt, t.h * 60 + t.m]);
const waiting = (prev?.board || []).some(t => t.date === etNow.date && !(t.winners || []).length && etNow.min >= t.h * 60 + t.m && etNow.min <= t.h * 60 + t.m + 180);
const busy = !prev || prev.today !== etNow.date || waiting || slots.some(([day, mins]) => day === etNow.date && etNow.min >= mins - 20 && etNow.min <= mins + 90);
if (!busy && idleMin < 60) {
  console.log("skipped, nothing in play");
  process.exit(0);
}
const before = JSON.stringify(disk);
const cfgText = readFileSync(new URL("../live/config.json", import.meta.url), "utf8");
const env = { ASSETS: { fetch: async () => new Response(cfgText, { status: 200 }) } };
const body = await build(env, "https://diamondspaders.online");
if (JSON.stringify(disk) !== before) writeFileSync(cacheUrl, JSON.stringify(disk));
const same = prev && signature(prev) === signature(body);
function plain(html) { return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
if (prev?.days) {
  for (const day of Object.keys(body.days)) {
    const oldCells = prev.days[day]?.cells || [];
    const fresh = body.days[day].cells || [];
    if (oldCells.length <= fresh.length) continue;
    const merged = oldCells.slice();
    for (const cell of fresh) {
      const stamp = plain(cell).slice(0, 28);
      if (!merged.some(old => plain(old).includes(stamp))) merged.push(cell);
    }
    body.days[day].cells = merged;
    if (prev.days[day]?.heading) body.days[day].heading = prev.days[day].heading;
  }
}
if (!same || (prev && signature(prev) !== signature(body))) {
  writeFileSync(liveUrl, JSON.stringify(body));
  const hers = /^fetch_?it_?up$/i;
  const tomorrow = addDays(body.today, 1);
  const schedule = (body.schedule || []).filter(t => t.dt === body.today || t.dt === tomorrow || hers.test(String(t.td || "").trim()));
  const lines = schedule.map(t => {
    const game = t.game === "SUI PASS 2 PAB" ? "PAB" : t.game;
    return `    { dt: ${JSON.stringify(t.dt)}, h: ${t.h}, m: ${t.m}, game: ${JSON.stringify(game)}, td: ${JSON.stringify(t.td)}, url: ${JSON.stringify(t.url)} },`;
  }).join("\n");
  for (const file of ["../start.html", "../start2/index.html"]) {
    const path = new URL(file, import.meta.url);
    let html = readFileSync(path, "utf8");
    const at = html.indexOf("  TOURS = [");
    const end = html.indexOf("\n  ];", at);
    if (at < 0 || end < 0) throw new Error("TOURS list missing in " + file);
    html = html.slice(0, at) + "  TOURS = [\n" + lines + "\n  ];" + html.slice(end + 5);
    writeFileSync(path, html);
  }
  console.log("tours", (body.board || []).length, "today", body.today, "upcoming", (body.tours || []).length, "listed", schedule.length);
} else {
  console.log("no change");
}
