/* オフラインでも使えるように、アプリの画面を構成するファイルをキャッシュする */
const CACHE = 'shakai-drill-v9';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css',
  './js/data.js', './js/readings.js', './js/map.js', './js/symbols.js', './js/climate.js', './js/exam.js', './js/persons.js', './js/notes.js', './js/timeline.js', './js/search.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ネットワークを優先し、つながらないときはキャッシュを使う（問題の更新がすぐ反映されるように）
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
