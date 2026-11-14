// Keeps a copy of the game on the device so it opens without internet.
// Online: always fetch the newest version and refresh the saved copy.
// Offline (or the network takes more than 3 seconds): use the saved copy.
const CACHE = 'sanziqi-v3';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function save(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts never change: saved copy first, network only the first time.
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res))));
    return;
  }
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const saved = await caches.match(req, { ignoreSearch: true })
      || (req.mode === 'navigate' ? await caches.match('index.html') : undefined);
    const fresh = fetch(req).then(res => save(req, res));
    if (!saved) return fresh;
    fresh.catch(() => {});
    const slow = new Promise(resolve => setTimeout(() => resolve(saved), 3000));
    return Promise.race([fresh.catch(() => saved), slow]);
  })());
});
