const CACHE_NAME = "pnz-offline-v3";
const OFFLINE_FILES = [
	"/offline.html",
	"/manifest.webmanifest?v=20260717",
	"/assets/poka-ne-zabyl-logo.svg?v=20260717",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_FILES)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	if (event.request.mode !== "navigate") return;
	event.respondWith(
		fetch(event.request).catch(() => caches.match("/offline.html")),
	);
});
