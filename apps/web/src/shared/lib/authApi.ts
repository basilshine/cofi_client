import type { ProfileUpdateRequest, User } from "@cofi/api";
import {
	authSessionStore,
	isCookieRefreshEnabled,
	warnLegacyTokenStorageIfNeeded,
} from "./authSessionStore";
import { httpClient } from "./httpClient";
import { tokenStorage } from "./tokenStorage";

export type AuthUser = User;

export type AuthResponse = {
	token: string;
	refreshToken?: string;
	refresh_token?: string;
	user: AuthUser;
};

export type LoginRequest = { email: string; password: string };
export type RegisterRequest = {
	email: string;
	password: string;
	name: string;
	country: string;
	language: string;
};

export type VerifyEmailCodeRequest = {
	email: string;
	code: string;
};

export const authApi = {
	login: async (payload: LoginRequest) => {
		const res = await httpClient.post<AuthResponse>(
			"/api/v1/auth/login",
			payload,
		);
		tokenStorage.upsertProfile({
			label: res.data.user.email ?? payload.email,
			email: res.data.user.email ?? payload.email,
			userId: res.data.user.id,
		});
		const nextRt = res.data.refreshToken ?? res.data.refresh_token ?? null;
		if (isCookieRefreshEnabled) {
			tokenStorage.setRefreshToken(null);
		} else {
			tokenStorage.setRefreshToken(nextRt);
		}
		authSessionStore.setAccessToken(res.data.token);
		// Persist access token so reload can hydrate (`refreshUser`) before silent refresh runs.
		tokenStorage.setToken(res.data.token);
		warnLegacyTokenStorageIfNeeded();
		return res.data;
	},
	register: async (payload: RegisterRequest) => {
		const res = await httpClient.post<AuthResponse>(
			"/api/v1/auth/register",
			payload,
		);
		return res.data;
	},
	requestEmailCode: async (email: string) => {
		await httpClient.post("/api/v1/auth/email/code/request", { email });
	},
	confirmEmailCode: async (payload: VerifyEmailCodeRequest) => {
		await httpClient.post("/api/v1/auth/email/code/confirm", payload);
	},
	me: async () => {
		const res = await httpClient.get<AuthUser>("/api/v1/auth/me");
		return res.data;
	},
	updateProfile: async (payload: ProfileUpdateRequest) => {
		const res = await httpClient.put<AuthUser>("/api/v1/auth/profile", payload);
		return res.data;
	},
	refresh: async () => {
		const rt = tokenStorage.getRefreshToken();
		if (!rt && !isCookieRefreshEnabled) {
			throw new Error("No refresh token");
		}
		const res = await httpClient.post<AuthResponse>(
			"/api/v1/auth/refresh",
			isCookieRefreshEnabled ? {} : { refresh_token: rt },
			isCookieRefreshEnabled ? { withCredentials: true } : undefined,
		);
		const access = res.data.token;
		const nextRt = res.data.refreshToken ?? res.data.refresh_token ?? null;
		authSessionStore.setAccessToken(access);
		tokenStorage.setToken(access);
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
		return res.data;
	},
	logout: () => {
		void httpClient.post(
			"/api/v1/auth/logout",
			{},
			isCookieRefreshEnabled ? { withCredentials: true } : undefined,
		);
		authSessionStore.clear();
		tokenStorage.clear();
	},
};
