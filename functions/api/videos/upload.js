// POST /api/videos/upload  multipart: file + optional title  -> stored in R2 when bound
import { wrap, json, HttpError, randomToken } from "../../_shared/auth.js";
import { init, posterName, cleanTitle, publicRow, uploadsEnabled, checkRate, looksLikeVideo, mimeForExt, MAX_BYTES, ALLOWED_EXT, ALLOWED_MIME } from "../../_shared/videos.js";

export const onRequestPost = wrap(async ({ request, env }) => {
  const { user, name, owner } = await posterName(env, request);
  await init(env);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Bad origin");
  if (!uploadsEnabled(env)) {
    throw new HttpError(503, "File uploads need R2 storage, which isn't enabled on this account yet. You can still paste a YouTube, Vimeo, or direct video link.");
  }
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("multipart/form-data")) throw new HttpError(415, "Send the video as a file upload.");
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BYTES + 1024 * 1024) throw new HttpError(413, "Videos must be 100 MB or smaller.");
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") throw new HttpError(400, "Choose a video file to upload.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Videos must be 100 MB or smaller.");
  if (file.size < 100) throw new HttpError(400, "That file is too small to be a video.");
  const title = cleanTitle(form.get("title"));
  const givenMime = String(file.type || "").toLowerCase();
  const extFromName = (String(file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || "";
  const ext = ALLOWED_MIME[givenMime] || (ALLOWED_EXT.includes(extFromName) ? extFromName : "");
  if (!ext) throw new HttpError(400, "Please upload an mp4, webm, or mov file.");
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!looksLikeVideo(head, ext)) throw new HttpError(400, "That file doesn't look like a video.");
  await checkRate(env, user.id);
  const id = randomToken(16);
  const key = "v/" + id + "." + ext;
  const mime = mimeForExt(ext, givenMime);
  await env.VIDEOS.put(key, file.stream(), { httpMetadata: { contentType: mime } });
  const now = Date.now();
  try {
    await env.DB.prepare(
      "INSERT INTO videos (id, user_id, username, title, kind, src, mime, bytes, created_at) VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?)"
    ).bind(id, user.id, name, title, key, mime, file.size, now).run();
  } catch (e) {
    try { await env.VIDEOS.delete(key); } catch {}
    throw e;
  }
  const row = { id, user_id: user.id, username: name, title, kind: "file", src: key, mime, bytes: file.size, created_at: now };
  return json({ ok: true, video: await publicRow(env, row, name, owner) }, 201);
});
