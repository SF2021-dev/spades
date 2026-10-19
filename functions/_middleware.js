// TEMPORARY "under construction" switch (added 2026-10-19).
//   /            -> construction.html (under-construction page)
//   /alt         -> the real main page (index.html, still updated in place by update_winners.py)
//   /alt/        -> 301 /alt   (keeps relative URLs resolving from the site root)
//   /index.html  -> Pages already 308s it to "/", so it lands on the construction page
//   any unknown path that would fall back to index.html (Pages SPA fallback) -> construction page
// To revert: delete this file (and construction.html if you like) and redeploy.
async function asset(ctx, path) {
  let r = await ctx.env.ASSETS.fetch(new URL(path, ctx.request.url));
  for (let i = 0; i < 3 && r.status >= 300 && r.status < 400 && r.headers.get('location'); i++)
    r = await ctx.env.ASSETS.fetch(new URL(r.headers.get('location'), ctx.request.url));
  return r;
}
function page(r, extra) {
  const h = new Headers(r.headers);
  h.set('cache-control', 'public, max-age=0, must-revalidate');
  if (extra) for (const k in extra) h.set(k, extra[k]);
  return new Response(r.body, { status: 200, headers: h });
}
export async function onRequest(ctx) {
  const url = new URL(ctx.request.url);
  const p = url.pathname;
  if (p.startsWith('/api/')) return ctx.next();
  const m = ctx.request.method;
  if (m !== 'GET' && m !== 'HEAD') return ctx.next();
  if (p === '/alt/' || p === '/alt/index.html') return Response.redirect(url.origin + '/alt' + url.search, 301);
  if (p === '/alt') return page(await asset(ctx, '/'), { 'x-robots-tag': 'noindex' });
  if (p === '/') return page(await asset(ctx, '/construction.html'));
  const res = await ctx.next();
  // Catch Pages' SPA fallback (unknown path served with index.html) so it can't bypass to the old page.
  const ct = res.headers.get('content-type') || '';
  if (res.status === 200 && ct.includes('text/html')) {
    const et = res.headers.get('etag');
    if (et) {
      const home = await ctx.env.ASSETS.fetch(new URL('/', ctx.request.url), { method: 'HEAD' });
      if (home.headers.get('etag') === et) return page(await asset(ctx, '/construction.html'));
    }
  }
  return res;
}
