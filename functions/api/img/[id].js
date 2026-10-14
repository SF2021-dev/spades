// GET /api/img/:id -> the stored message-box image (D1 table msg_images). Immutable: ids are never reused.
const TYPES = { "image/jpeg": 1, "image/webp": 1, "image/png": 1 };
export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await env.DB.prepare("SELECT mime, data FROM msg_images WHERE id = ?").bind(id).first();
  if (!r || !TYPES[r.mime]) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = r.data instanceof ArrayBuffer ? r.data : new Uint8Array(r.data);
  return new Response(body, { headers: {
    "Content-Type": r.mime, "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline" } });
}
