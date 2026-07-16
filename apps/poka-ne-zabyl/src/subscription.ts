export const isSubscriptionExpired = (
	expiresAt?: string | null,
	now = Date.now(),
) => Boolean(expiresAt && Date.parse(expiresAt) <= now);
