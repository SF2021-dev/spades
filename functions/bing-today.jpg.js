export async function onRequest(ctx) {
  const cache = caches.default;
  const day = new Date().toISOString().slice(0, 10);
  const key = new Request('https://bing-cache.local/' + day);
  let r = await cache.match(key);
  if (r) return r;
  try {
    const j = await (await fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=en-US')).json();
    const img = await fetch('https://www.bing.com' + j.images[0].url.replace(/_\d+x\d+/, '_UHD'));
    if (!img.ok) throw 0;
    r = new Response(img.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' } });
    ctx.waitUntil(cache.put(key, r.clone()));
    return r;
  } catch (e) {
    return ctx.env.ASSETS.fetch(new URL('/bing-fallback.jpg', ctx.request.url));
  }
}
