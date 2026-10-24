/**
 * Lets otr.to open without a connection, which is what makes it an app the
 * browser offers to install.
 *
 * Requests for the site still go to the network first, so an online visit
 * always gets the current version, and peers on different versions don't end
 * up in one chat. The cache only answers when the network can't. The chat
 * itself needs the signalling server anyway, so offline, the page opens and
 * says it can't reach it.
 *
 * Requests to anything but otr.to itself, the signalling server and the
 * analytics among them, are none of its business.
 */
const CACHE = 'otr.to-v1';

// The page and what it needs to show itself, so the first visit already
// leaves enough behind to open offline.
const SHELL = ['./', 'dist/bundle.js', 'dist/bundle.css', 'manifest.json'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(names => Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Every chat is the same page; only the part after the # tells them apart,
    // and that is the chat's key, which must not end up on disk. So all pages
    // share one entry, and so do all versions of the bundle.
    const key = request.mode === 'navigate' ? new URL('./', self.registration.scope).href : url.origin + url.pathname;

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    event.waitUntil(caches.open(CACHE).then(cache => cache.put(key, copy)));
                }

                return response;
            })
            .catch(() => caches.match(key).then(cached => cached || Response.error()))
    );
});
