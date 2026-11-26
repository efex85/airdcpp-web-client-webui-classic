// This web UI doesn't use a service worker. The standard web UI, which earlier images served at the same
// address, registered one under this name: browsers that still have it load this file instead, which removes
// the files cached by the old one and unregisters itself.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete('resource-store');
      await self.registration.unregister();
      // Show the current page in the tabs that the old worker was serving
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => undefined)));
    })(),
  );
});
