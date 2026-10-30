// GET /api/img/:id -> the stored message-box image (D1 table msg_images). Immutable: ids are never reused.
const TYPES = { "image/jpeg": 1, "image/webp": 1, "image/png": 1, "image/gif": 1 };
export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await env.DB.prepare("SELECT mime, bytes, data FROM msg_images WHERE id = ?").bind(id).first();
  if (!r || !TYPES[r.mime]) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  let body = r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : new Uint8Array(r.data);
  if (r.bytes > body.length) {   // big image: rest of the bytes are in msg_image_chunks
    const { results } = await env.DB.prepare("SELECT data FROM msg_image_chunks WHERE id = ? ORDER BY seq").bind(id).all();
    const full = new Uint8Array(r.bytes); full.set(body); let o = body.length;
    for (const c of results || []) { const u = new Uint8Array(c.data instanceof ArrayBuffer ? c.data : c.data); full.set(u.subarray(0, r.bytes - o), o); o += u.length; }
    body = full;
  }
  return new Response(body, { headers: {
    "Content-Type": r.mime, "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline" } });
}
