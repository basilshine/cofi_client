import { tokenStorage } from "./tokenStorage";

let accessTokenInMemory: string | null = null;

export const isCookieRefreshEnabled =
	import.meta.env.VITE_AUTH_COOKIE_REFRESH === "1";

export const authSessionStore = {
	getAccessToken: (): string | null => accessTokenInMemory,
	setAccessToken: (token: string | null) => {
		accessTokenInMemory = token;
	},
	clear: () => {
		accessTokenInMemory = null;
	},
	hydrateFromLegacyStorage: () => {
		if (accessTokenInMemory) return accessTokenInMemory;
		const legacy = tokenStorage.getToken();
		if (!legacy) return null;
		accessTokenInMemory = legacy;
		return accessTokenInMemory;
	},
};

export const warnLegacyTokenStorageIfNeeded = () => {
	if (!isCookieRefreshEnabled || import.meta.env.DEV !== true) return;
	const hasLegacyToken =
		localStorage.getItem("cofi_token") != null ||
		localStorage.getItem("cofi_refresh_token") != null;
	if (!hasLegacyToken) return;
	console.warn(
		"[auth] Legacy token keys detected in localStorage while VITE_AUTH_COOKIE_REFRESH=1. Migration cleanup is pending.",
	);
};
