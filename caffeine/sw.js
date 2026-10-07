// Caffeine Calculator offline cache (version changes whenever the page changes)
const CACHE = 'caffeine-cabf7cbe1f';
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
const OFFLINE = '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Caffeine Calculator</title>'
  + '<body style="background:#0a0c10;color:#d8dde6;font:17px -apple-system,system-ui,sans-serif;padding:80px 24px;line-height:1.45">'
  + '<h2 style="margin:0 0 12px">Caffeine Calculator is not saved on this phone yet</h2>'
  + '<p>Open it once with an internet connection (Wi-Fi or mobile data). After that it works offline.</p>'
  + '<p><a href="./" style="color:#f0b24a">Try again</a></p></body>';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
// keep this version and the one before it (a fallback if this one is ever lost)
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => {
    const old = ks.filter(k => k.startsWith('caffeine-') && k !== CACHE);
    return Promise.all(old.slice(0, -1).map(k => caches.delete(k)));
  }).then(() => self.clients.claim()));
});
async function saved(req) {
  const nav = req.mode === 'navigate', c = await caches.open(CACHE);
  let hit = await c.match(req, {ignoreSearch: true});
  if (!hit && nav) hit = (await c.match('index.html')) || (await c.match('./'));
  if (!hit) hit = await caches.match(req, {ignoreSearch: true});                 // any saved version
  if (!hit && nav) hit = (await caches.match('index.html')) || (await caches.match('./'));
  return hit || null;
}
// put back any app file missing from this version's copy (e.g. after iOS cleared storage)
async function refill() {
  const c = await caches.open(CACHE);
  for (const f of FILES) if (!(await c.match(f))) await c.add(f).catch(() => {});
}
// saved copy only, when there is one: no network at all (the page is ~10 MB; re-downloading it on every launch kept the
// service worker busy for minutes and doubled the storage). New versions arrive through the browser's own sw.js check.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await saved(req).catch(() => null);
    if (hit) { if (req.mode === 'navigate') e.waitUntil(refill().catch(() => {})); return hit; }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    const net = fetch(req, {signal: ctl.signal}).then(async r => {
      clearTimeout(timer);
      if (r.ok && r.type === 'basic' && req.mode !== 'navigate' && FILES.includes(new URL(req.url).pathname.split('/').pop())) { const c = await caches.open(CACHE); await c.put(req, r.clone()); }
      return r;
    });
    try { return await net; }
    catch (err) {
      return req.mode === 'navigate'
        ? new Response(OFFLINE, {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}})
        : new Response('', {status: 504});
    }
  })());
});
