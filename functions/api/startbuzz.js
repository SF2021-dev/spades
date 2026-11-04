// Start-page buzz: /start buzzes Judy, /start2 buzzes Dennis. Stored in D1, polled by the target's start page.
const OK = ["judy", "dennis", "christine"];
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
async function init(db) { await db.prepare("CREATE TABLE IF NOT EXISTS start_buzz (target TEXT PRIMARY KEY, ts INTEGER)").run(); try { await db.prepare("ALTER TABLE start_buzz ADD COLUMN sender TEXT").run(); } catch (e) {} }
export async function onRequestGet({ request, env }) {
  const t = (new URL(request.url).searchParams.get("for") || "").toLowerCase();
  if (!OK.includes(t)) return J({ error: "bad target" }, 400);
  await init(env.DB);
  const r = await env.DB.prepare("SELECT ts, sender FROM start_buzz WHERE target=?").bind(t).first();
  return J({ ts: r ? r.ts : 0, from: (r && r.sender) || "", now: Date.now() });
}
export async function onRequestPost({ request, env }) {
  let b = {}; try { b = await request.json(); } catch (e) {}
  const t = String(b.to || "").toLowerCase();
  const f = String(b.from || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 20);
  if (!OK.includes(t)) return J({ error: "bad target" }, 400);
  await init(env.DB);
  const now = Date.now();
  const r = await env.DB.prepare("SELECT ts FROM start_buzz WHERE target=?").bind(t).first();
  if (r && now - r.ts < 3000) return J({ error: "wait" }, 429);
  await env.DB.prepare("INSERT INTO start_buzz(target,ts,sender) VALUES(?,?,?) ON CONFLICT(target) DO UPDATE SET ts=excluded.ts, sender=excluded.sender").bind(t, now, f).run();
  return J({ ok: true, ts: now });
}
