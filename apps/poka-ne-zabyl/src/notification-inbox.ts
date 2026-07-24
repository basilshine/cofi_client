export const newestUnseenNotification = <T extends { id: number }>(
	notifications: T[],
	knownIDs: Set<number> | null,
) =>
	knownIDs
		? notifications.find((notification) => !knownIDs.has(notification.id))
		: undefined;

export const isNotificationPushMessage = (value: unknown) =>
	typeof value === "object" &&
	value !== null &&
	"type" in value &&
	value.type === "pnz:notification";
