// POST {login} -> emails a new temporary password to the account's email (stored passwords are hashed, so the old one can't be read back).
// Always answers the same message so it doesn't reveal which names/emails exist. One email per account per 10 minutes.
import { wrap, readJson, json, normEmail, hashPassword } from "../../_shared/auth.js";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function tempPw() {
  const a = "abcdefghjkmnpqrstuvwxyz23456789", b = crypto.getRandomValues(new Uint8Array(10));
  return [...b].map((x) => a[x % a.length]).join("");
}
export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request), id = String(b.login || "").trim();
  const msg = { ok: true, message: "If that account exists, we emailed its password to the address on file. Check your inbox (and spam)." };
  if (!id) return json({ ok: false, error: "Enter your email or username." }, 400);
  const u = await env.DB.prepare("SELECT * FROM users WHERE email = ? OR username = ? COLLATE NOCASE").bind(normEmail(id), id).first();
  if (!u || !env.RESEND_API_KEY) return json(msg);
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS pw_forgot (user_id INTEGER PRIMARY KEY, at INTEGER)").run();
  const last = await env.DB.prepare("SELECT at FROM pw_forgot WHERE user_id = ?").bind(u.id).first();
  if (last && last.at > Date.now() - 10 * 60e3) return json(msg);
  const pw = tempPw();
  const from = env.EMAIL_FROM || "Diamond Spaders <noreply@mail.diamondspaders.online>";
  const login = `${new URL(request.url).origin}/register?login=1`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [u.email], subject: "Your Diamond Spaders password",
      text: `Hi ${u.username},\n\nYour Diamond Spaders password is: ${pw}\n\nLog in at ${login} with your username (${u.username}) and this password.\n\nIf you didn't ask for this, just log in with this password; nobody else received it.`,
      html: `<div style="font-family:Arial,sans-serif;background:#000;color:#f3bf56;padding:24px;border-radius:10px"><h2 style="margin:0 0 12px">Hi ${esc(u.username)}</h2><p>Your Diamond Spaders password is:</p><p style="font-size:24px;font-weight:700;color:#fff;letter-spacing:2px">${pw}</p><p>Log in at <a style="color:#f3bf56" href="${login}">${login}</a> with username <b>${esc(u.username)}</b> and this password.</p></div>` }),
  });
  if (!r.ok) { console.error("forgot: resend", r.status, await r.text()); return json(msg); }
  // Only change the password once the email actually went out; mark email verified since they proved inbox access by using it.
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, verified_at = COALESCE(verified_at, ?) WHERE id = ?").bind(await hashPassword(pw), Date.now(), u.id),
    env.DB.prepare("INSERT OR REPLACE INTO pw_forgot (user_id, at) VALUES (?, ?)").bind(u.id, Date.now()),
  ]);
  return json(msg);
});
