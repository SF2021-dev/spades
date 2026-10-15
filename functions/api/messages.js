// Shared message box store: GET/POST /api/messages (Cloudflare Pages Function + D1 binding "DB").
// GET  -> {messages:[{id,name,message,t}]} oldest first (latest SHOW).
// POST {name,message,pin,id?} -> {ok:true, messages:[...]}. pin must match the name's 3-digit PIN (see /api/pin),
//   or, without a pin, the browser's remember-me cookie (ds_pin_token) must be valid for that name;
//   401 wrong PIN, 428 name has no PIN yet, 429 locked after too many wrong PINs.
// Writes are atomic inserts (no read-modify-write), so concurrent posts can't overwrite each other.
// Images: POST may carry image:"data:image/(jpeg|webp|png|gif);base64,..." (<= 400 KB decoded; GIFs <= 1.5 MB; checked by magic bytes; stored as a BLOB). It is stored
//   in D1 msg_images and the message text becomes "[img:<id>]" (rendered by msgbox.js, served by /api/img/<id>).
//   PIN-gated like text; rate limits: IMG_PER_HOUR per name, IMG_PER_DAY site-wide.
// Delete an image: also DELETE FROM msg_images WHERE id='...'
// Delete a message: wr d1 execute diamondspaders-auth --remote --command "DELETE FROM messages WHERE id='...'"
import { wrap, json, readJson, HttpError } from "../_shared/auth.js";
import { checkPin, pinRow, tokenName } from "../_shared/pins.js";

const SHOW = 200, MAX_NAME = 40, MAX_MSG = 1000;
const MAX_IMG = 400 * 1024, MAX_GIF = 1536 * 1024, GIF_MSG = "GIFs must be under 1.5 MB.", IMG_PER_HOUR = 10, IMG_PER_DAY = 300;
const IMG_TAG = /\[img:/i;

const MIN_IMG_CLIENT = 55;   // msgbox.js version that sends GIFs unflattened; older (cached) pages are told to reload
// Pasted web GIF: fetch the original by URL (https only, public hosts, <= 1.5 MB, must really be a GIF).
async function fetchGif(u) {
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

function decodeImage(v) {
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

async function list(env) {
  const r = await env.DB.prepare(
    "SELECT id, name, message, t FROM (SELECT * FROM messages ORDER BY t DESC LIMIT ?) ORDER BY t ASC"
  ).bind(SHOW).all();
  return r.results || [];
}

function clean(m, now) {
  if (!m || typeof m !== "object") throw new HttpError(400, "Bad message");
  const name = String(m.name ?? "").replace(/\s+/g, " ").trim();
  const message = (m.image || m.imageUrl) ? "[img]" : String(m.message ?? "").replace(/\r\n?/g, "\n").trim();
  if (!m.image && !m.imageUrl && IMG_TAG.test(message)) throw new HttpError(400, "Message can't contain [img: tags.");
  if (!name) throw new HttpError(400, "Name is required.");
  if (!message) throw new HttpError(400, "Message is required.");
  if (name.length > MAX_NAME) throw new HttpError(400, `Name must be ${MAX_NAME} characters or less.`);
  if (message.length > MAX_MSG) throw new HttpError(400, `Message must be ${MAX_MSG} characters or less.`);
  let id = String(m.id ?? "");
  if (!/^[A-Za-z0-9_.-]{4,80}$/.test(id)) id = now.toString(36) + "-" + crypto.randomUUID().slice(0, 8);
  return { id, name, message, t: now };   // server time: clients can't backdate or pin messages
}

export const onRequestGet = wrap(async ({ env }) => json({ messages: await list(env) }));

export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  if (b && b.website) throw new HttpError(400, "Rejected");          // honeypot
  const now = Date.now();
  const m = clean(b, now);
  // PIN sent with the message, or (no PIN) this browser's 30-day remember-me cookie for the same name
  if (/^\d{3}$/.test(String(b.pin ?? ""))) m.name = await checkPin(env, m.name, b.pin);   // canonical spelling
  else {
    const tn = await tokenName(env, request);
    if (tn && tn.toLowerCase() === m.name.toLowerCase()) m.name = tn;
    else if (!(await pinRow(env, m.name))) throw new HttpError(428, "Create a 3-digit PIN for this name first.");
    else throw new HttpError(401, "Please enter your PIN.");    // not counted as a wrong guess
  }
  if (b.image || b.imageUrl) {
    if (!(Number(b.cv) >= MIN_IMG_CLIENT)) throw new HttpError(426, "The message board was updated. Please reload the page (pull down or press F5), then post your picture again.");
    const img = b.imageUrl ? await fetchGif(b.imageUrl) : decodeImage(b.image);
    const hour = await env.DB.prepare("SELECT COUNT(*) AS n FROM msg_images WHERE name = ? COLLATE NOCASE AND t > ?").bind(m.name, now - 3600e3).first();
    if (hour && hour.n >= IMG_PER_HOUR) throw new HttpError(429, `You can post ${IMG_PER_HOUR} pictures an hour. Please try again later.`);
    const day = await env.DB.prepare("SELECT COUNT(*) AS n FROM msg_images WHERE t > ?").bind(now - 86400e3).first();
    if (day && day.n >= IMG_PER_DAY) throw new HttpError(429, "Too many pictures today. Please try again tomorrow.");
    const imgId = m.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40).padEnd(6, "0");
    m.message = "[img:" + imgId + "]";
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO msg_images (id, name, mime, bytes, data, t) VALUES (?, ?, ?, ?, ?, ?)").bind(imgId, m.name, img.mime, img.data.length, img.data, now),
      env.DB.prepare("INSERT OR IGNORE INTO messages (id, name, message, t) VALUES (?, ?, ?, ?)").bind(m.id, m.name, m.message, m.t),
    ]);
    return json({ ok: true, ids: [m.id], messages: await list(env) }, 201);
  }
  // INSERT OR IGNORE: a retried send with the same id is a no-op instead of a duplicate.
  await env.DB.prepare("INSERT OR IGNORE INTO messages (id, name, message, t) VALUES (?, ?, ?, ?)").bind(m.id, m.name, m.message, m.t).run();
  const rows = [m];
  return json({ ok: true, ids: rows.map((m) => m.id), messages: await list(env) }, 201);
});
