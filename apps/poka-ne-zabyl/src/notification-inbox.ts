export const newestUnseenNotification = <T extends { id: number }>(
	notifications: T[],
	knownIDs: Set<number> | null,
) =>
	knownIDs
		? notifications.find((notification) => !knownIDs.has(notification.id))
		: undefined;
