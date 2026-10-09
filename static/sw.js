const CACHE = "spotify-loops-files";
const FILES = ["/library", "/static/library.js", "/static/style.css", "/static/music_player_icon.png"];

// runs once when the worker is installed: save a copy of each file
self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// runs every time the page asks for something
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    // only handle our own page files, never the API (/songs, /me, ...)
    if (event.request.method !== "GET" || !FILES.includes(url.pathname)) return;

    event.respondWith(
        fetch(event.request, { cache: "no-cache" })                          // 1. try the server first
            .then((response) => {
                const copy = response.clone();
                caches.open(CACHE).then((cache) => cache.put(event.request, copy));  // keep the newest copy
                return response;
            })
            .catch(() => caches.match(event.request)) // 2. server not reachable: use the saved copy
    );
});