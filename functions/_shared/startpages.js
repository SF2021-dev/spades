// Shared helpers for start-page owners (/api/startlogin, /api/startlayout). D1 binding "DB".
export const PAGES = { start2: 1, start3: 1 };
export const SESSION_DAYS = 365;
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const cookieName = (page) => "ds_start_" + page;
export function pageParam(v) { const p = String(v || ""); return PAGES[p] ? p : null; }
export function setCookie(page, value, maxAge) {
  return `${cookieName(page)}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(request, page) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${cookieName(page)}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}
export async function isOwner(request, env, page) {
  const id = readCookie(request, page); if (!id) return false;
  const r = await env.DB.prepare("SELECT page FROM start_sessions WHERE id_hash = ? AND page = ? AND expires > ?").bind(await sha256(id), page, Date.now()).first();
  return !!r;
}
export async function dropSession(request, env, page) {
  const id = readCookie(request, page);
  if (id) await env.DB.prepare("DELETE FROM start_sessions WHERE id_hash = ?").bind(await sha256(id)).run();
}
