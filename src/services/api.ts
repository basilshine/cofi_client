import type { components, paths } from "@/types/api-types";
import { useAuthStore } from "@store/useStore";
import axios from "axios";
import type { AxiosResponse } from "axios";
import LogRocket from "logrocket";
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
	expenses: "/api/v1/finances/expenses" as const,
	categories: "/api/v1/finances/categories" as const,
	analyticsSummary: "/api/v1/analytics/stats/summary" as const,
};

const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	headers: {
		"Content-Type": "application/json",
	},
});

// Log API base URL to LogRocket and console
try {
	LogRocket.log("[API] Base URL:", import.meta.env.VITE_API_URL);
} catch (e) {
	// LogRocket not available or not initialized
	console.log("[API] Base URL:", import.meta.env.VITE_API_URL);
}

// Request interceptor with logging
api.interceptors.request.use(
	(config) => {
		const token = useAuthStore.getState().token;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		// Log all outgoing requests
		try {
			LogRocket.log("[API Request]", {
				method: config.method?.toUpperCase(),
				url: config.url,
				baseURL: config.baseURL,
				headers: config.headers,
				data: config.data,
				params: config.params,
			});
		} catch (e) {
			console.log("[API Request]", config.method?.toUpperCase(), config.url);
		}

		return config;
	},
	(error) => {
		try {
			LogRocket.error("[API Request Error]", error);
		} catch (e) {
			console.error("[API Request Error]", error);
		}
		return Promise.reject(error);
	},
);

// Response interceptor with logging
api.interceptors.response.use(
	(response) => {
		// Log successful responses
		try {
			LogRocket.log("[API Response Success]", {
				status: response.status,
				statusText: response.statusText,
				url: response.config.url,
				data: response.data,
			});
		} catch (e) {
			console.log(
				"[API Response Success]",
				response.status,
				response.config.url,
			);
		}
		return response;
	},
	(error) => {
		// Log error responses
		try {
			LogRocket.error("[API Response Error]", {
				status: error.response?.status,
				statusText: error.response?.statusText,
				url: error.config?.url,
				data: error.response?.data,
				message: error.message,
			});
		} catch (e) {
			console.error(
				"[API Response Error]",
				error.response?.status,
				error.config?.url,
				error.message,
			);
		}
		return Promise.reject(error);
	},
);

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
		}): Promise<AxiosResponse<TelegramLoginResponse>> => {
			LogRocket.log(
				"[apiService.auth.telegramLogin] Sending Telegram login request:",
				data,
			);
			return api
				.post<TelegramLoginResponse>("/api/v1/auth/telegram", data)
				.then((res) => {
					LogRocket.log("[apiService.auth.telegramLogin] Response:", res.data);
					return res;
				})
				.catch((err) => {
					LogRocket.error("[apiService.auth.telegramLogin] Error:", err);
					throw err;
				});
		},
		telegramOAuthCallback: (data: {
			telegramInitData: string;
			user: TelegramUser;
		}) => {
			return api.post<TelegramLoginResponse>(
				"/api/v1/auth/telegram/oauth-callback",
				data,
			);
		},
		telegramLoginWidget: (data: {
			telegram_id: number;
			username: string;
			first_name?: string;
			last_name?: string;
			photo_url?: string;
			auth_date: number;
			hash: string;
			language?: string;
			country?: string;
		}) => {
			return api.post<TelegramLoginResponse>(
				"/api/v1/auth/telegram/login",
				data,
			);
		},
	},
	expenses: {
		list: () => api.get<components["schemas"]["Expense"][]>(ENDPOINTS.expenses),
		create: (data: components["schemas"]["Expense"]) =>
			api.post<components["schemas"]["Expense"]>(ENDPOINTS.expenses, data),
		update: (id: string, data: unknown) =>
			api.put(`${ENDPOINTS.expenses}/${id}`, data),
		delete: (id: string) => api.delete(`${ENDPOINTS.expenses}/${id}`),
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
