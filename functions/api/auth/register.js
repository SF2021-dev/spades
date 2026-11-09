import { wrap, readJson, json, HttpError, normEmail, validEmail, validUsername, hashPassword, sendConfirmation, createSession, publicUser } from "../../_shared/auth.js";
export const onRequestPost = wrap(async ({ request, env }) => {
  const b = await readJson(request);
  const email = normEmail(b.email), password = String(b.password || "");
  let username = String(b.username || "").trim().replace(/\s+/g, " ");
  if (!validEmail(email)) throw new HttpError(400, "Enter a valid email address.");
  if (!validUsername(username)) throw new HttpError(400, "Username must be 3-24 letters, numbers, spaces, _ . or -");
  if (password.length < 8 || password.length > 200) throw new HttpError(400, "Password must be at least 8 characters.");
  const member = await findMember(username);
  if (member === null) throw new HttpError(503, "Couldn't reach the Diamond Spaders standings to check your id. Please try again in a minute.");
  if (!member) throw new HttpError(403, "\"" + username + "\" wasn't found on the Diamond Spaders standings (pages 1-4). Please use the exact id you registered with Diamond Spaders and try again.");
  username = member;
  const existing = await env.DB.prepare("SELECT id, email, username, verified_at FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    // Don't reveal whether an email is registered; re-send the link if still unverified.
    let mail = { sent: false };
    if (!existing.verified_at) mail = await sendConfirmation(env, request, existing);
    return json({ ok: true, emailSent: mail.sent, message: "Check your email for a confirmation link." });
  }
  const taken = await env.DB.prepare("SELECT 1 FROM users WHERE username = ? COLLATE NOCASE").bind(username).first();
  if (taken) throw new HttpError(409, "That username is taken.");
  const hash = await hashPassword(password);
  const user = await env.DB.prepare("INSERT INTO users (email, username, password_hash, verified_at, created_at) VALUES (?, ?, ?, NULL, ?) RETURNING id, email, username")
    .bind(email, username, hash, Date.now()).first();
  const mail = await sendConfirmation(env, request, user);
  // No email provider configured yet: log the new account straight in so the site gate doesn't lock people out.
  // Provider refused (e.g. sender domain not verified in Resend yet, or onboarding sender restricted to the owner's inbox):
  // don't strand the user - mark verified and log them in.
  if (!mail.sent && mail.reason === "provider_error")
    await env.DB.prepare("UPDATE users SET verified_at = ? WHERE id = ?").bind(Date.now(), user.id).run();
  if (!mail.sent && (mail.reason === "no_provider" || mail.reason === "provider_error"))
    return json({ ok: true, loggedIn: true, user: publicUser(user) }, 201, { "Set-Cookie": await createSession(env, user.id, b.remember !== false) });
  return json({ ok: true, emailSent: mail.sent, reason: mail.reason, message: mail.sent ? "Check your email for a confirmation link." : "Account created, but the confirmation email could not be sent yet." }, 201);
});

// Returns canonical member name, false if not found, null if standings unreachable.
async function findMember(name) {
  const want = name.toLowerCase(); let ok = 0;
  const pages = await Promise.all([1,2,3,4].map(async (p) => {
    try {
      const r = await fetch("https://www.myleague.com/diamondspaders/standings" + (p > 1 ? "?p=" + p : ""), { headers: { "User-Agent": "Mozilla/5.0 DiamondSpadersOnline" }, cf: { cacheTtl: 600, cacheEverything: true } });
      if (!r.ok) return ""; ok++; return await r.text();
    } catch (e) { return ""; }
  }));
  if (!ok) return null;
  for (const html of pages)
    for (const m of html.matchAll(/\/diamondspaders\/profile\/([^"'?#\/]+)/g)) {
      const n = decodeURIComponent(m[1]);
      if (n.toLowerCase() === want) return n;
    }
  return false;
}
