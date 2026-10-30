// GET /api/img/:id -> the stored message-box image (D1 table msg_images; big ones continue in msg_image_chunks).
const TYPES = { "image/jpeg": 1, "image/webp": 1, "image/png": 1, "image/gif": 1 };
// D1 may hand BLOBs back as ArrayBuffer, a typed array/Buffer, a plain number array, or (rarely) a base64 string.
export function toBytes(v) {
  if (v == null) return new Uint8Array(0);
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  if (Array.isArray(v)) return Uint8Array.from(v);
  if (typeof v === "object" && Array.isArray(v.data)) return Uint8Array.from(v.data);   // JSON'd Buffer
  if (typeof v === "string") { const s = atob(v); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  return new Uint8Array(0);
}
export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await env.DB.prepare("SELECT mime, bytes, data FROM msg_images WHERE id = ?").bind(id).first();
  if (!r || !TYPES[r.mime]) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const head = toBytes(r.data), want = Number(r.bytes) || head.length;
  let body = head, chunked = false;
  if (want > head.length) {   // big image: rest of the bytes are in msg_image_chunks
    chunked = true;
    const { results } = await env.DB.prepare("SELECT seq, data FROM msg_image_chunks WHERE id = ? ORDER BY seq").bind(id).all();
    const parts = [head]; let n = head.length;
    for (const c of results || []) { const u = toBytes(c.data); parts.push(u); n += u.length; }
    if (n !== want) { console.error("img size mismatch", id, n, want); return new Response("Picture incomplete", { status: 500, headers: { "Cache-Control": "no-store" } }); }
    body = new Uint8Array(n); let o = 0; for (const p of parts) { body.set(p, o); o += p.length; }
  } else if (head.length !== want) {
    return new Response("Picture incomplete", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(body, { headers: {
    "Content-Type": r.mime, "Content-Length": String(body.length),
    "Cache-Control": chunked ? "private, max-age=300" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline" } });
}
