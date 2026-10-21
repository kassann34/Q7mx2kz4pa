// アンビグラム工房 オフライン用 Service Worker
// ファイルを差し替えたら VERSION を上げると、古い保存分が入れ替わります。
const VERSION = 'ambigram-v7';
const CORE = [
  './', './index.html', './zuchi.html', './chojo.html', './motion.html',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];
const FONT_CACHE = 'ambigram-fonts';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 書体: 一度取得したものを保存し、以降は保存分を使う
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (_) { return new Response('', { status: 503 }); }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // 自分のファイル: 保存分をすぐ返し、裏で最新版に更新（次回起動で反映）
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await c.match('./index.html')) || new Response('オフラインです', { status: 503 });
    return new Response('', { status: 503 });
  }));
});
