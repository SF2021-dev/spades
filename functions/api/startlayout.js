// Start-page layouts. GET ?page=start|start2|start3 (public) -> {page, layout|null, updated_at}
// PUT ?page=... (owner cookie ds_start_<page> required) body {layout:[{top,items:[{href,title,img,label}]}]}
//   Uploaded/generated icons arrive as data:image/... URLs; they are stored in D1 msg_images (<=600 KB each)
//   and replaced with /api/img/<id>. Returns the stored layout.
import { wrap, json, readJson, HttpError } from "../_shared/auth.js";
import { pageParam, isOwner } from "../_shared/startpages.js";
const MAX_JSON = 400 * 1024, MAX_IMG = 600 * 1024, MAX_ITEMS = 120, MAX_ROWS = 12;

export const onRequestGet = wrap(async ({ request, env }) => {
  const page = pageParam(new URL(request.url).searchParams.get("page"));
  if (!page) throw new HttpError(400, "Unknown page");
  const r = await env.DB.prepare("SELECT json, updated_at FROM start_layouts WHERE page = ?").bind(page).first();
  return json({ page, layout: r ? JSON.parse(r.json) : null, updated_at: r ? r.updated_at : null });
});

function str(v, max) { const s = String(v == null ? "" : v); if (s.length > max) throw new HttpError(400, "Text too long"); return s; }
function httpUrl(v) {
  let u; try { u = new URL(String(v)); } catch { throw new HttpError(400, "Bad link: " + String(v).slice(0, 80)); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new HttpError(400, "Links must be http or https");
  return u.href;
}
function decodeImg(v) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) throw new HttpError(415, "Icons must be PNG, JPEG, WebP or GIF");
  const bin = atob(m[2]); if (bin.length > MAX_IMG) throw new HttpError(413, "Icon image too big");
  const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  const png = b[0] === 0x89 && b[1] === 0x50, jpg = b[0] === 0xff && b[1] === 0xd8, gif = b[0] === 0x47 && b[1] === 0x49,
    webp = String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  const mime = png ? "image/png" : jpg ? "image/jpeg" : gif ? "image/gif" : webp ? "image/webp" : "";
  if (!mime) throw new HttpError(415, "Not an image");
  return { mime, data: b };
}

export const onRequestPut = wrap(async ({ request, env }) => {
  const page = pageParam(new URL(request.url).searchParams.get("page"));
  if (!page) throw new HttpError(400, "Unknown page");
  if (!(await isOwner(request, env, page))) throw new HttpError(403, "Only this page's owner can save it. Log in first.");
  if (Number(request.headers.get("Content-Length") || 0) > 6 * 1024 * 1024) throw new HttpError(413, "Too big");
  const b = await readJson(request), now = Date.now(), inserts = [];
  if (!Array.isArray(b.layout) || !b.layout.length || b.layout.length > MAX_ROWS) throw new HttpError(400, "Bad layout");
  let n = 0;
  const layout = b.layout.map((row) => {
    if (!row || !Array.isArray(row.items)) throw new HttpError(400, "Bad row");
    return { top: !!row.top, items: row.items.map((it) => {
      if (++n > MAX_ITEMS) throw new HttpError(400, "Too many icons");
      let img = str(it.img, 900 * 1024);
      if (img.startsWith("data:")) {
        const d = decodeImg(img), id = "st" + now.toString(36) + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
        inserts.push(env.DB.prepare("INSERT INTO msg_images (id, name, mime, bytes, data, t) VALUES (?, ?, ?, ?, ?, ?)").bind(id, "startpage:" + page, d.mime, d.data.length, d.data, now));
        img = "/api/img/" + id;
      } else if (!/^(\/api\/img\/[A-Za-z0-9_-]{6,40}|\/?icons\/[A-Za-z0-9_.\/-]{1,120}|https:\/\/[^\s"'<>]{1,500})$/.test(img)) throw new HttpError(400, "Bad icon address");
      return { href: httpUrl(it.href), title: str(it.title, 120), img, label: it.label == null ? null : str(it.label, 120) };
    }) };
  });
  const out = JSON.stringify(layout);
  if (out.length > MAX_JSON) throw new HttpError(413, "Layout too big");
  inserts.push(env.DB.prepare("INSERT INTO start_layouts (page, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(page) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at").bind(page, out, now));
  await env.DB.batch(inserts);
  return json({ ok: true, page, layout, updated_at: now });
});
