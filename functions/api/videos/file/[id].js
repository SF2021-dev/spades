// GET /api/videos/file/<id>  -> video bytes from R2, members only. Supports Range for seeking.
import { wrap, HttpError } from "../../../../_shared/auth.js";
import { init, posterName } from "../../../../_shared/videos.js";

export const onRequestGet = wrap(async ({ request, env, params }) => {
  await posterName(env, request);
  await init(env);
  const id = String(params.id || "");
  if (!/^[a-f0-9]{32}$/.test(id)) throw new HttpError(404, "Not found");
  const row = await env.DB.prepare("SELECT kind, src, mime, bytes FROM videos WHERE id = ?").bind(id).first();
  if (!row || row.kind !== "file" || !row.src) throw new HttpError(404, "Not found");
  if (!env.VIDEOS) throw new HttpError(503, "Video storage isn't available.");

  const mime = row.mime || "video/mp4";
  const base = {
    "Content-Type": mime,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Accept-Ranges": "bytes",
  };

  const rangeHdr = request.headers.get("Range");
  const m = rangeHdr && /^bytes=(\d*)-(\d*)$/.exec(rangeHdr);
  if (m) {
    const size = Number(row.bytes) || 0;
    let start = m[1] === "" ? null : Number(m[1]);
    let end = m[2] === "" ? null : Number(m[2]);
    if (start == null && end != null && size) { start = Math.max(0, size - end); end = size - 1; }
    if (start == null) start = 0;
    if (end == null) end = size ? size - 1 : start;
    if (size && start >= size) {
      return new Response(null, { status: 416, headers: { ...base, "Content-Range": "bytes */" + size } });
    }
    if (size) end = Math.min(end, size - 1);
    if (end < start) end = start;
    const obj = await env.VIDEOS.get(row.src, { range: { offset: start, length: end - start + 1 } });
    if (!obj) throw new HttpError(404, "Not found");
    const headers = { ...base, "Content-Range": "bytes " + start + "-" + end + "/" + (size || "*"), "Content-Length": String(end - start + 1) };
    return new Response(obj.body, { status: 206, headers });
  }

  const obj = await env.VIDEOS.get(row.src);
  if (!obj) throw new HttpError(404, "Not found");
  const headers = { ...base };
  if (row.bytes) headers["Content-Length"] = String(row.bytes);
  return new Response(obj.body, { headers });
});
