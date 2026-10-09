import { wrap, readJson, json, HttpError, normEmail, validEmail, validUsername, hashPassword, sendConfirmation } from "../../_shared/auth.js";
export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  const email = normEmail(b.email), username = String(b.username || "").trim(), password = String(b.password || "");
  if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!validUsername(username)) throw new HttpError(400, "Username must be 3-20 letters, numbers, _ . or -");
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "Password must be at least 8 characters.");
  const existing = await env.DB.prepare("SELECT id, email, username, verified_at FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    // Don't reveal whether an email is registered; re-send the link if still unverified.
    let mail = { sent: false };
    if (!existing.verified_at) mail = await sendConfirmation(env, request, existing);
    return json({ ok: true, emailSent: mail.sent, message: "Check your email for a confirmation link." });
  }
  const taken = await env.DB.prepare("SELECT 1 FROM users WHERE username = ?").bind(username).first();
  if (taken) throw new HttpError(409, "That username is taken.");
  const hash = await hashPassword(password);
  const user = await env.DB.prepare("INSERT INTO users (email, username, password_hash, verified_at, created_at) VALUES (?, ?, ?, NULL, ?) RETURNING id, email, username")
    .bind(email, username, hash, Date.now()).first();
  const mail = await sendConfirmation(env, request, user);
  return json({ ok: true, emailSent: mail.sent, reason: mail.reason, message: mail.sent ? "Check your email for a confirmation link." : "Account created, but the confirmation email could not be sent yet." }, 201);
});
