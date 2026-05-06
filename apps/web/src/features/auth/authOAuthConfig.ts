/**
 * When true, `AuthProviderButton` handlers should start real OAuth (not implemented here).
 * Until backend wiring exists, keep this unset/false so clicks show a polite placeholder only.
 */
export const isAuthSocialOAuthConfigured = (): boolean =>
	import.meta.env.VITE_AUTH_SOCIAL_ENABLED === "true";

export const authSocialPlaceholderMessage = (): string =>
	import.meta.env.DEV
		? "Coming soon — social sign-in is not wired in this build yet."
		: "Social sign-in is not available yet. Please use email.";
