// Message-box PINs: one 3-digit PIN per name (case-insensitive), stored as a salted PBKDF2 hash in D1 table msg_pins.
// Only 1000 PINs exist, so wrong guesses are rate limited: MAX_FAILS wrong in a row locks that name for LOCK_MIN minutes.
// Reset a forgotten PIN: wr d1 execute diamondspaders-auth --remote --command "DELETE FROM msg_pins WHERE name='Name' COLLATE NOCASE"
import { hashPassword, verifyPassword, HttpError } from "./auth.js";

const MAX_FAILS = 5, LOCK_MIN = 15;
export const normName = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
export const validPin = (p) => /^\d{3}$/.test(String(p ?? ""));

export async function pinRow(env, name) {
  return env.DB.prepare("SELECT name, pin_hash, fails, locked_until FROM msg_pins WHERE name = ? COLLATE NOCASE").bind(name).first();
}

// Email: required when a PIN is created (anti-fake-name speed bump). Stored only as SHA-256 of the lowercased, trimmed email.
export const MAX_EMAIL = 254;
export function checkEmail(e) {
  const n = String(e ?? "").trim().toLowerCase();
  if (n.length > MAX_EMAIL) throw new HttpError(400, "That email address is too long.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(n)) throw new HttpError(400, "Please enter a valid email address (like name@example.com).");
  return n;
}
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
  .map((b) => b.toString(16).padStart(2, "0")).join("");

export async function setPin(env, name, pin, email) {
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  if (!validPin(pin)) throw new HttpError(400, "PIN must be exactly 3 digits (000-999).");
  const emailHash = await sha256hex("ds-email:" + checkEmail(email));
  const r = await env.DB.prepare("INSERT OR IGNORE INTO msg_pins (name, pin_hash, email_hash, created_at) VALUES (?, ?, ?, ?)")
    .bind(name, await hashPassword(String(pin)), emailHash, Date.now()).run();
  if (!r.meta || !r.meta.changes) throw new HttpError(409, "That name already has a PIN. Enter it instead.");
}

// Throws unless pin matches the stored PIN for name.
export async function checkPin(env, name, pin) {
  const row = await pinRow(env, name);
  if (!row) throw new HttpError(428, "Create a 3-digit PIN for this name first.");
  const now = Date.now();
  if (row.locked_until > now) {
    const m = Math.ceil((row.locked_until - now) / 60000);
    throw new HttpError(429, `Too many wrong PINs. Try again in ${m} minute${m === 1 ? "" : "s"}.`);
  }
  if (validPin(pin) && await verifyPassword(String(pin), row.pin_hash)) {
    if (row.fails) await env.DB.prepare("UPDATE msg_pins SET fails = 0, locked_until = 0 WHERE name = ?").bind(row.name).run();
    return row.name;
  }
  const fails = row.fails + 1, lock = fails >= MAX_FAILS;
  await env.DB.prepare("UPDATE msg_pins SET fails = ?, locked_until = ? WHERE name = ?")
    .bind(lock ? 0 : fails, lock ? now + LOCK_MIN * 60000 : 0, row.name).run();
  throw new HttpError(lock ? 429 : 401, lock ? `Too many wrong PINs. Try again in ${LOCK_MIN} minutes.` : "Wrong PIN. Please try again.");
}

// ---- "remember me": 30-day HttpOnly cookie holding a random token; D1 keeps only its SHA-256 (table msg_pin_tokens) ----
export const REMEMBER_DAYS = 30, TOKEN_COOKIE = "ds_pin_token";
const tokenHash = (t) => sha256hex("ds-pin-token:" + t);
function cookieVal(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
const cookieAttrs = (request) => "; Path=/; HttpOnly; SameSite=Strict" + (new URL(request.url).protocol === "https:" ? "; Secure" : "");

// Issue a token for name; returns {cookie, expires}.
export async function issueToken(env, request, name) {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now(), expires = now + REMEMBER_DAYS * 86400000;
  await env.DB.prepare("DELETE FROM msg_pin_tokens WHERE expires < ?").bind(now).run();
  await env.DB.prepare("INSERT INTO msg_pin_tokens (token_hash, name, expires, created_at) VALUES (?, ?, ?, ?)")
    .bind(await tokenHash(token), name, expires, now).run();
  return { cookie: `${TOKEN_COOKIE}=${token}; Max-Age=${REMEMBER_DAYS * 86400}` + cookieAttrs(request), expires };
}
// Canonical name the request's remember-me cookie is valid for (unexpired, PIN still exists), or "".
export async function tokenName(env, request) {
  const t = cookieVal(request, TOKEN_COOKIE);
  if (!/^[0-9a-f]{64}$/.test(t)) return "";
  const row = await env.DB.prepare(
    "SELECT p.name AS name FROM msg_pin_tokens t JOIN msg_pins p ON p.name = t.name COLLATE NOCASE WHERE t.token_hash = ? AND t.expires > ?"
  ).bind(await tokenHash(t), Date.now()).first();
  return row ? row.name : "";
}
export async function forgetToken(env, request) {
  const t = cookieVal(request, TOKEN_COOKIE);
  if (/^[0-9a-f]{64}$/.test(t)) await env.DB.prepare("DELETE FROM msg_pin_tokens WHERE token_hash = ?").bind(await tokenHash(t)).run();
  return `${TOKEN_COOKIE}=; Max-Age=0` + cookieAttrs(request);
}
