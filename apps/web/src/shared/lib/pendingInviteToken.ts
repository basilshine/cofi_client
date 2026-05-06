const STORAGE_KEY = "ceits_pending_invite_token";

export const readPendingInviteToken = (): string | null => {
	try {
		const v = sessionStorage.getItem(STORAGE_KEY)?.trim();
		return v && v.length > 0 ? v : null;
	} catch {
		return null;
	}
};

export const writePendingInviteToken = (token: string | null): void => {
	try {
		if (!token || !token.trim()) {
			sessionStorage.removeItem(STORAGE_KEY);
			return;
		}
		sessionStorage.setItem(STORAGE_KEY, token.trim());
	} catch {
		/* ignore */
	}
};

/** Call on marketing → app links with `?invite=` or `/join?token=` so auth + onboarding keep the token. */
export const persistInviteFromSearchParams = (
	params: URLSearchParams,
): void => {
	const raw =
		params.get("invite")?.trim() ?? params.get("token")?.trim() ?? undefined;
	if (raw) {
		writePendingInviteToken(raw);
	}
};

export const clearPendingInviteToken = (): void => {
	writePendingInviteToken(null);
};
