/** Persists funnel choice (business vs personal) across auth; read for analytics or onboarding UX. */
export const ONBOARDING_INTENT_KEY = "cofi_onboarding_intent";

export type OnboardingIntent = "business" | "personal";

export const persistOnboardingIntentFromSearch = (
	params: URLSearchParams,
): void => {
	const raw = params.get("intent");
	if (raw === "business" || raw === "personal") {
		try {
			localStorage.setItem(ONBOARDING_INTENT_KEY, raw);
		} catch {
			/* ignore quota / private mode */
		}
	}
};

export const readOnboardingIntent = (): OnboardingIntent | null => {
	try {
		const v = localStorage.getItem(ONBOARDING_INTENT_KEY);
		if (v === "business" || v === "personal") return v;
	} catch {
		return null;
	}
	return null;
};

export const clearOnboardingIntent = (): void => {
	try {
		localStorage.removeItem(ONBOARDING_INTENT_KEY);
	} catch {
		/* ignore */
	}
};
