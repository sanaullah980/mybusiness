const CACHE_NAME = 'mybusiness-v4';
const APP_SHELL = [
  '/', '/index.html', '/style.css', '/app.js', '/manifest.json',
  '/icon-192.png', '/icon-512.png',
  '/modules/dashboard.js', '/modules/modals.js', '/modules/sales.js',
  '/modules/invoices.js', '/modules/suppliers.js', '/modules/setting.js',
  '/modules/inventory.js', '/modules/customers.js', '/modules/returns.js',
  '/modules/cashbook.js', '/modules/stockPurchases.js', '/modules/expenses.js',
  '/modules/search.js', '/modules/report.js', '/modules/more.js', '/modules/staff.js', '/modules/reminders.js', '/modules/business.js', '/modules/backup.js', '/modules/appLock.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com') || url.hostname.includes('firebaseapp.com') || url.hostname.includes('gstatic.com')) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/index.html')))
  );
});
