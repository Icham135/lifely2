// Lifely 2.0 – Offline-Cache (zuerst Netz, sonst Cache)
const CACHE = 'lifely2-v4';
const FILES = ['./', './index.html', './app.css?v=4', './data.js?v=4', './app.js?v=4', './logo.svg', './figtree-latin.woff2', './manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))));
self.addEventListener('fetch', e => e.request.method === 'GET' && new URL(e.request.url).origin === location.origin &&
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))));
