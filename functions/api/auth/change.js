// POST {current, password} (logged in) -> change password.
import { wrap, readJson, json, HttpError, currentUser, verifyPassword, hashPassword } from "../../_shared/auth.js";
export const onRequestPost = wrap(async ({ request, env }) => {
  const me = await currentUser(request, env);
  if (!me) throw new HttpError(401, "Please log in first.");
  const b = await readJson(request), cur = String(b.current || ""), pw = String(b.password || "");
  if (pw.length < 8) throw new HttpError(400, "New password must be 8+ characters.");
  const u = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(me.id).first();
  if (!u || !(await verifyPassword(cur, u.password_hash))) throw new HttpError(401, "Current password is wrong.");
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(pw), me.id).run();
  return json({ ok: true, message: "Password changed." });
});
