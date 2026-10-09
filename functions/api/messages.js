// Shared message box store: GET/POST /api/messages (Cloudflare Pages Function + D1 binding "DB").
// GET  -> {messages:[{id,name,message,t}]} oldest first (latest SHOW).
// POST {name,message,pin,id?} -> {ok:true, messages:[...]}. pin must match the name's 3-digit PIN (see /api/pin);
//   401 wrong PIN, 428 name has no PIN yet, 429 locked after too many wrong PINs.
// Writes are atomic inserts (no read-modify-write), so concurrent posts can't overwrite each other.
// Delete a message: wr d1 execute diamondspaders-auth --remote --command "DELETE FROM messages WHERE id='...'"
import { wrap, json, readJson, HttpError } from "../_shared/auth.js";
import { checkPin } from "../_shared/pins.js";

const SHOW = 200, MAX_NAME = 40, MAX_MSG = 1000;

async function list(env) {
  const r = await env.DB.prepare(
    "SELECT id, name, message, t FROM (SELECT * FROM messages ORDER BY t DESC LIMIT ?) ORDER BY t ASC"
  ).bind(SHOW).all();
  return r.results || [];
}

function clean(m, now) {
  if (!m || typeof m !== "object") throw new HttpError(400, "Bad message");
  const name = String(m.name ?? "").replace(/\s+/g, " ").trim();
  const message = String(m.message ?? "").replace(/\r\n?/g, "\n").trim();
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
  m.name = await checkPin(env, m.name, b.pin);   // canonical spelling of the name the PIN was created with
  // INSERT OR IGNORE: a retried send with the same id is a no-op instead of a duplicate.
  await env.DB.prepare("INSERT OR IGNORE INTO messages (id, name, message, t) VALUES (?, ?, ?, ?)").bind(m.id, m.name, m.message, m.t).run();
  const rows = [m];
  return json({ ok: true, ids: rows.map((m) => m.id), messages: await list(env) }, 201);
});
