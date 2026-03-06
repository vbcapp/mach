const CACHE_NAME = 'exam-system-v1';

// Only cache essential app shell files
const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/design-tokens.css',
  '/css/vibe-style.css',
  '/js/theme-config.js',
  '/js/components.js',
  '/js/modal-system.js',
  '/js/components/bottom-nav.js',
  '/favicon.ico'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first strategy (always try network, fallback to cache)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Supabase API calls
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase')) return;
  if (url.hostname.includes('cdn.jsdelivr.net')) return;
  if (url.hostname.includes('cdn.tailwindcss.com')) return;
  if (url.hostname.includes('fonts.googleapis.com')) return;
  if (url.hostname.includes('fonts.gstatic.com')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for local assets
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
