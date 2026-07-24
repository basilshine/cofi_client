const CACHE_NAME = "pnz-offline-v5";
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
			.then(async () => {
				await self.clients.claim();
				const clients = await self.clients.matchAll({ type: "window" });
				await Promise.all(clients.map((client) => client.navigate(client.url)));
			}),
	);
});

self.addEventListener("fetch", (event) => {
	if (event.request.mode !== "navigate") return;
	event.respondWith(
		fetch(event.request, { cache: "no-store" }).catch(() =>
			caches.match("/offline.html"),
		),
	);
});

self.addEventListener("push", (event) => {
	let payload = {};
	try {
		payload = event.data ? event.data.json() : {};
	} catch {
		payload = { body: event.data?.text() || "" };
	}
	const notificationID = Number(payload.notification_id || 0);
	const url = safeAppURL(payload.url);
	event.waitUntil(
		Promise.all([
			self.registration.showNotification(payload.title || "Пока не забыл", {
				body: payload.body || "У вас новое уведомление",
				icon: "/assets/poka-ne-zabyl-app-icon-192.png?v=20260717",
				badge: "/assets/poka-ne-zabyl-app-icon-192.png?v=20260717",
				tag: notificationID ? `pnz-notification-${notificationID}` : undefined,
				data: { url },
			}),
			setBadge(Number(payload.unread_count || 0)),
			notifyOpenClients(notificationID),
		]),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const targetURL = safeAppURL(event.notification.data?.url);
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then(async (windows) => {
				for (const client of windows) {
					if ("navigate" in client) await client.navigate(targetURL);
					if ("focus" in client) return client.focus();
				}
				return self.clients.openWindow(targetURL);
			}),
	);
});

const safeAppURL = (value) => {
	try {
		const url = new URL(value || "/app", self.location.origin);
		return url.origin === self.location.origin
			? url.href
			: `${self.location.origin}/app`;
	} catch {
		return `${self.location.origin}/app`;
	}
};

const setBadge = async (count) => {
	try {
		if (count > 0 && self.navigator.setAppBadge) {
			await self.navigator.setAppBadge(count);
		} else if (self.navigator.clearAppBadge) {
			await self.navigator.clearAppBadge();
		}
	} catch {
		// App badges are optional.
	}
};

const notifyOpenClients = async (notificationID) => {
	const clients = await self.clients.matchAll({
		type: "window",
		includeUncontrolled: true,
	});
	for (const client of clients) {
		client.postMessage({
			type: "pnz:notification",
			notification_id: notificationID,
		});
	}
};
