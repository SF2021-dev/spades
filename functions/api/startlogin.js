// Start-page owner login. GET ?page=start2|start3 -> {page, owner (name), loggedIn}
// POST {page,password} -> sets HttpOnly cookie ds_start_<page> (1 year). 5 wrong tries per 15 min per IP -> 429.
// POST {page, action:"logout"} -> clears it.
import { wrap, json, readJson, HttpError, verifyPassword } from "../_shared/auth.js";
import { pageParam, isOwner, randomToken, sha256, setCookie, dropSession, SESSION_DAYS } from "../_shared/startpages.js";
const MAX_FAILS = 5, WINDOW = 15 * 60e3;

export const onRequestGet = wrap(async ({ request, env }) => {
  const page = pageParam(new URL(request.url).searchParams.get("page"));
  if (!page) throw new HttpError(400, "Unknown page");
  const o = await env.DB.prepare("SELECT owner FROM start_owners WHERE page = ?").bind(page).first();
  return json({ page, owner: o ? o.owner : null, loggedIn: await isOwner(request, env, page) });
});

export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  const page = pageParam(b && b.page);
  if (!page) throw new HttpError(400, "Unknown page");
  if (b.action === "logout") { await dropSession(request, env, page); return json({ ok: true }, 200, { "Set-Cookie": setCookie(page, "", 0) }); }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown", now = Date.now();
  const f = await env.DB.prepare("SELECT COUNT(*) AS n FROM start_login_fails WHERE ip = ? AND t > ?").bind(ip, now - WINDOW).first();
  if (f && f.n >= MAX_FAILS) throw new HttpError(429, "Too many wrong passwords. Try again in 15 minutes.");
  const o = await env.DB.prepare("SELECT owner, pw_hash FROM start_owners WHERE page = ?").bind(page).first();
  const pw = String(b.password || "").trim().toLowerCase();
  if (!o || !pw || pw.length > 100 || !(await verifyPassword(pw, o.pw_hash))) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO start_login_fails (ip, t) VALUES (?, ?)").bind(ip, now),
      env.DB.prepare("DELETE FROM start_login_fails WHERE t < ?").bind(now - 86400e3),
    ]);
    throw new HttpError(401, "Wrong password.");
  }
  const tok = randomToken();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO start_sessions (id_hash, page, expires, created_at) VALUES (?, ?, ?, ?)").bind(await sha256(tok), page, now + SESSION_DAYS * 864e5, now),
    env.DB.prepare("DELETE FROM start_sessions WHERE expires < ?").bind(now),
  ]);
  return json({ ok: true, page, owner: o.owner }, 200, { "Set-Cookie": setCookie(page, tok, SESSION_DAYS * 86400) });
});
