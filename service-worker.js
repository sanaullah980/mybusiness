const CACHE_NAME = 'mybusiness-v8';
const APP_SHELL = [
  '/', '/index.html', '/style.css', '/app.js', '/manifest.json',
  '/icon-192.png', '/icon-512.png',
  '/modules/dashboard.js', '/modules/modals.js', '/modules/sales.js',
  '/modules/invoices.js', '/modules/suppliers.js', '/modules/setting.js',
  '/modules/inventory.js', '/modules/customers.js', '/modules/returns.js',
  '/modules/cashbook.js', '/modules/stockPurchases.js', '/modules/expenses.js',
  '/modules/search.js', '/modules/report.js', '/modules/more.js',
  '/modules/staff.js', '/modules/reminders.js', '/modules/business.js',
  '/modules/backup.js', '/modules/appLock.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
];
const EXTERNAL_CACHE_HOSTS = new Set(['www.gstatic.com','cdnjs.cloudflare.com']);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await Promise.all(APP_SHELL.map(async url => {
      try { await cache.add(url); } catch (e) { console.warn('Shell cache skipped:', url, e); }
    }));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('mybusiness-') && k !== CACHE_NAME).map(k => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const firebaseHost = url.hostname.includes('googleapis.com') || url.hostname.includes('firebaseio.com') || url.hostname.includes('firebaseapp.com');
  if (firebaseHost) return; // Firestore/Auth handle their own network/offline behaviour.

  const isAppAsset = url.origin === self.location.origin;
  const isAllowedExternal = EXTERNAL_CACHE_HOSTS.has(url.hostname);
  if (!isAppAsset && !isAllowedExternal) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return cache.match('/index.html');
      throw error;
    }
  })());
});
