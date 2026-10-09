// Shared helpers for /api/auth/* (Cloudflare Pages Functions + D1 binding "DB").
// Secrets/vars: RESEND_API_KEY (secret, needed to send confirmation email), EMAIL_FROM (optional).
export const COOKIE = "ds_session";
const SESSION_DAYS = 30, TOKEN_HOURS = 24, PBKDF2_ITER = 100000;
const enc = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const randomToken = (n = 32) => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(await pbkdf2(password, salt, PBKDF2_ITER))}`;
}
export async function verifyPassword(password, stored) {
  const [alg, iter, salt, want] = String(stored || "").split("$");
  if (alg !== "pbkdf2") return false;
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), Number(iter)));
  const exp = unb64(want);
  if (got.length !== exp.length) return false;
  let d = 0; for (let i = 0; i < got.length; i++) d |= got[i] ^ exp[i];
  return d === 0;
}

// POSTs must be JSON from our own origin (blocks cross-site form posts).
export async function readJson(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Bad origin");
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) throw new HttpError(415, "Send JSON");
  try { return await request.json(); } catch { throw new HttpError(400, "Bad JSON"); }
}
export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export function wrap(fn) {
  return async (ctx) => {
    try {
      if (!ctx.env.DB) return json({ error: "Database not bound" }, 500);
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "Server error" }, 500);
    }
  };
}

export const normEmail = (s) => String(s || "").trim().toLowerCase();
export const validEmail = (s) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const validUsername = (s) => /^[A-Za-z0-9_.-]{3,20}$/.test(s);

export function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export async function createSession(env, userId) {
  const id = randomToken(32), now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256(id), userId, now + SESSION_DAYS * 864e5, now).run();
  return cookie(id, SESSION_DAYS * 86400);
}
function readCookie(request) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}
export async function currentUser(request, env) {
  const id = readCookie(request);
  if (!id) return null;
  return env.DB.prepare(
    "SELECT u.id, u.email, u.username, u.verified_at, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?"
  ).bind(await sha256(id), Date.now()).first();
}
export async function destroySession(request, env) {
  const id = readCookie(request);
  if (id) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(id)).run();
}

// Create a fresh confirmation token and email it. Returns {sent, reason?}.
export async function sendConfirmation(env, request, user) {
  const recent = await env.DB.prepare("SELECT expires_at FROM email_tokens WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1")
    .bind(user.id).first();
  if (recent && recent.expires_at - TOKEN_HOURS * 36e5 > Date.now() - 60e3) return { sent: false, reason: "wait" };
  const token = randomToken(32);
  await env.DB.prepare("INSERT INTO email_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)")
    .bind(await sha256(token), user.id, Date.now() + TOKEN_HOURS * 36e5).run();
  const link = `${new URL(request.url).origin}/api/auth/confirm?token=${token}`;
  if (!env.RESEND_API_KEY) { console.warn("RESEND_API_KEY not set; confirmation email not sent for user", user.id); return { sent: false, reason: "no_provider" }; }
  const from = env.EMAIL_FROM || "Diamond Spaders <noreply@diamondspaders.online>";
  const html = `<div style="font-family:'Comic Sans MS','Comic Sans',cursive;background:#000;color:#f3bf56;padding:24px;border-radius:10px">
<h2 style="margin:0 0 12px">Welcome to Diamond Spaders, ${esc(user.username)}!</h2>
<p>Click below to confirm your email address:</p>
<p><a href="${link}" style="display:inline-block;background:#f3bf56;color:#000;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700">Confirm my email</a></p>
<p style="font-size:13px">Or paste this link into your browser:<br><span style="color:#fff">${link}</span></p>
<p style="font-size:13px">This link expires in ${TOKEN_HOURS} hours. If you didn't sign up, ignore this email.</p></div>`;
  const text = `Welcome to Diamond Spaders, ${user.username}!\n\nConfirm your email: ${link}\n\nThis link expires in ${TOKEN_HOURS} hours. If you didn't sign up, ignore this email.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [user.email], subject: "Confirm your Diamond Spaders account", html, text }),
  });
  if (!r.ok) { console.error("Resend error", r.status, await r.text()); return { sent: false, reason: "provider_error" }; }
  return { sent: true };
}
export async function consumeToken(env, token) {
  if (!/^[a-f0-9]{64}$/.test(token || "")) return null;
  const h = await sha256(token);
  const row = await env.DB.prepare("SELECT user_id, expires_at, used FROM email_tokens WHERE token = ?").bind(h).first();
  if (!row || row.used || row.expires_at < Date.now()) return null;
  await env.DB.batch([
    env.DB.prepare("UPDATE email_tokens SET used = 1 WHERE token = ?").bind(h),
    env.DB.prepare("UPDATE users SET verified_at = COALESCE(verified_at, ?) WHERE id = ?").bind(Date.now(), row.user_id),
  ]);
  return row.user_id;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const publicUser = (u) => u && { id: u.id, email: u.email, username: u.username, verified: !!u.verified_at };
