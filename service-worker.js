const CACHE_NAME = 'mybusiness-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/modules/dashboard.js',
  '/modules/sales.js',
  '/modules/inventory.js',
  '/modules/customers.js',
  '/modules/expenses.js',
  '/modules/stockPurchases.js',
  '/modules/report.js',
  '/modules/more.js',
  '/modules/setting.js',
  '/modules/modals.js',
  '/modules/suppliers.js',
  '/modules/cashbook.js',
  '/modules/search.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event: Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network-first for API/Firebase, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('firestore') || event.request.url.includes('firebaseauth')) {
    // Never cache sensitive Firebase API calls
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});