import { wrap, readJson, json, HttpError, normEmail, verifyPassword, createSession, publicUser } from "../../_shared/auth.js";
export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  const id = String(b.login || b.email || b.username || "").trim(), password = String(b.password || "");
  if (!id || !password) throw new HttpError(400, "Enter your email (or username) and password.");
  const u = await env.DB.prepare("SELECT * FROM users WHERE email = ? OR username = ?").bind(normEmail(id), id).first();
  if (!u || !(await verifyPassword(password, u.password_hash))) throw new HttpError(401, "Wrong email/username or password.");
  if (!u.verified_at) return json({ error: "Please confirm your email first. Check your inbox for the link.", unverified: true }, 403);
  return json({ ok: true, user: publicUser(u) }, 200, { "Set-Cookie": await createSession(env, u.id) });
});
