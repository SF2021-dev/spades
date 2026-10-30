// Private chat for /chat (D1 tables chat_perms, chat_msgs - db/chat.sql). Identity = message-board name, proven by the
// remember-me cookie (ds_pin_token, set by /api/pin check with remember:true).
// GET ?action=me                      -> {name}
// GET ?action=check&name=X            -> {exists, name}   (known = has a board PIN or has posted on the board)
// GET ?action=pending                 -> {requests:[{from,t}]}  (people asking to chat with me)
// GET ?action=status&with=X           -> {status: none|pending|ok|no, incoming:bool}
// GET ?action=list&with=X&since=T     -> {messages:[{id,from,to,kind,body,hasAudio,t}]}
// POST {action:"request", to}         -> asks X for permission (shown to X on next login)
// POST {action:"answer", from, ok}    -> approve/deny a request
// POST {action:"send", to, kind:"text"|"tts", body}          (needs approved permission)
// GET ?action=buzzes                 -> {buzzes:[{from,t}]} (consumed on read)
// POST {action:"buzz", to}            -> attention ping (1 per 5s per pair)
// POST {action:"audio", to, kind:"clip"|"live", audio:"data:audio/...;base64,..."}  (<= 1 MB)
import { storeChatImage, deleteImage } from "../_shared/msgimg.js";
import { wrap, json, readJson, HttpError, currentUser } from "../_shared/auth.js";
import { normName, tokenName } from "../_shared/pins.js";
import { known, ROSTER } from "../_shared/chatnames.js";
import { findMember, canonFn } from "../_shared/standings.js";
const MAX_AUDIO = 1024 * 1024, MAX_TXT = 1000;

async function me(env, request) {
  let n = await tokenName(env, request);
  if (!n) { try { const u = await currentUser(request, env); if (u && u.username) n = (await known(env, u.username)) || u.username; } catch {} }
  if (!n) throw new HttpError(401, "Please log in to chat.");
  return n;
}
async function perm(env, a, b) {
  const out = await env.DB.prepare("SELECT status FROM chat_perms WHERE from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE").bind(a, b).first();
  const inc = await env.DB.prepare("SELECT status FROM chat_perms WHERE from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE").bind(b, a).first();
  if ((out && out.status === "ok") || (inc && inc.status === "ok")) return { status: "ok", incoming: false };
  if (inc && inc.status === "pending") return { status: "pending", incoming: true };
  return { status: out ? out.status : "none", incoming: false };
}
async function needOk(env, a, b) { if ((await perm(env, a, b)).status !== "ok") throw new HttpError(403, "They haven't approved chatting with you yet."); }
const mid = (now) => now.toString(36) + "-" + crypto.randomUUID().slice(0, 8);

export const onRequestGet = wrap(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, a = q.get("action");
  if (a === "suggest") {
    const qq = String(q.get("q") || "").trim().slice(0, 40); if (!qq) return json({ names: [] });
    const like = qq.replace(/[%_\\]/g, (c) => "\\" + c) + "%";
    const seen = new Set(), out = [];
    const add = (n, src) => { if (n && !seen.has(n.toLowerCase()) && out.length < 10) { seen.add(n.toLowerCase()); out.push({ name: n, src }); } };
    const run = async (sql) => { try { return (await env.DB.prepare(sql).bind(like).all()).results || []; } catch { return []; } };
    (await run("SELECT username AS n FROM users WHERE verified_at IS NOT NULL AND username LIKE ? ESCAPE '\\' ORDER BY username COLLATE NOCASE LIMIT 10")).forEach((r) => add(r.n, "member"));
    (await run("SELECT name AS n FROM msg_pins WHERE name LIKE ? ESCAPE '\\' LIMIT 10")).forEach((r) => add(r.n, "player"));
    (await run("SELECT DISTINCT name AS n FROM messages WHERE name LIKE ? ESCAPE '\\' LIMIT 10")).forEach((r) => add(r.n, "player"));
    const ql = qq.toLowerCase();
    ROSTER.filter((n) => n.toLowerCase().startsWith(ql)).forEach((n) => add(n, "player"));
    if (out.length < 10) ROSTER.filter((n) => n.toLowerCase().includes(ql)).forEach((n) => add(n, "player"));
    return json({ names: out });
  }
  if (a === "check") {
    const n = normName(q.get("name"));
    if (!n || n.length > 40) throw new HttpError(400, "Name is required.");
    const k = await known(env, n), C = await canonFn(); return json({ exists: !!k, name: C(k || n) });
  }
  const my = await me(env, request);
  if (a === "me") return json({ name: (await canonFn())(my) });
  if (a === "pending") {
    const r = await env.DB.prepare("SELECT from_name AS \"from\", t FROM chat_perms WHERE to_name = ? COLLATE NOCASE AND status = 'pending' ORDER BY t").bind(my).all();
    const C = await canonFn(); return json({ requests: (r.results || []).map((x) => ({ ...x, from: C(x.from) })) });
  }
  if (a === "partners") {
    const r = await env.DB.prepare("SELECT CASE WHEN from_name = ? COLLATE NOCASE THEN to_name ELSE from_name END AS name, MAX(t) AS t FROM chat_perms " +
      "WHERE status = 'ok' AND (from_name = ? COLLATE NOCASE OR to_name = ? COLLATE NOCASE) GROUP BY lower(name) ORDER BY name COLLATE NOCASE").bind(my, my, my).all();
    const o = await env.DB.prepare("SELECT to_name AS name, status FROM chat_perms WHERE from_name = ? COLLATE NOCASE AND status IN ('pending','no') ORDER BY t DESC").bind(my).all();
    let favs = [];
    try { favs = ((await env.DB.prepare("SELECT name FROM chat_favs WHERE owner = ? COLLATE NOCASE").bind(my).all()).results || []).map((x) => x.name); } catch {}
    const C = await canonFn(); return json({ partners: (r.results || []).map((x) => C(x.name)), outgoing: (o.results || []).map((x) => ({ ...x, name: C(x.name) })), favorites: favs.map(C) });
  }
  if (a === "buzzes") {
    const now = Date.now();
    const r = await env.DB.prepare("SELECT from_name AS \"from\", MAX(t) AS t FROM chat_buzz WHERE to_name = ? COLLATE NOCASE AND t > ? GROUP BY lower(from_name)").bind(my, now - 60e3).all();
    await env.DB.prepare("DELETE FROM chat_buzz WHERE to_name = ? COLLATE NOCASE OR t < ?").bind(my, now - 60e3).run();
    const C = await canonFn(); return json({ buzzes: (r.results || []).map((x) => ({ ...x, from: C(x.from) })) });
  }
  const w = normName(q.get("with"));
  if (!w) throw new HttpError(400, "Who are you chatting with?");
  if (a === "status") return json(await perm(env, my, w));
  if (a === "list") {
    await needOk(env, my, w);
    const since = Number(q.get("since")) || 0;
    const r = await env.DB.prepare(
      "SELECT id, from_name AS \"from\", to_name AS \"to\", kind, body, (audio IS NOT NULL) AS hasAudio, t FROM chat_msgs " +
      "WHERE ((from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE) OR (from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE)) AND t > ? ORDER BY t DESC LIMIT 100"
    ).bind(my, w, w, my, since).all();
    const C = await canonFn(); return json({ messages: (r.results || []).reverse().map((x) => ({ ...x, from: C(x.from), to: C(x.to) })) });
  }
  throw new HttpError(400, "Unknown action");
});


async function unsendMsg(env, my, id, where, binds) {   // delete my own message (latest only is offered in the UI); also its stored picture
  id = String(id || "").slice(0, 80);
  const row = await env.DB.prepare("SELECT id, body FROM chat_msgs WHERE id = ? AND from_name = ? COLLATE NOCASE AND " + where).bind(id, my, ...binds).first();
  if (!row) throw new HttpError(404, "Message not found (only your own messages can be removed).");
  const st = [env.DB.prepare("DELETE FROM chat_msgs WHERE id = ?").bind(id)];
  const pm = /^\[img:([A-Za-z0-9_-]{6,40})\]$/.exec(row.body || "");
  if (pm) st.push(env.DB.prepare("DELETE FROM msg_images WHERE id = ?").bind(pm[1]), env.DB.prepare("DELETE FROM msg_image_chunks WHERE id = ?").bind(pm[1]));
  try { await env.DB.batch(st); } catch (e) { await st[0].run(); }
  if (pm) await deleteImage(env, pm[1]);
  return json({ ok: true });
}

export const onRequestPost = wrap(async ({ request, env }) => {
  const my = await me(env, request), b = await readJson(request) || {}, now = Date.now();
  if (b.action === "answer") {
    const f = normName(b.from);
    await env.DB.prepare("UPDATE chat_perms SET status = ?, t = ? WHERE from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE").bind(b.ok ? "ok" : "no", now, f, my).run();
    return json({ ok: true });
  }
  if (b.action === "fav") {   // star/unstar a contact (per user)
    const w = normName(b.with); if (!w) throw new HttpError(400, "Who?");
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS chat_favs (owner TEXT NOT NULL COLLATE NOCASE, name TEXT NOT NULL COLLATE NOCASE, t INTEGER NOT NULL, PRIMARY KEY (owner, name))").run();
    if (b.on) await env.DB.prepare("INSERT OR REPLACE INTO chat_favs (owner, name, t) VALUES (?, ?, ?)").bind(my, w, now).run();
    else await env.DB.prepare("DELETE FROM chat_favs WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE").bind(my, w).run();
    return json({ ok: true });
  }
  if (b.action === "remove") {   // take someone off my private-chat list (they must ask again)
    const w = normName(b.with); if (!w) throw new HttpError(400, "Who?");
    await env.DB.prepare("DELETE FROM chat_perms WHERE (from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE) OR (from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE)").bind(my, w, w, my).run();
    try { await env.DB.prepare("DELETE FROM chat_favs WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE").bind(my, w).run(); } catch {}
    return json({ ok: true });
  }
  if (b.action === "cancel") {   // withdraw/delete my own outgoing request (pending or declined)
    const w = normName(b.to || b.with); if (!w) throw new HttpError(400, "Who?");
    await env.DB.prepare("DELETE FROM chat_perms WHERE from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE AND status != 'ok'").bind(my, w).run();
    return json({ ok: true });
  }
  if (b.action === "request") {   // only players listed on the MyLeague standings pages
    const sm = await findMember(normName(b.to));
    if (sm === null) throw new HttpError(503, "Couldn't reach the Diamond Spaders standings to check that name. Try again in a minute.");
    if (!sm) throw new HttpError(404, "\"" + normName(b.to) + "\" isn't on the Diamond Spaders standings, so you can't send a chat request to that name.");
  }
  let to = await known(env, normName(b.to));
  if (to) to = (await canonFn())(to);
  if (!to) throw new HttpError(404, "No player by that name.");
  if (to.toLowerCase() === my.toLowerCase()) throw new HttpError(400, "You can't chat with yourself.");
  if (b.action === "request") {
    const p = await perm(env, my, to);
    if (p.status === "ok") return json({ ok: true, status: "ok" });
    if (p.incoming) {   // they already asked me: asking back = approving
      await env.DB.prepare("UPDATE chat_perms SET status='ok', t=? WHERE from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE").bind(now, to, my).run();
      return json({ ok: true, status: "ok" });
    }
    await env.DB.prepare("INSERT INTO chat_perms (from_name, to_name, status, t) VALUES (?, ?, 'pending', ?) " +
      "ON CONFLICT(from_name, to_name) DO UPDATE SET status = CASE WHEN status='no' THEN 'no' ELSE 'pending' END, t = excluded.t").bind(my, to, now).run();
    return json({ ok: true, status: (await perm(env, my, to)).status });
  }
  await needOk(env, my, to);
  if (b.action === "unsend") return unsendMsg(env, my, b.id, "to_name = ? COLLATE NOCASE", [to]);
  if (b.action === "send") {
    const kind = b.kind === "tts" ? "tts" : "text", isImg = !!(b.image || b.imageUrl);
    let body = String(b.body ?? "").replace(/\r\n?/g, "\n").trim();
    if (!isImg && /\[img:/i.test(body)) throw new HttpError(400, "Message can't contain [img: tags.");
    if (isImg) body = await storeChatImage(env, my, b, now);
    if (!body || body.length > MAX_TXT) throw new HttpError(400, "Message must be 1-" + MAX_TXT + " characters.");
    const id = mid(now);
    await env.DB.prepare("INSERT INTO chat_msgs (id, from_name, to_name, kind, body, t) VALUES (?, ?, ?, ?, ?, ?)").bind(id, my, to, kind, body, now).run();
    return json({ ok: true, id }, 201);
  }
  if (b.action === "buzz") {
    const last = await env.DB.prepare("SELECT MAX(t) AS t FROM chat_buzz WHERE from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE").bind(my, to).first();
    if (last && last.t && now - last.t < 5000) throw new HttpError(429, "Easy - wait a few seconds before buzzing again.");
    await env.DB.prepare("INSERT INTO chat_buzz (from_name, to_name, t) VALUES (?, ?, ?)").bind(my, to, now).run();
    return json({ ok: true });
  }
  if (b.action === "audio") {
    const m = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.audio || ""));
    if (!m) throw new HttpError(415, "Bad audio.");
    if (m[2].length > Math.ceil(MAX_AUDIO * 4 / 3) + 8) throw new HttpError(413, "That recording is too long.");
    const bin = atob(m[2]), d = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
    const kind = b.kind === "live" ? "live" : "clip", id = mid(now);
    if (kind === "live") await env.DB.prepare("DELETE FROM chat_msgs WHERE kind='live' AND t < ?").bind(now - 600e3).run();
    await env.DB.prepare("INSERT INTO chat_msgs (id, from_name, to_name, kind, mime, audio, t) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, my, to, kind, m[1], d, now).run();
    return json({ ok: true, id }, 201);
  }
  throw new HttpError(400, "Unknown action");
});
