// Site-wide registration gate: every page and API needs a valid ds_session (D1 sessions table),
// except the sign-up/login page, the auth API, and the few assets that page uses.
import { currentUser } from "./_shared/auth.js";

const OPEN = [/^\/register(\.html)?\/?$/, /^\/api\/auth\//, /^\/dsaltbanner\.png$/, /^\/gc\.js$/, /^\/api\/count/,
  /^\/favicon\.ico$/, /^\/fonts\//, /^\/CNAME$/,
  // Public start pages (no login) + the assets they load.
  /^\/start2?(\.html)?\/?$/, /^\/start2\/(index\.html)?$/, /^\/start2\/icons\//, /^\/icons\//,
  /^\/startmenu\.js$/, /^\/start-bg\.jpg$/, /^\/bing-today\.jpg$/];

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  if (OPEN.some((r) => r.test(path))) return next();
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
