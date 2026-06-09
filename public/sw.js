const CACHE = 'obsidian-v3';
const PRECACHE = ['/', '/index.html'];

// ─── Install ─────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch (offline cache) ───────────────────────────────────
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res && res.status === 200 && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});

// ─── Push ────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: '📅 Obsidian Calendar', body: '' };
  try { data = event.data.json(); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body  || '',
      icon:  '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag:   data.tag   || 'obsidian',
      data:  { url: '/' },
    })
  );
});

// ─── Notification click ──────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
