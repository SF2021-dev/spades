import { HttpError } from "./auth.js";
const MAX_IMG = 400 * 1024, MAX_GIF = 1536 * 1024, GIF_MSG = "GIFs must be under 1.5 MB.";
// Pasted web GIF: fetch the original by URL (https only, public hosts, <= 1.5 MB, must really be a GIF).
export async function fetchGif(u) {
  let url; try { url = new URL(String(u || "")); } catch { throw new HttpError(400, "Bad picture link."); }
  const h = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username || /^(localhost|.*\.local|.*\.internal)$/.test(h) || /^[\d.]+$/.test(h) || h.includes(":"))
    throw new HttpError(400, "That picture link can't be used. Save the GIF and upload it with the picture button instead.");
  let r; try { r = await fetch(url.href, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "Accept": "image/gif,image/*" } }); }
  catch { throw new HttpError(502, "Couldn't download that GIF. Save it and upload it with the picture button instead."); }
  if (!r.ok || !r.body) throw new HttpError(502, "Couldn't download that GIF. Save it and upload it with the picture button instead.");
  const len = Number(r.headers.get("content-length") || 0);
  if (len > MAX_GIF) throw new HttpError(413, GIF_MSG);
  const reader = r.body.getReader(), parts = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length;
    if (n > MAX_GIF) { try { reader.cancel(); } catch {} throw new HttpError(413, GIF_MSG); } parts.push(value); }
  const b = new Uint8Array(n); let o = 0; for (const p of parts) { b.set(p, o); o += p.length; }
  const sig = String.fromCharCode(...b.slice(0, 6));
  if (sig !== "GIF87a" && sig !== "GIF89a") throw new HttpError(415, "NOTGIF");
  return { mime: "image/gif", data: b };
}

export function decodeImage(v) {
  const m = /^data:(image\/(?:jpeg|webp|png|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(v || ""));
  if (!m) throw new HttpError(415, "Only JPEG, WebP, PNG or GIF images can be posted.");
  const isGif = m[1] === "image/gif", lim = isGif ? MAX_GIF : MAX_IMG;
  if (m[2].length > Math.ceil(lim * 4 / 3) + 8) throw new HttpError(413, isGif ? GIF_MSG : "That image is too big.");
  let bin; try { bin = atob(m[2]); } catch { throw new HttpError(400, "Bad image data."); }
  const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  if (b.length > lim) throw new HttpError(413, isGif ? GIF_MSG : "That image is too big.");
  if (b.length < 32) throw new HttpError(415, "That file isn't a supported image.");
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const webp = String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  const gif = String.fromCharCode(...b.slice(0, 6)) === "GIF87a" || String.fromCharCode(...b.slice(0, 6)) === "GIF89a";
  const mime = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : gif ? "image/gif" : "";
  if (!mime) throw new HttpError(415, "That file isn't a supported image.");
  if (mime !== "image/gif" && b.length > MAX_IMG) throw new HttpError(413, "That image is too big.");
  return { mime, data: b };
}


// Chat pictures: store in msg_images, return the "[img:<id>]" message body (same rendering/serving as the board).
export async function storeChatImage(env, name, b, now) {
  const img = b.imageUrl ? await fetchGif(b.imageUrl) : decodeImage(b.image);
  const hour = await env.DB.prepare("SELECT COUNT(*) AS n FROM msg_images WHERE name = ? COLLATE NOCASE AND t > ?").bind(name, now - 3600e3).first();
  if (hour && hour.n >= 20) throw new HttpError(429, "You can post 20 pictures an hour. Please try again later.");
  const id = "c" + now.toString(36) + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  await env.DB.prepare("INSERT INTO msg_images (id, name, mime, bytes, data, t) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name, img.mime, img.data.length, img.data, now).run();
  return "[img:" + id + "]";
}
