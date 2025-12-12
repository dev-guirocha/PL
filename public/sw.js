// Simples service worker para habilitar instalação como PWA.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // fetch passthrough; caching pode ser adicionado depois se necessário
});
