// Site-wide registration gate: every page and API needs a valid ds_session (D1 sessions table),
// except the sign-up/login page, the auth API, and the few assets that page uses.
import { currentUser } from "./_shared/auth.js";

const OPEN = [/^\/admin\/?$/, /^\/register(\.html)?\/?$/, /^\/api\/auth\//, /^\/dsaltbanner\.png$/, /^\/gc\.js$/, /^\/api\/count/,
  /^\/favicon\.ico$/, /^\/fonts\//, /^\/CNAME$/,
  // Public start pages (no login) + the assets they load.
  /^\/start2?(\.html)?\/?$/, /^\/start2\/(index\.html)?$/, /^\/start2\/icons\//, /^\/icons\//,
  /^\/startmenu\.js$/, /^\/start-bg\.jpg$/, /^\/bing-today\.jpg$/];

// MAINTENANCE: set to false (or env MAINTENANCE="off") to restore the normal site.
const MAINTENANCE = false;
const MAINT_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diamond Spaders Online - Maintenance</title></head><body style="margin:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><h1 style="font-weight:normal;padding:20px">site closed for maintenance... estimated return  2:00 AM EST</h1></body></html>`;

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  if (OPEN.some((r) => r.test(path))) return next();
  if (MAINTENANCE && env.MAINTENANCE !== "off" && !path.startsWith("/api/")) {
    return new Response(MAINT_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "3600" } });
  }
  // Server-to-server bypass for our own backup jobs (secret header, never sent to browsers).
  const svc = request.headers.get("X-DS-Service");
  if (svc && env.SERVICE_TOKEN && svc === env.SERVICE_TOKEN) return next();
  let user = null;
  try { if (env.DB) user = await currentUser(request, env); } catch (e) { console.error("gate", e); }
  if (user) return next();
  if (path.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Registration required", login: "/register" }), {
      status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const back = url.pathname + url.search;
  return new Response(null, { status: 302, headers: {
    Location: "/register?gate=1&next=" + encodeURIComponent(back), "Cache-Control": "no-store" } });
}
