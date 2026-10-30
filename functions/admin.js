// Admin: verified accounts list. Password checked server-side against a PBKDF2 hash (never plaintext).
import { verifyPassword } from "./_shared/auth.js";
const ADMIN_HASH = "pbkdf2$100000$bmOCsF8MSR4FjjUNevHRYw==$xzzxT8thmC4dzzn9+bEl8xpk58bDpcD2KHlaiaXvWGs=";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (ms) => ms ? new Date(Number(ms)).toLocaleString("en-US", { timeZone: "America/New_York" }) + " ET" : "";
const page = (body) => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>DS Admin</title><style>body{font-family:sans-serif;background:#111;color:#eee;padding:20px}table{border-collapse:collapse}td,th{border:1px solid #444;padding:6px 10px;text-align:left}input,button{font-size:16px;padding:6px}</style></head><body><h1>Diamond Spaders Admin</h1>${body}</body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const form = (msg = "") => page(`${msg ? `<p style="color:#f66">${msg}</p>` : ""}<form method="POST"><input type="password" name="password" placeholder="Admin password" autofocus required> <button>Enter</button></form>`);

export async function onRequestGet() { return form(); }
export async function onRequestPost({ request, env }) {
  const fd = await request.formData().catch(() => null);
  const pw = fd ? String(fd.get("password") || "") : "";
  if (!pw || !(await verifyPassword(pw, ADMIN_HASH))) { await new Promise((r) => setTimeout(r, 1000)); return form("Wrong password."); }
  const { results } = await env.DB.prepare("SELECT id, username, email, verified_at, created_at FROM users WHERE verified_at IS NOT NULL ORDER BY verified_at DESC").all();
  const rows = results.map((u) => `<tr><td>${u.id}</td><td>${esc(u.username)}</td><td>${esc(u.email)}</td><td>${fmt(u.created_at)}</td><td>${fmt(u.verified_at)}</td></tr>`).join("");
  return page(`<p>${results.length} verified account(s)</p><table><tr><th>#</th><th>Username</th><th>Email</th><th>Registered</th><th>Verified</th></tr>${rows}</table>`);
}
