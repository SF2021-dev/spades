// First-party GoatCounter proxy: browsers hit /api/count (not blocked by adblock lists); we forward to GoatCounter
// with the visitor's real IP + UA so sessions/locations stay correct.
const GC = "https://ochwiay.goatcounter.com/count";
const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));
export async function onRequest({ request }) {
  const u = new URL(request.url);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const h = {
    "User-Agent": request.headers.get("User-Agent") || "",
    "Accept-Language": request.headers.get("Accept-Language") || "",
    "X-Forwarded-For": ip, "X-Real-IP": ip,
  };
  const ref = request.headers.get("Referer"); if (ref) h["Referer"] = ref;
  const q = new URLSearchParams(u.search);
  if (q.has("noscript") && !q.has("r") && ref) q.set("r", "");     // img fallback: page referrer unknown
  let status = 0, gch = "";
  try {
    const r = await fetch(GC + "?" + q.toString(), { method: "GET", headers: h });
    status = r.status; gch = r.headers.get("X-Goatcounter") || "";
  } catch (e) { status = -1; }
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store",
    "X-Upstream": String(status), ...(gch ? { "X-Goatcounter": gch } : {}) } });
}
