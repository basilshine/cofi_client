import type { components, paths } from "@/types/api-types";
import { useAuthStore } from "@store/useStore";
import axios from "axios";
import type { AxiosResponse } from "axios";

interface TelegramUser {
	id: number;
	first_name: string;
	last_name?: string;
	username?: string;
}

export interface TelegramLoginResponse {
	token?: string;
	user?: {
		id?: string;
		email?: string;
		firstName?: string;
		lastName?: string;
		telegramId?: number;
		telegramUsername?: string;
		telegramPhotoUrl?: string;
	};
}

const ENDPOINTS = {
	login: "/api/v1/auth/login" as const,
	register: "/api/v1/auth/register" as const,
	expenses: "/api/v1/expenses" as const,
	categories: "/api/v1/categories" as const,
	analyticsSummary: "/api/v1/analytics/stats/summary" as const,
};

const api = axios.create({
	baseURL: import.meta.env.VITE_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

api.interceptors.request.use((config) => {
	const token = useAuthStore.getState().token;
	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}
	return config;
});

export const apiService = {
	auth: {
		login: (data: components["schemas"]["LoginRequest"]) =>
			api.post<
				paths["/api/v1/auth/login"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.login, data),
		register: (data: components["schemas"]["RegisterRequest"]) =>
			api.post<
				paths["/api/v1/auth/register"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.register, data),
		requestPasswordReset: (data: { email: string }) => {
			return api.post("/auth/request-password-reset", data);
		},
		resetPassword: (data: { token: string; newPassword: string }) => {
			return api.post("/auth/reset-password", data);
		},
		telegramLogin: (data: {
			telegramInitData: string;
			user: TelegramUser;
		}): Promise<AxiosResponse<TelegramLoginResponse>> =>
			api.post<TelegramLoginResponse>("/api/v1/auth/telegram", data),
	},
	expenses: {
		list: () => api.get<components["schemas"]["Expense"][]>(ENDPOINTS.expenses),
		create: (data: components["schemas"]["Expense"]) =>
			api.post<components["schemas"]["Expense"]>(ENDPOINTS.expenses, data),
		update: (id: string, data: unknown) => api.put(`/expenses/${id}`, data),
		delete: (id: string) => api.delete(`/expenses/${id}`),
	},
	analytics: {
		summary: (userId: string, period?: string) =>
			api.get<
				paths["/api/v1/analytics/stats/summary"]["get"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.analyticsSummary, {
				params: { user_id: userId, ...(period ? { period } : {}) },
			}),
	},
};
