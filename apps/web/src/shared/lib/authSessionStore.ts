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
	hydrateFromStoredBearerToken: () => {
		if (accessTokenInMemory) return accessTokenInMemory;
		if (isCookieRefreshEnabled) return null;
		const token = tokenStorage.getToken();
		if (!token) return null;
		accessTokenInMemory = token;
		return accessTokenInMemory;
	},
	getRequestAccessToken: () =>
		authSessionStore.getAccessToken() ??
		authSessionStore.hydrateFromStoredBearerToken(),
};
