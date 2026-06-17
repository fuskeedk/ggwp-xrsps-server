// Self-destruct service worker — clears legacy caches and unregisters itself.
// iOS Safari cannot reliably read streamed cache bodies ("Unable to convert chunk to Uint8Array").

const SW_VERSION = "osrs-self-destruct-v6";

self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) => Promise.all(names.map((name) => caches.delete(name))))
            .then(() => self.clients.claim())
            .then(() => self.registration.unregister()),
    );
});

// No fetch handler — all requests go directly to the network.
