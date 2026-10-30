// Group chat for /group-chat. Members are message-board names (remember-me PIN cookie). Owner is auto-approved;
// each invited name gets a join prompt on next login (/group-chat, or the main-page banner via chatnotify.js).
// GET ?action=check&names=a,b,c -> {found:[canon], missing:[]}
// GET ?action=mine -> {groups:[{gid, owner, members:[{name,status}], myStatus}]}
// GET ?action=pending -> {invites:[{gid, owner, members}]}
// GET ?action=list&gid=G&since=T -> {members, messages}   (approved members only)
// POST {action:"create", names:[...]} -> {gid}
// POST {action:"answer", gid, ok}
// POST {action:"send", gid, kind:text|tts, body} / {action:"audio", gid, kind:clip|live, audio}
import { storeChatImage, deleteImage } from "../_shared/msgimg.js";
import { wrap, json, readJson, HttpError, currentUser } from "../_shared/auth.js";
import { normName, tokenName } from "../_shared/pins.js";
import { canonFn } from "../_shared/standings.js";
import { known } from "../_shared/chatnames.js";
const MAX_AUDIO = 1024 * 1024, MAX_TXT = 1000, MAX_MEMBERS = 12;
async function me(env, request) { let n = await tokenName(env, request);
  if (!n) { try { const u = await currentUser(request, env); if (u && u.username) n = (await known(env, u.username)) || u.username; } catch {} } if (!n) throw new HttpError(401, "Please log in to chat."); return n; }
async function members(env, gid) { return (await env.DB.prepare("SELECT name, status FROM chat_group_members WHERE gid = ? ORDER BY t").bind(gid).all()).results || []; }
let migrated = false;
async function migrate(env) { if (migrated) return; migrated = true; for (const c of ["title TEXT", "inv INTEGER", "pw TEXT"]) { try { await env.DB.prepare("ALTER TABLE chat_groups ADD COLUMN " + c).run(); } catch {} } }
async function hashPw(gid, pw) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dsgc:" + gid + ":" + pw)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function access(env, gid, my) {
  const g = await env.DB.prepare("SELECT gid, owner, title, inv, pw FROM chat_groups WHERE gid = ?").bind(String(gid)).first();
  if (!g) throw new HttpError(404, "That group chat was deleted or doesn't exist.");
  const r = await env.DB.prepare("SELECT status FROM chat_group_members WHERE gid = ? AND name = ? COLLATE NOCASE").bind(String(gid), my).first();
  const st = r && r.status === "ok" ? "member" : (r && r.status === "pending") ? "invited" : g.inv ? "denied" : "open";
  return { g, st };
}
// Rooms may be invitation-only and/or password-protected. Non-members must POST {action:"join", gid, password}.
async function needMember(env, gid, my) {
  const { g, st } = await access(env, gid, my);
  if (st === "member") return;
  if (st === "denied") throw new HttpError(403, "This group chat is invitation only.");
  if (g.pw) throw new HttpError(403, "This group chat needs a password.");
  await join(env, gid, my);
}
async function join(env, gid, my) {
  await env.DB.prepare("INSERT OR IGNORE INTO chat_group_members (gid, name, status, t) VALUES (?, ?, 'ok', ?)").bind(String(gid), my, Date.now()).run();
  await env.DB.prepare("UPDATE chat_group_members SET status='ok' WHERE gid = ? AND name = ? COLLATE NOCASE").bind(String(gid), my).run();
}
async function check(env, names) {
  const found = [], missing = [];
  for (const raw of names) { const n = normName(raw); if (!n) continue; const k = n.length <= 40 && await known(env, n); (k ? found : missing).push(k || n); }
  return { found: [...new Map(found.map((n) => [n.toLowerCase(), n])).values()], missing };
}
const mid = (now) => now.toString(36) + "-" + crypto.randomUUID().slice(0, 8);

export const onRequestGet = wrap(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, a = q.get("action");
  if (a === "check") return json(await check(env, String(q.get("names") || "").split(",").slice(0, MAX_MEMBERS)));
  const my = await me(env, request); await migrate(env);
  if (a === "rooms") {
    const rows = (await env.DB.prepare("SELECT g.gid, g.owner, g.title, g.t, g.inv, (g.pw IS NOT NULL AND g.pw != '') AS haspw, (SELECT status FROM chat_group_members WHERE gid = g.gid AND name = ?1 COLLATE NOCASE) AS mst, (SELECT MAX(t) FROM chat_msgs WHERE to_name = 'g:' || g.gid) AS last, (SELECT COUNT(*) FROM chat_group_members WHERE gid = g.gid AND status = 'ok') AS n FROM chat_groups g ORDER BY COALESCE(last, g.t) DESC LIMIT 100").bind(my).all()).results || [];
    return json({ me: my, rooms: rows.filter((r) => !r.inv || (r.mst && r.mst !== "no")).map((r) => ({ inviteOnly: !!r.inv, hasPassword: !!r.haspw, invited: r.mst === "pending", gid: r.gid, owner: r.owner, title: r.title || ("Group chat by " + r.owner), t: r.t, last: r.last, count: r.n })) });
  }
  if (a === "info") {
    const { g, st } = await access(env, String(q.get("gid") || ""), my);
    return json({ gid: g.gid, owner: g.owner, status: st, inviteOnly: !!g.inv, hasPassword: !!g.pw, title: g.title || ("Group chat by " + g.owner), isOwner: g.owner.toLowerCase() === my.toLowerCase() });
  }
  if (a === "me") return json({ name: (await canonFn())(my) });
  if (a === "mine" || a === "pending") {
    const rows = (await env.DB.prepare("SELECT g.gid, g.owner, m.status FROM chat_group_members m JOIN chat_groups g ON g.gid = m.gid WHERE m.name = ? COLLATE NOCASE AND m.status " + (a === "pending" ? "= 'pending'" : "!= 'no'") + " ORDER BY g.t DESC LIMIT 50").bind(my).all()).results || [];
    const out = []; for (const r of rows) out.push({ gid: r.gid, owner: r.owner, myStatus: r.status, members: await members(env, r.gid) });
    return json(a === "pending" ? { invites: out } : { groups: out });
  }
  if (a === "list") {
    const gid = String(q.get("gid") || ""); await needMember(env, gid, my);
    const since = Number(q.get("since")) || 0;
    const r = await env.DB.prepare("SELECT id, from_name AS \"from\", kind, body, t FROM chat_msgs WHERE to_name = ? AND t > ? ORDER BY t DESC LIMIT 100").bind("g:" + gid, since).all();
    const C = await canonFn(), mem = await members(env, gid);
    return json({ members: Array.isArray(mem) ? mem.map((x) => typeof x === "string" ? C(x) : (x && x.name ? { ...x, name: C(x.name) } : x)) : mem,
      messages: (r.results || []).reverse().map((x) => (x.from ? { ...x, from: C(x.from) } : x.name ? { ...x, name: C(x.name) } : x)) });
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
  const my = await me(env, request), b = await readJson(request) || {}, now = Date.now(); await migrate(env);
  if (b.action === "room") {
    const title = String(b.title || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!title) throw new HttpError(400, "Give the group chat a title.");
    const inv = !!b.inviteOnly, pwRaw = String(b.password || "");
    if (pwRaw.length > 60) throw new HttpError(400, "Password is too long.");
    let others = [];
    if (inv) {
      const { found, missing } = await check(env, (Array.isArray(b.names) ? b.names : []).slice(0, MAX_MEMBERS));
      if (missing.length) throw new HttpError(404, "Not found: " + missing.join(", "));
      others = found.filter((n) => n.toLowerCase() !== my.toLowerCase());
      if (!others.length) throw new HttpError(400, "Invite at least one other player.");
    }
    const gid = crypto.randomUUID().replace(/-/g, "").slice(0, 16), pw = pwRaw ? await hashPw(gid, pwRaw) : null;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO chat_groups (gid, owner, t, title, inv, pw) VALUES (?, ?, ?, ?, ?, ?)").bind(gid, my, now, title, inv ? 1 : 0, pw),
      env.DB.prepare("INSERT INTO chat_group_members (gid, name, status, t) VALUES (?, ?, 'ok', ?)").bind(gid, my, now),
      ...others.map((n, i) => env.DB.prepare("INSERT OR IGNORE INTO chat_group_members (gid, name, status, t) VALUES (?, ?, 'pending', ?)").bind(gid, n, now + 1 + i)),
    ]);
    return json({ ok: true, gid }, 201);
  }
  if (b.action === "join") {
    const gid = String(b.gid || ""), { g, st } = await access(env, gid, my);
    if (st === "member") return json({ ok: true });
    if (st === "denied") throw new HttpError(403, "This group chat is invitation only.");
    if (g.pw && (await hashPw(gid, String(b.password || ""))) !== g.pw) throw new HttpError(403, "Wrong password.");
    await join(env, gid, my); return json({ ok: true });
  }
  if (b.action === "delete") {
    const gid = String(b.gid || "");
    const g = await env.DB.prepare("SELECT owner FROM chat_groups WHERE gid = ?").bind(gid).first();
    if (!g) throw new HttpError(404, "Already deleted.");
    if (g.owner.toLowerCase() !== my.toLowerCase()) throw new HttpError(403, "Only the creator can delete this group chat.");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM chat_msgs WHERE to_name = ?").bind("g:" + gid),
      env.DB.prepare("DELETE FROM chat_group_members WHERE gid = ?").bind(gid),
      env.DB.prepare("DELETE FROM chat_groups WHERE gid = ?").bind(gid),
    ]);
    return json({ ok: true });
  }
  if (b.action === "create") {
    const { found, missing } = await check(env, (Array.isArray(b.names) ? b.names : []).slice(0, MAX_MEMBERS));
    if (missing.length) throw new HttpError(404, "Not found: " + missing.join(", "));
    const others = found.filter((n) => n.toLowerCase() !== my.toLowerCase());
    if (!others.length) throw new HttpError(400, "Add at least one other player.");
    const gid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO chat_groups (gid, owner, t) VALUES (?, ?, ?)").bind(gid, my, now),
      env.DB.prepare("INSERT INTO chat_group_members (gid, name, status, t) VALUES (?, ?, 'ok', ?)").bind(gid, my, now),
      ...others.map((n, i) => env.DB.prepare("INSERT OR IGNORE INTO chat_group_members (gid, name, status, t) VALUES (?, ?, 'pending', ?)").bind(gid, n, now + 1 + i)),
    ]);
    return json({ ok: true, gid }, 201);
  }
  const gid = String(b.gid || "");
  if (b.action === "answer") {
    await env.DB.prepare("UPDATE chat_group_members SET status = ? WHERE gid = ? AND name = ? COLLATE NOCASE AND status = 'pending'").bind(b.ok ? "ok" : "no", gid, my).run();
    return json({ ok: true });
  }
  await needMember(env, gid, my);
  if (b.action === "invite") {
    const { found, missing } = await check(env, (Array.isArray(b.names) ? b.names : []).slice(0, MAX_MEMBERS));
    if (missing.length) throw new HttpError(404, "Not found: " + missing.join(", "));
    const t0 = Date.now(); for (const [i, n] of found.entries()) { if (n.toLowerCase() === my.toLowerCase()) continue;
      await env.DB.prepare("INSERT OR IGNORE INTO chat_group_members (gid, name, status, t) VALUES (?, ?, 'pending', ?)").bind(gid, n, t0 + i).run();
      await env.DB.prepare("UPDATE chat_group_members SET status='pending' WHERE gid = ? AND name = ? COLLATE NOCASE AND status = 'no'").bind(gid, n).run(); }
    return json({ ok: true });
  }
  if (b.action === "kick") {
    const g = await env.DB.prepare("SELECT owner FROM chat_groups WHERE gid = ?").bind(gid).first();
    if (!g || g.owner.toLowerCase() !== my.toLowerCase()) throw new HttpError(403, "Only the creator can remove members.");
    const n = normName(String(b.name || "")); if (!n || n.toLowerCase() === my.toLowerCase()) throw new HttpError(400, "Can't remove that member.");
    await env.DB.prepare("DELETE FROM chat_group_members WHERE gid = ? AND name = ? COLLATE NOCASE").bind(gid, n).run();
    return json({ ok: true });
  }
  if (b.action === "unsend") return unsendMsg(env, my, b.id, "to_name = ?", ["g:" + gid]);
  if (b.action === "send") {
    const kind = b.kind === "tts" ? "tts" : "text", isImg = !!(b.image || b.imageUrl);
    let body = String(b.body ?? "").replace(/\r\n?/g, "\n").trim();
    if (!isImg && /\[img:/i.test(body)) throw new HttpError(400, "Message can't contain [img: tags.");
    if (isImg) body = await storeChatImage(env, my, b, now);
    if (!body || body.length > MAX_TXT) throw new HttpError(400, "Message must be 1-" + MAX_TXT + " characters.");
    await env.DB.prepare("INSERT INTO chat_msgs (id, from_name, to_name, kind, body, t) VALUES (?, ?, ?, ?, ?, ?)").bind(mid(now), my, "g:" + gid, kind, body, now).run();
    return json({ ok: true }, 201);
  }
  if (b.action === "audio") {
    const m = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.audio || ""));
    if (!m) throw new HttpError(415, "Bad audio.");
    if (m[2].length > Math.ceil(MAX_AUDIO * 4 / 3) + 8) throw new HttpError(413, "That recording is too long.");
    const bin = atob(m[2]), d = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) d[i] = bin.charCodeAt(i);
    const kind = b.kind === "live" ? "live" : "clip";
    if (kind === "live") await env.DB.prepare("DELETE FROM chat_msgs WHERE kind='live' AND t < ?").bind(now - 600e3).run();
    await env.DB.prepare("INSERT INTO chat_msgs (id, from_name, to_name, kind, mime, audio, t) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(mid(now), my, "g:" + gid, kind, m[1], d, now).run();
    return json({ ok: true }, 201);
  }
  throw new HttpError(400, "Unknown action");
});
