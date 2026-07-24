export const webPushSupported = () =>
	typeof window !== "undefined" &&
	"serviceWorker" in navigator &&
	"PushManager" in window &&
	"Notification" in window;

const urlBase64ToUint8Array = (value: string) => {
	const padding = "=".repeat((4 - (value.length % 4)) % 4);
	const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = window.atob(base64);
	return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

export const currentWebPushSubscription = async () => {
	if (!webPushSupported()) return null;
	const registration = await navigator.serviceWorker.ready;
	return registration.pushManager.getSubscription();
};

export const subscribeToWebPush = async (publicKey: string) => {
	if (!webPushSupported()) throw new Error("Web Push is not supported");
	const permission =
		Notification.permission === "default"
			? await Notification.requestPermission()
			: Notification.permission;
	if (permission !== "granted")
		throw new Error("notification-permission-denied");

	const registration = await navigator.serviceWorker.ready;
	const existing = await registration.pushManager.getSubscription();
	if (existing) return existing;
	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(publicKey),
	});
};

export const syncAppBadge = async (unreadCount: number) => {
	const badgeNavigator = navigator as Navigator & {
		setAppBadge?: (contents?: number) => Promise<void>;
		clearAppBadge?: () => Promise<void>;
	};
	try {
		if (unreadCount > 0) {
			await badgeNavigator.setAppBadge?.(unreadCount);
		} else {
			await badgeNavigator.clearAppBadge?.();
		}
	} catch {
		// Badging is optional and must not affect the inbox.
	}
};
