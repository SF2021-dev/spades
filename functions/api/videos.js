// GET  /api/videos  -> { ok, me, owner, uploads, maxBytes, videos[] }  (newest first)
// POST /api/videos  { url, title? } | { action:"delete", id }
import { wrap, json, readJson, HttpError, randomToken } from "../_shared/auth.js";
import { init, posterName, cleanTitle, parseShareUrl, publicRow, uploadsEnabled, checkRate, MAX_BYTES } from "../_shared/videos.js";

export const onRequestGet = wrap(async ({ request, env }) => {
  const { name, owner } = await posterName(env, request);
  await init(env);
  const { results } = await env.DB.prepare(
    "SELECT id, user_id, username, title, kind, src, mime, bytes, created_at FROM videos ORDER BY created_at DESC LIMIT 100"
  ).all();
  const videos = [];
  for (const row of results || []) videos.push(await publicRow(env, row, name, owner));
  return json({ ok: true, me: name, owner, uploads: uploadsEnabled(env), maxBytes: MAX_BYTES, videos });
});

async function remove(env, id, name, owner) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new HttpError(400, "Bad video id.");
  const row = await env.DB.prepare("SELECT id, username, kind, src FROM videos WHERE id = ?").bind(id).first();
  if (!row) throw new HttpError(404, "Video not found.");
  const mine = String(row.username).toLowerCase() === String(name).toLowerCase();
  if (!owner && !mine) throw new HttpError(403, "You can only delete your own videos.");
  await env.DB.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
  if (row.kind === "file" && env.VIDEOS && row.src) {
    try { await env.VIDEOS.delete(row.src); } catch (e) { console.error("r2 delete", e); }
  }
  return json({ ok: true });
}

export const onRequestPost = wrap(async ({ request, env }) => {
  const { user, name, owner } = await posterName(env, request);
  await init(env);
  const b = await readJson(request);
  if (b.action === "delete") return remove(env, String(b.id || ""), name, owner);
  const title = cleanTitle(b.title);
  const parsed = parseShareUrl(b.url);
  await checkRate(env, user.id);
  const id = randomToken(16), now = Date.now();
  await env.DB.prepare(
    "INSERT INTO videos (id, user_id, username, title, kind, src, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, user.id, name, title, parsed.kind, parsed.src, "", 0, now).run();
  const row = { id, user_id: user.id, username: name, title, kind: parsed.kind, src: parsed.src, mime: "", bytes: 0, created_at: now };
  return json({ ok: true, video: await publicRow(env, row, name, owner) }, 201);
});

export const onRequestDelete = wrap(async ({ request, env }) => {
  const { name, owner } = await posterName(env, request);
  await init(env);
  const id = new URL(request.url).searchParams.get("id") || "";
  return remove(env, id, name, owner);
});
