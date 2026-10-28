// Is this a known Diamond Spaders player? (board PIN, board poster, or has an avatar) -> canonical name or ""
export async function known(env, name) {
  const p = await env.DB.prepare("SELECT name FROM msg_pins WHERE name = ? COLLATE NOCASE").bind(name).first();
  if (p) return p.name;
  const m = await env.DB.prepare("SELECT name FROM messages WHERE name = ? COLLATE NOCASE LIMIT 1").bind(name).first();
  if (m) return m.name;
  if (env.ASSETS && /^[A-Za-z0-9_. -]{1,40}$/.test(name)) {   // has an avatar on the site (exact spelling)
    try { const r = await env.ASSETS.fetch(new Request("https://x/" + encodeURIComponent(name) + "-ava.png", { method: "HEAD" })); if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) return name; } catch {}
  }
  return "";
}
