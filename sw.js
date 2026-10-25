/* Pluggapp – service worker: offline + push */
const CACHE = 'pluggapp-v1';
const CORE = ['./', './index.html', './icon-v2.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Firestore and other APIs: always network
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts')) return;
  // App shell: network first, fall back to cache (so updates arrive, offline still works)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  // Fonts, scripts, images: cache first, refresh in background
  e.respondWith(caches.match(e.request).then((cached) => {
    const net = fetch(e.request).then((r) => { if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => cached);
    return cached || net;
  }));
});

self.addEventListener('push', (e) => {
  let data = {}; try { data = e.data ? e.data.json() : {}; } catch (err) { data = { title: 'Pluggapp', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'Pluggapp';
  e.waitUntil(self.registration.showNotification(title, { body: data.body || 'Dags för en sprint!', icon: './icon-v2.png', badge: './icon-v2.png', tag: data.tag || 'pluggapp', data: { url: data.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate?.(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
