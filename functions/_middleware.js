// Site-wide registration gate: every page and API needs a valid ds_session (D1 sessions table),
// except the sign-up/login page, the auth API, and the few assets that page uses.
import { currentUser, renewSession } from "./_shared/auth.js";

const OPEN = [/^\/downloads\/Buzz(Christine|Judy|Dennis)-Windows\.zip$/, /^\/admin\/?$/, /^\/register(\.html)?\/?$/, /^\/api\/auth\//, /^\/dsaltbanner\.png$/, /^\/gc\.js$/, /^\/chat\/empty-bg\.(jpg|svg|png)$/, /^\/api\/count/,
  /^\/favicon\.ico$/, /^\/fonts\//, /^\/CNAME$/,
  // Public start pages (no login) + the assets they load.
  /^\/start2?(\.html)?\/?$/, /^\/start2\/(index\.html)?$/, /^\/start2\/icons\//, /^\/icons\//,
    /^\/startb(\.html)?\/?$/, /^\/startb\/(index\.html)?$/,
  /^\/api\/live\/?$/, /^\/api\/startbuzz\/?$/, /^\/startbuzz\.js$/, /^\/buzz\.wav$/, /^\/buzz\.mp3$/, /^\/startmenu\.js$/, /^\/wxloc\.js$/, /^\/alerts\.js$/, /^\/alert-sounds\//, /^\/[^\/]+-ava\.png$/, /^\/avatars\.json$/, /^\/start-bg\.jpg$/, /^\/start-bg\//, /^\/start2-bg\.jpg$/, /^\/bing-today\.jpg$/];

// MAINTENANCE MODE (temporary): when on, only the site owner (Ochwiay) sees the normal site.
// Turn off with one small change: set MAINTENANCE to false below and push to main.
// Or, without a code change, set the Pages env var MAINTENANCE=off (or 0) and redeploy.
// MAINTENANCE=1 or "on" forces it on even if this constant is false.
const MAINTENANCE = false;
const OWNER_NAME = "ochwiay";

// Login page, login/session APIs, and assets the maintenance + login pages need.
// Sign-up POST (/api/auth/register) is intentionally not on this list.
const MAINT_OPEN = [
  /^\/register(\.html)?\/?$/,
  /^\/api\/auth\/(login|logout|me|forgot|change|confirm|resend)\/?$/,
  /^\/dsaltbanner\.png$/, /^\/gc\.js$/, /^\/favicon\.ico$/, /^\/fonts\//, /^\/CNAME$/, /^\/api\/count/,
];

const MAINT_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diamond Spaders — Undergoing Maintenance</title>
<meta name="robots" content="noindex">
<style>
  html, body { margin:0; padding:0; background:#0a0a0a; color:#f3bf56; font-family:"Comic Sans MS","Comic Sans",cursive,sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; }
  .banner { width:100%; height:auto; max-height:160px; object-fit:contain; display:block; background:#0a0a0a; }
  .box { margin:48px auto; padding:36px 28px; max-width:560px; width:calc(100% - 40px); box-sizing:border-box; text-align:center;
         background:#120c08; border:2px solid #fbe646; border-radius:12px; }
  .spade { font-size:56px; line-height:1; color:#ffd84a; text-shadow:0 0 10px rgba(251,230,70,.5); }
  h1 { font-weight:700; color:#ffd84a; font-size:28px; margin:16px 0 10px; text-shadow:0 0 6px rgba(251,230,70,.55); }
  p { color:#c9a227; font-size:17px; font-weight:700; margin:0; letter-spacing:.02em; line-height:1.4; }
  a.signin { display:inline-block; margin-top:22px; color:#f3bf56; font-size:14px; }
</style>
</head>
<body>
<div class="wrap">
  <img class="banner" src="/dsaltbanner.png" alt="Diamond Spaders">
  <div class="box">
    <div class="spade">&#9824;</div>
    <h1>Undergoing Maintenance</h1>
    <p>Diamond Spaders is undergoing maintenance — back soon.</p>
    <a class="signin" href="/register?login=1">Sign in</a>
  </div>
</div>
</body>
</html>`;

function isMaintenance(env) {
  const v = String(env.MAINTENANCE || "").toLowerCase();
  if (v === "off" || v === "0" || v === "false") return false;
  if (v === "1" || v === "on" || v === "true") return true;
  return MAINTENANCE;
}
function isOwner(user) {
  return !!(user && String(user.username || "").toLowerCase() === OWNER_NAME);
}
function maintResponse(path) {
  const headers = { "Cache-Control": "no-store", "Retry-After": "3600" };
  if (path.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Diamond Spaders is undergoing maintenance — back soon" }), {
      status: 503, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
  return new Response(MAINT_HTML, {
    status: 503, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}
// Hide the Sign up tab on /register while maintenance is on (login stays available).
async function hideSignup(res) {
  const ct = res.headers.get("Content-Type") || "";
  if (!ct.includes("text/html")) return res;
  let html = await res.text();
  if (!html.includes('id="tab-signup"')) return new Response(html, res);
  const inject = `<script>
(function(){
  var su=document.getElementById("tab-signup"), sg=document.getElementById("signup");
  var li=document.getElementById("tab-login"), lg=document.getElementById("login");
  if(su){ su.className="hide"; su.onclick=null; }
  if(sg) sg.className="hide";
  if(li) li.className="on";
  if(lg) lg.className="";
  var tabs=document.querySelector(".tabs");
  if(tabs && !document.getElementById("su-paused")){
    var n=document.createElement("p");
    n.id="su-paused"; n.className="small note";
    n.textContent="Sign-up is paused while the site is under maintenance.";
    tabs.parentNode.insertBefore(n, tabs);
  }
})();
</script>`;
  if (html.includes("</body>")) html = html.replace("</body>", inject + "</body>");
  else html += inject;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(html, { status: res.status, headers });
}
async function passWithRenew(ctx, request, env, next) {
  const res = await next();
  try {
    const c = await renewSession(request, env);
    if (c) { const r = new Response(res.body, res); r.headers.append("Set-Cookie", c); return r; }
  } catch (e) { console.error("renew", e); }
  return res;
}

export async function onRequest(ctx) {
  const { request, env, next } = ctx;
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);

  // Server-to-server bypass for our own backup jobs (secret header, never sent to browsers).
  const svc = request.headers.get("X-DS-Service");
  if (svc && env.SERVICE_TOKEN && svc === env.SERVICE_TOKEN) return next();

  if (isMaintenance(env)) {
    if (MAINT_OPEN.some((r) => r.test(path))) {
      const res = await next();
      if (/^\/register(\.html)?\/?$/.test(path)) return hideSignup(res);
      return res;
    }
    let user = null;
    try { if (env.DB) user = await currentUser(request, env); } catch (e) { console.error("gate", e); }
    if (isOwner(user)) return passWithRenew(ctx, request, env, next);
    return maintResponse(path);
  }

  if (OPEN.some((r) => r.test(path))) return next();
  let user = null;
  try { if (env.DB) user = await currentUser(request, env); } catch (e) { console.error("gate", e); }
  if (user) return passWithRenew(ctx, request, env, next);
  if (path.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Registration required", login: "/register" }), {
      status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
  const back = url.pathname + url.search;
  return new Response(null, { status: 302, headers: {
    Location: "/register?gate=1&next=" + encodeURIComponent(back), "Cache-Control": "no-store" } });
}
