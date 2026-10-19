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

async function wikiJson(url) { const r = await get(url, { max: 2 * 1024 * 1024, accept: "application/json", timeout: 6000 }); try { return r ? JSON.parse(text(r.body)) : null; } catch { return null; } }
async function fromWikidata(siteUrl, title) {
  const h = host(siteUrl), label = h.split(".").slice(-2, -1)[0] || h, queries = [h, title, label].filter(Boolean);
  const ids = [];
  for (const q of queries) {
    const s = await wikiJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4&gsrsearch=${encodeURIComponent(q)}&prop=pageprops&ppprop=wikibase_item`);
    for (const p of Object.values((s && s.query && s.query.pages) || {}).sort((a, b) => a.index - b.index)) if (p.pageprops && p.pageprops.wikibase_item && !ids.includes(p.pageprops.wikibase_item)) ids.push(p.pageprops.wikibase_item);
    if (ids.length >= 6) break;
  }
  if (!ids.length) return [];
  const e = await wikiJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${ids.slice(0, 8).join("|")}`);
  const out = [];
  for (const id of ids) {
    const c = e && e.entities && e.entities[id] && e.entities[id].claims; if (!c || !c.P154) continue;
    const sites = (c.P856 || []).map((x) => host(x.mainsnak.datavalue && x.mainsnak.datavalue.value));
    if (!sites.some((s) => s === h || s.endsWith("." + h) || h.endsWith("." + s))) continue;   // official website must match
    // current logo first: preferred rank, and skip logos with an end date (P582)
    const logos = c.P154.filter((l) => !(l.qualifiers && l.qualifiers.P582)).sort((a, b) => (b.rank === "preferred") - (a.rank === "preferred"));
    for (const l of (logos.length ? logos : c.P154).slice(0, 2)) {
      const f = l.mainsnak.datavalue && l.mainsnak.datavalue.value; if (!f) continue;
      out.push({ src: "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f.replace(/ /g, "_")) + "?width=512", source: "Wikimedia logo (" + f + ")", w: 512, svg: /\.svg$/i.test(f) });
    }
    if (out.length) break;
  }
  return out;
}

export const onRequestGet = wrap(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, page = pageParam(q.get("page"));
  if (!page || !(await isOwner(request, env, page))) throw new HttpError(403, "Owners only");
  if (q.get("fetch")) {
    const r = await get(q.get("fetch"), { max: MAX_IMG, accept: "image/*" });
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
  const s = await fromSite(site.href);
  const wd = await fromWikidata(site.href, s.title).catch(() => []);
  const seen = {}, candidates = [];
  for (const c of wd.concat(s.out)) { if (seen[c.src]) continue; seen[c.src] = 1; candidates.push(c); }
  return json({ site: site.href, title: s.title, candidates });
});
