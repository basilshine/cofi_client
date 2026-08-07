export const shouldRetryAppRender = (
	lastRetryAt: number,
	now = Date.now(),
	cooldownMs = 30_000,
) => lastRetryAt <= 0 || now - lastRetryAt >= cooldownMs;
