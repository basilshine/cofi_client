import { httpClient } from "../../shared/lib/httpClient";
import { tokenStorage } from "../../shared/lib/tokenStorage";

export type AuthUser = {
	id: number;
	email?: string;
	name?: string;
	auth_type?: string;
	country?: string;
	language?: string;
};

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
		const res = await httpClient.post<AuthResponse>("/api/v1/auth/login", payload);
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
	logout: () => {
		tokenStorage.clear();
	},
};

