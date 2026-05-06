const looksTechnical = (message: string): boolean => {
	const m = message.toLowerCase();
	return (
		m.includes("/api/") ||
		m.includes("axios") ||
		m.includes("network error") ||
		m.includes("failed to fetch") ||
		m.includes("econnrefused") ||
		m.includes("status code") ||
		m.includes("request failed")
	);
};

export const authUserFacingError = (err: unknown, fallback: string): string => {
	if (!(err instanceof Error) || !err.message.trim()) {
		return fallback;
	}
	if (looksTechnical(err.message)) {
		return fallback;
	}
	return err.message;
};
