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

export async function setPin(env, name, pin) {
  if (!name || name.length > 40) throw new HttpError(400, "Name is required.");
  if (!validPin(pin)) throw new HttpError(400, "PIN must be exactly 3 digits (000-999).");
  const r = await env.DB.prepare("INSERT OR IGNORE INTO msg_pins (name, pin_hash, created_at) VALUES (?, ?, ?)")
    .bind(name, await hashPassword(String(pin)), Date.now()).run();
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
