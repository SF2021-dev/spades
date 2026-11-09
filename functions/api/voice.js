// Diamond Spaders lobby audio feed: WebRTC mesh signaling via D1 polling.
// GET ?since=T -> {me, peers:[{name,listen}], signals:[{id,from,type,data}]}
// POST {action:"join", listen} | {action:"leave"} | {action:"signal", to, type, data}
import { wrap, json, readJson, HttpError, currentUser } from "../_shared/auth.js";
import { tokenName } from "../_shared/pins.js";
import { known } from "../_shared/chatnames.js";
async function me(env, request) { let n = "";
  { try { const u = await currentUser(request, env); if (u && u.username) n = (await known(env, u.username)) || u.username; } catch {} }
  if (!n) n = await tokenName(env, request);
  if (!n) throw new HttpError(401, "Please log in."); return n; }
let ready = false;
async function init(env) { if (ready) return; ready = true;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS voice_peers (name TEXT PRIMARY KEY COLLATE NOCASE, listen INTEGER, t INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS voice_sig (id INTEGER PRIMARY KEY AUTOINCREMENT, from_name TEXT, to_name TEXT COLLATE NOCASE, type TEXT, data TEXT, t INTEGER)")]); }
export const onRequestGet = wrap(async ({ request, env }) => {
  const my = await me(env, request); await init(env); const now = Date.now();
  await env.DB.prepare("UPDATE voice_peers SET t = ? WHERE name = ?").bind(now, my).run();
  await env.DB.batch([env.DB.prepare("DELETE FROM voice_peers WHERE t < ?").bind(now - 15000), env.DB.prepare("DELETE FROM voice_sig WHERE t < ?").bind(now - 60000)]);
  const peers = (await env.DB.prepare("SELECT name, listen FROM voice_peers ORDER BY name").all()).results || [];
  const sig = (await env.DB.prepare("SELECT id, from_name AS \"from\", type, data FROM voice_sig WHERE to_name = ? ORDER BY id").bind(my).all()).results || [];
  if (sig.length) await env.DB.prepare("DELETE FROM voice_sig WHERE to_name = ? AND id <= ?").bind(my, sig[sig.length - 1].id).run();
  return json({ me: my, peers: peers.map((p) => ({ name: p.name, listen: !!p.listen })), signals: sig });
});
export const onRequestPost = wrap(async ({ request, env }) => {
  const my = await me(env, request); await init(env); const b = await readJson(request); const now = Date.now();
  if (b.action === "join") { await env.DB.prepare("INSERT OR REPLACE INTO voice_peers (name, listen, t) VALUES (?, ?, ?)").bind(my, b.listen ? 1 : 0, now).run(); return json({ ok: true, me: my }); }
  if (b.action === "leave") { await env.DB.prepare("DELETE FROM voice_peers WHERE name = ?").bind(my).run(); return json({ ok: true }); }
  if (b.action === "signal") { const d = String(b.data || ""); if (d.length > 20000) throw new HttpError(413, "too big");
    await env.DB.prepare("INSERT INTO voice_sig (from_name, to_name, type, data, t) VALUES (?, ?, ?, ?, ?)").bind(my, String(b.to || ""), String(b.type || ""), d, now).run(); return json({ ok: true }); }
  throw new HttpError(400, "bad action");
});
