// Owner-only high-res icon finder for the start pages.
// GET /api/iconfind?page=start|start2|start3&url=<site>  -> {candidates:[{src, source, w?, h?, svg?}]} (unsorted; the client measures)
//   Sources: Wikidata/Wikimedia official logo (P154), the site's web app manifest icons, apple-touch-icon / sized <link rel=icon>,
//   og:image / twitter:image.
// GET /api/iconfind?page=...&fetch=<image url> -> the image bytes (same-origin, so the page can resize it on a canvas).
// SSRF guards: http/https only, default ports, no IP literals / private or internal names, manual redirects (re-checked), size + time limits.
import { wrap, json, HttpError } from "../_shared/auth.js";
import { pageParam, isOwner } from "../_shared/startpages.js";
const UA = "DiamondSpadersStartPage/1.0 (https://diamondspaders.online; icon finder)";   // Wikimedia asks for a descriptive UA
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";  // many sites 403 bot UAs
const MAX_HTML = 768 * 1024, MAX_IMG = 6 * 1024 * 1024;

function safeUrl(v, base) {
  let u; try { u = new URL(String(v || ""), base); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || (u.port && u.port !== "80" && u.port !== "443")) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return null;   // no IP literals
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(h)) return null;
  return u;
}
async function get(url, { max, accept, timeout = 7000, browser = false }) {
  let u = safeUrl(url);
  for (let hop = 0; u && hop < 4; hop++) {
    let r;
    try { r = await fetch(u.href, { redirect: "manual", signal: AbortSignal.timeout(timeout), headers: { "User-Agent": browser ? BROWSER_UA : UA, "Accept": accept || "*/*", "Accept-Language": "en-US,en;q=0.8" } }); }
    catch { return null; }
    if (r.status >= 300 && r.status < 400) { u = safeUrl(r.headers.get("Location"), u); continue; }
    if (!r.ok || !r.body) return null;
    if (Number(r.headers.get("content-length") || 0) > max) return null;
    const reader = r.body.getReader(), parts = []; let n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length;
      if (n > max) { try { reader.cancel(); } catch {} return null; } parts.push(value); }
    const b = new Uint8Array(n); let o = 0; for (const p of parts) { b.set(p, o); o += p.length; }
    return { url: u.href, type: (r.headers.get("content-type") || "").toLowerCase(), body: b };
  }
  return null;
}
const text = (b) => new TextDecoder().decode(b);
const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag); return m ? (m[2] ?? m[3] ?? m[4]).replace(/&amp;/g, "&") : null; };
const sizeOf = (s) => { const m = /(\d+)x(\d+)/i.exec(s || ""); return m ? Math.max(+m[1], +m[2]) : 0; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

async function fromSite(siteUrl) {
  const out = [], page = await get(siteUrl, { max: MAX_HTML, accept: "text/html,application/xhtml+xml", browser: true });
  const html = page ? text(page.body).slice(0, MAX_HTML) : "", base = page ? page.url : siteUrl;   // page blocked: still try /manifest.json + /apple-touch-icon.png
  const title = ((/<meta[^>]+property=["']og:site_name["'][^>]*>/i.exec(html) || [])[0] && attr(/<meta[^>]+property=["']og:site_name["'][^>]*>/i.exec(html)[0], "content"))
    || ((/<title[^>]*>([^<]{1,120})/i.exec(html) || [])[1] || "").trim();
  let manifest = null;
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (attr(tag, "rel") || "").toLowerCase(), href = attr(tag, "href"); if (!href) continue;
    const u = safeUrl(href, base); if (!u) continue;
    if (rel.includes("manifest")) manifest = u.href;
    else if (rel.includes("apple-touch-icon")) out.push({ src: u.href, source: "apple-touch-icon", w: sizeOf(attr(tag, "sizes")) || 180 });
    else if (rel.includes("icon") && (sizeOf(attr(tag, "sizes")) >= 128 || /\.svg(\?|$)/i.test(u.pathname) || (attr(tag, "type") || "").includes("svg")))
      out.push({ src: u.href, source: "site icon", w: sizeOf(attr(tag, "sizes")) || 0, svg: /svg/i.test((attr(tag, "type") || "") + u.pathname) });
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const k = (attr(tag, "property") || attr(tag, "name") || "").toLowerCase();
    if (k === "og:image" || k === "og:image:url" || k === "og:image:secure_url" || k === "twitter:image" || k === "twitter:image:src") {
      const u = safeUrl(attr(tag, "content"), base); if (u) out.push({ src: u.href, source: k.startsWith("og") ? "og:image" : "twitter:image" });
    }
  }
  const mf = await get(manifest || new URL("/manifest.json", base).href, { max: 256 * 1024, accept: "application/manifest+json,application/json", browser: true });
  if (mf) { try {
    const j = JSON.parse(text(mf.body)), icons = [];
    for (const ic of (j.icons || []).slice(0, 40)) { const u = safeUrl(ic.src, mf.url); if (u) icons.push({ src: u.href, source: "web app manifest", w: sizeOf(ic.sizes), svg: /svg/.test(ic.type || u.pathname) }); }
    icons.sort((a, b) => (b.svg - a.svg) || (b.w - a.w)); out.push(...icons.slice(0, 3));   // the biggest few
  } catch {} }
  if (!out.some((c) => c.source === "apple-touch-icon")) out.push({ src: new URL("/apple-touch-icon.png", base).href, source: "apple-touch-icon", w: 180 });
  return { out, title };
}

async function wikiJson(url, browser) { const r = await get(url, { max: 2 * 1024 * 1024, accept: "application/json", timeout: 6000, browser: !!browser }); try { return r ? JSON.parse(text(r.body)) : null; } catch { return null; } }
async function fromWikidata(siteUrl, title, products) {
  const full = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, ""), h = host(siteUrl);
  const parts = full.split("."), reg = parts.slice(-2).join("."), label = parts.slice(-2, -1)[0] || full;
  const queries = (products || []).concat([full, title, label]).filter(Boolean), ids = [], exactTitle = {};
  for (const q of queries) {
    // exact article title first (product names like "Google Docs"), then search
    const t = await wikiJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=${encodeURIComponent(q)}&prop=pageprops&ppprop=wikibase_item`);
    for (const p of Object.values((t && t.query && t.query.pages) || {})) if (p.pageprops && p.pageprops.wikibase_item) { const id = p.pageprops.wikibase_item; if (!ids.includes(id)) ids.push(id); if ((products || []).includes(q)) exactTitle[id] = 1; }
    const s = await wikiJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4&gsrsearch=${encodeURIComponent(q)}&prop=pageprops&ppprop=wikibase_item`);
    for (const p of Object.values((s && s.query && s.query.pages) || {}).sort((a, b) => a.index - b.index)) if (p.pageprops && p.pageprops.wikibase_item && !ids.includes(p.pageprops.wikibase_item)) ids.push(p.pageprops.wikibase_item);
    if (ids.length >= 10) break;
  }
  if (!ids.length) return [];
  // per-item claims (whole entities like Google's are megabytes)
  const pick = ids.slice(0, 8), claims = await Promise.all(pick.map(async (id) => {
    const [l, w] = await Promise.all([wikiJson(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${id}&property=P154`),
      wikiJson(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${id}&property=P856`)]);
    return { P154: (l && l.claims && l.claims.P154) || null, P856: (w && w.claims && w.claims.P856) || [] };
  }));
  const prod = [], parent = [];
  for (let k = 0; k < pick.length; k++) {
    const id = pick[k], c = claims[k]; if (!c.P154) continue;
    const sites = (c.P856 || []).map((x) => { try { return new URL(x.mainsnak.datavalue.value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } });
    const isProduct = sites.includes(full) && full !== reg || exactTitle[id], isParent = sites.some((s2) => s2 === reg || s2 === h);
    if (!isProduct && !isParent) continue;
    const logos = c.P154.filter((l) => !(l.qualifiers && l.qualifiers.P582)).sort((a, b) => (b.rank === "preferred") - (a.rank === "preferred"));
    const list = isProduct ? prod : parent;
    for (const l of (logos.length ? logos : c.P154).slice(0, 2)) {
      const f = l.mainsnak.datavalue && l.mainsnak.datavalue.value; if (!f) continue;
      list.push({ src: "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f.replace(/ /g, "_")) + "?width=512", source: "Wikimedia logo (" + f + ")", w: 512, svg: /\.svg$/i.test(f), product: !!isProduct || full === reg });
    }
  }
  return prod.slice(0, 2).concat(prod.length ? [] : parent.slice(0, 2));
}

/* ---- product names from host + path (docs.google.com/spreadsheets -> Google Sheets) ---- */
const PRODUCTS = [
  [/^docs\.google\.com$/, /^\/spreadsheets/, "Google Sheets"], [/^docs\.google\.com$/, /^\/presentation/, "Google Slides"],
  [/^docs\.google\.com$/, /^\/forms/, "Google Forms"], [/^docs\.google\.com$/, /^\/drawings/, "Google Drawings"], [/^docs\.google\.com$/, null, "Google Docs"],
  [/^sheets\.google\.com$/, null, "Google Sheets"], [/^slides\.google\.com$/, null, "Google Slides"], [/^forms\.google\.com$/, null, "Google Forms"],
  [/^drive\.google\.com$/, null, "Google Drive"], [/^mail\.google\.com$/, null, "Gmail"], [/^(www\.)?gmail\.com$/, null, "Gmail"],
  [/^calendar\.google\.com$/, null, "Google Calendar"], [/^maps\.google\.[a-z.]+$/, null, "Google Maps"], [/^(www\.)?google\.[a-z.]+$/, /^\/maps/, "Google Maps"],
  [/^photos\.google\.com$/, null, "Google Photos"], [/^meet\.google\.com$/, null, "Google Meet"], [/^keep\.google\.com$/, null, "Google Keep"],
  [/^sites\.google\.com$/, null, "Google Sites"], [/^translate\.google\.[a-z.]+$/, null, "Google Translate"], [/^news\.google\.com$/, null, "Google News"],
  [/^chat\.google\.com$/, null, "Google Chat"], [/^classroom\.google\.com$/, null, "Google Classroom"], [/^contacts\.google\.com$/, null, "Google Contacts"],
  [/^play\.google\.com$/, null, "Google Play"], [/^gemini\.google\.com$/, null, "Google Gemini"], [/^earth\.google\.com$/, null, "Google Earth"],
  [/^music\.youtube\.com$/, null, "YouTube Music"], [/^studio\.youtube\.com$/, null, "YouTube Studio"], [/^(www\.)?youtube\.com$/, /^\/kids/, "YouTube Kids"],
  [/^outlook\.(live|office|office365)\.com$/, null, "Microsoft Outlook"], [/^onedrive\.live\.com$/, null, "OneDrive"], [/^teams\.(microsoft|live)\.com$/, null, "Microsoft Teams"],
  [/^web\.whatsapp\.com$/, null, "WhatsApp"], [/^messages\.google\.com$/, null, "Google Messages"], [/^voice\.google\.com$/, null, "Google Voice"],
];
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
function productNames(siteUrl) {
  const u = new URL(siteUrl), h = u.hostname.toLowerCase(), path = u.pathname || "/", out = [];
  for (const [hr, pr, name] of PRODUCTS) if (hr.test(h) && (!pr || pr.test(path))) { out.push(name); break; }
  const parts = h.replace(/^www\./, "").split(".");
  if (!out.length && parts.length > 2 && !/^(m|app|en|web|home|login|my|secure|accounts?)$/.test(parts[0]) && !/^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2]))
    out.push(cap(parts[parts.length - 2]) + " " + cap(parts[0]));   // e.g. "Google Docs" style guess for other subdomains
  return out;
}
const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/* ---- Iconify (free, no key): full-color logo sets first ---- */
const ICONIFY_SETS = ["logos", "skill-icons", "devicon", "vscode-icons", "thesvg-color", "selfhst", "streamline-color", "flat-color-icons"];
async function fromIconify(names) {
  const out = [];
  for (const name of names.slice(0, 2)) {
    const j = await wikiJson(`https://api.iconify.design/search?query=${encodeURIComponent(name)}&limit=64&prefixes=${ICONIFY_SETS.join(",")}`, true);   // Iconify 403s non-browser user agents
    const want = norm(name), short = norm(name.split(" ").slice(-1)[0]);
    const icons = ((j && j.icons) || []).filter((id) => {
      const n = id.split(":")[1] || "";
      if (/(^|-)(dark|light|outline|alt|cleaner|flat|wordmark|icon-only)(-|$)/.test(n)) return false;
      const nn = norm(n.replace(/-\d{4}$/, ""));
      return nn === want || nn.endsWith(want) || (names[0].split(" ").length > 1 ? nn.includes(want) : nn === short || nn.endsWith(short));
    }).sort((a, b) => ICONIFY_SETS.indexOf(a.split(":")[0]) - ICONIFY_SETS.indexOf(b.split(":")[0]));
    const seenSet = {};
    for (const id of icons) {
      const [pre, n] = id.split(":"); if (seenSet[pre]) continue; seenSet[pre] = 1;
      out.push({ src: `https://api.iconify.design/${pre}/${n}.svg?height=512`, source: "Iconify " + pre + " (" + n + ")", svg: true, product: true });
      if (out.length >= 3) break;
    }
    if (out.length) break;
  }
  return out;
}

/* ---- optional keyed sources (only when the secret exists; keys stay on the server) ---- */
function keyedFromEnv(env, h) {
  const out = [];
  if (env.LOGO_DEV_TOKEN) out.push({ src: "keyed:logodev:" + h, source: "Logo.dev", w: 512, product: true });
  return out;
}
async function fromBrandfetch(env, h) {
  if (!env.BRANDFETCH_API_KEY) return [];
  let r; try { r = await fetch("https://api.brandfetch.io/v2/brands/domain/" + encodeURIComponent(h), { headers: { Authorization: "Bearer " + env.BRANDFETCH_API_KEY }, signal: AbortSignal.timeout(8000) }); } catch { return []; }
  if (!r.ok) return [];
  let j; try { j = await r.json(); } catch { return []; }
  const out = [];
  for (const l of (j.logos || [])) {
    const fmts = (l.formats || []).slice().sort((a, b) => (b.format === "svg") - (a.format === "svg") || (b.width || 0) - (a.width || 0));
    const f = fmts[0]; if (!f || !safeUrl(f.src)) continue;
    out.push({ src: f.src, source: "Brandfetch " + l.type + (l.theme ? " (" + l.theme + ")" : ""), w: f.width || 0, h: f.height || 0, svg: f.format === "svg", product: true });
  }
  return out.sort((a, b) => /icon|symbol/.test(b.source) - /icon|symbol/.test(a.source)).slice(0, 3);
}
function resolveKeyed(env, v) {
  const m = /^keyed:logodev:([a-z0-9.-]{3,200})$/.exec(String(v || ""));
  if (m && env.LOGO_DEV_TOKEN) return `https://img.logo.dev/${m[1]}?token=${encodeURIComponent(env.LOGO_DEV_TOKEN)}&size=512&format=png&fallback=404`;
  return null;
}

export const onRequestGet = wrap(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, page = pageParam(q.get("page"));
  if (!page || !(await isOwner(request, env, page))) throw new HttpError(403, "Owners only");
  if (q.get("fetch")) {
    const r = await get(resolveKeyed(env, q.get("fetch")) || q.get("fetch"), { max: MAX_IMG, accept: "image/*" });
    if (!r) throw new HttpError(502, "Couldn't get that image");
    const sig = String.fromCharCode(...r.body.slice(0, 12)), head = text(r.body.slice(0, 512)).toLowerCase();
    const type = r.body[0] === 0x89 && r.body[1] === 0x50 ? "image/png" : r.body[0] === 0xff && r.body[1] === 0xd8 ? "image/jpeg"
      : sig.startsWith("GIF8") ? "image/gif" : sig.slice(8, 12) === "WEBP" ? "image/webp" : (r.body[0] === 0 && r.body[2] === 1) ? "image/x-icon"
      : (head.includes("<svg") || r.type.includes("svg")) ? "image/svg+xml" : "";
    if (!type) throw new HttpError(415, "Not an image");
    return new Response(r.body, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
  }
  const site = safeUrl(q.get("url"));
  if (!site) throw new HttpError(400, "Bad site address");
  const products = productNames(site.href), h = site.hostname.toLowerCase().replace(/^www\./, "");
  const [s, ic, bf] = await Promise.all([fromSite(site.href), fromIconify(products.length ? products : []).catch(() => []), fromBrandfetch(env, h)]);
  const wd = await fromWikidata(site.href, s.title, products).catch(() => []);
  s.out.forEach((c) => { c.product = true; });   // the target URL's own icons
  const seen = {}, candidates = [];
  for (const c of keyedFromEnv(env, h).concat(bf, wd, ic, s.out)) { if (seen[c.src]) continue; seen[c.src] = 1; candidates.push(c); }
  return json({ site: site.href, title: s.title, products, keyed: { logodev: !!env.LOGO_DEV_TOKEN, brandfetch: !!env.BRANDFETCH_API_KEY }, candidates });
});
