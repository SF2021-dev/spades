// Private-chat shared audio: WebRTC between the two people of one DM only. Room = sorted lowercase pair "a|b".
// GET ?with=X -> {me, room, peers, signals}; POST {with, action:"join"|"leave"|"signal", ...}
import { wrap, json, readJson, HttpError, currentUser } from "../_shared/auth.js";
import { tokenName } from "../_shared/pins.js";
import { known } from "../_shared/chatnames.js";
async function me(env, request) { let n = "";
  { try { const u = await currentUser(request, env); if (u && u.username) n = (await known(env, u.username)) || u.username; } catch {} }
  if (!n) n = await tokenName(env, request);
  if (!n) throw new HttpError(401, "Please log in."); return n; }
async function roomFor(env, my, w) { w = String(w || "").trim();
  if (!w || w.toLowerCase() === my.toLowerCase()) throw new HttpError(400, "No chat partner.");
  const r = await env.DB.prepare("SELECT 1 FROM chat_perms WHERE status='ok' AND ((from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE) OR (from_name = ? COLLATE NOCASE AND to_name = ? COLLATE NOCASE)) LIMIT 1").bind(my, w, w, my).first();
  if (!r) throw new HttpError(403, "You and " + w + " aren't approved to chat yet.");
  return [my.toLowerCase(), w.toLowerCase()].sort().join("|"); }
let ready = false;
async function init(env) { if (ready) return; ready = true;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS dm_voice_peers (room TEXT, name TEXT COLLATE NOCASE, listen INTEGER, t INTEGER, PRIMARY KEY (room, name))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS dm_voice_sig (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, from_name TEXT, to_name TEXT COLLATE NOCASE, type TEXT, data TEXT, t INTEGER)")]); }
export const onRequestGet = wrap(async ({ request, env }) => {
  const my = await me(env, request); await init(env); const room = await roomFor(env, my, new URL(request.url).searchParams.get("with")); const now = Date.now();
  await env.DB.prepare("UPDATE dm_voice_peers SET t = ? WHERE room = ? AND name = ?").bind(now, room, my).run();
  await env.DB.batch([env.DB.prepare("DELETE FROM dm_voice_peers WHERE t < ?").bind(now - 15000), env.DB.prepare("DELETE FROM dm_voice_sig WHERE t < ?").bind(now - 60000)]);
  const peers = (await env.DB.prepare("SELECT name, listen FROM dm_voice_peers WHERE room = ? ORDER BY name").bind(room).all()).results || [];
  const sig = (await env.DB.prepare("SELECT id, from_name AS \"from\", type, data FROM dm_voice_sig WHERE room = ? AND to_name = ? ORDER BY id").bind(room, my).all()).results || [];
  if (sig.length) await env.DB.prepare("DELETE FROM dm_voice_sig WHERE room = ? AND to_name = ? AND id <= ?").bind(room, my, sig[sig.length - 1].id).run();
  return json({ me: my, room, peers: peers.map((p) => ({ name: p.name, listen: !!p.listen })), signals: sig });
});
export const onRequestPost = wrap(async ({ request, env }) => {
  const my = await me(env, request); await init(env); const b = await readJson(request); const room = await roomFor(env, my, b.with); const now = Date.now();
  if (b.action === "join") { await env.DB.prepare("INSERT OR REPLACE INTO dm_voice_peers (room, name, listen, t) VALUES (?, ?, ?, ?)").bind(room, my, b.listen ? 1 : 0, now).run(); return json({ ok: true, me: my, room }); }
  if (b.action === "leave") { await env.DB.prepare("DELETE FROM dm_voice_peers WHERE room = ? AND name = ?").bind(room, my).run(); return json({ ok: true }); }
  if (b.action === "signal") { const to = String(b.to || ""); if (!room.split("|").includes(to.toLowerCase())) throw new HttpError(403, "not in this chat");
    const d = String(b.data || ""); if (d.length > 20000) throw new HttpError(413, "too big");
    await env.DB.prepare("INSERT INTO dm_voice_sig (room, from_name, to_name, type, data, t) VALUES (?, ?, ?, ?, ?, ?)").bind(room, my, to, String(b.type || ""), d, now).run(); return json({ ok: true }); }
  throw new HttpError(400, "bad action");
});
