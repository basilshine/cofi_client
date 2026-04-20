import type {
	ProfileUpdateRequest,
	User,
} from "../../../../../packages/api/src/types";
import { httpClient } from "../../shared/lib/httpClient";
import { tokenStorage } from "../../shared/lib/tokenStorage";

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
			accessToken: res.data.token,
			refreshToken: res.data.refreshToken ?? res.data.refresh_token ?? null,
		});
		return res.data;
	},
	register: async (payload: RegisterRequest) => {
		const res = await httpClient.post<AuthResponse>(
			"/api/v1/auth/register",
			payload,
		);
		tokenStorage.upsertProfile({
			label: res.data.user.email ?? payload.email,
			email: res.data.user.email ?? payload.email,
			userId: res.data.user.id,
			accessToken: res.data.token,
			refreshToken: res.data.refreshToken ?? res.data.refresh_token ?? null,
		});
		return res.data;
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
		if (!rt) {
			throw new Error("No refresh token");
		}
		const res = await httpClient.post<AuthResponse>("/api/v1/auth/refresh", {
			refresh_token: rt,
		});
		const access = res.data.token;
		const nextRt = res.data.refreshToken ?? res.data.refresh_token ?? null;
		tokenStorage.setToken(access);
		tokenStorage.setRefreshToken(nextRt);
		const active = tokenStorage.getActiveProfile();
		if (active) {
			tokenStorage.upsertProfile({
				label: active.label,
				email: active.email,
				userId: active.userId,
				accessToken: access,
				refreshToken: nextRt,
			});
		}
		return res.data;
	},
	logout: () => {
		tokenStorage.clear();
	},
};
