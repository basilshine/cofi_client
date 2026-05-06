import axios from "axios";
import { authSessionStore, isCookieRefreshEnabled } from "./authSessionStore";
import { tokenStorage } from "./tokenStorage";

/** Backend origin only — request paths already include `/api/v1/...`. Do not append `/api` (would produce `/api/api/v1/...`). */
const resolveBaseURL = () => {
	const raw = import.meta.env.VITE_API_URL?.trim();
	if (!raw) return "";
	return raw.replace(/\/+$/, "");
};

export const httpClient = axios.create({
	baseURL: resolveBaseURL(),
	headers: { "Content-Type": "application/json" },
});

/** No auth header — used for refresh to avoid recursion. */
const refreshHttp = axios.create({
	baseURL: resolveBaseURL(),
	headers: { "Content-Type": "application/json" },
});

httpClient.interceptors.request.use((config) => {
	const token =
		authSessionStore.getAccessToken() ??
		authSessionStore.hydrateFromLegacyStorage() ??
		tokenStorage.getToken();
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

type RetryableConfig = { __retry?: boolean };

httpClient.interceptors.response.use(
	(r) => r,
	async (error: unknown) => {
		if (!axios.isAxiosError(error)) {
			return Promise.reject(error);
		}
		const status = error.response?.status;
		const cfg = error.config as
			| (typeof error.config & RetryableConfig)
			| undefined;
		if (!cfg || status !== 401 || cfg.__retry) {
			return Promise.reject(error);
		}
		const rt = tokenStorage.getRefreshToken();
		if (!rt && !isCookieRefreshEnabled) {
			return Promise.reject(error);
		}
		cfg.__retry = true;
		try {
			const { data } = await refreshHttp.post<{
				token: string;
				refreshToken?: string;
				refresh_token?: string;
			}>(
				"/api/v1/auth/refresh",
				isCookieRefreshEnabled ? {} : { refresh_token: rt },
				isCookieRefreshEnabled ? { withCredentials: true } : undefined,
			);
			authSessionStore.setAccessToken(data.token);
			tokenStorage.setToken(data.token);
			const nextRt = data.refreshToken ?? data.refresh_token ?? null;
			if (isCookieRefreshEnabled) {
				tokenStorage.setRefreshToken(null);
			} else {
				tokenStorage.setRefreshToken(nextRt);
			}
			const active = tokenStorage.getActiveProfile();
			if (active) {
				tokenStorage.upsertProfile({
					label: active.label,
					email: active.email,
					userId: active.userId,
				});
			}
			cfg.headers.Authorization = `Bearer ${data.token}`;
			return httpClient(cfg);
		} catch {
			authSessionStore.clear();
			tokenStorage.clear();
			return Promise.reject(error);
		}
	},
);
