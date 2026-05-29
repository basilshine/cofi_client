import type { components, paths } from "@/types/api-types";
import axios from "axios";
import LogRocket from "logrocket";

const ENDPOINTS = {
	login: "/api/v1/auth/login" as const,
	register: "/api/v1/auth/register" as const,
	me: "/api/v1/auth/me" as const,
	profile: "/api/v1/auth/profile" as const,
	deleteData: "/api/v1/auth/data" as const,
	refresh: "/api/v1/auth/refresh" as const,
	telegramLogin: "/api/v1/auth/telegram" as const,
	telegramLoginWidget: "/api/v1/auth/telegram/login" as const,
	passwordReset: "/api/v1/auth/password/reset" as const,
	passwordResetConfirm: "/api/v1/auth/password/reset/confirm" as const,
	expenses: "/api/v1/finances/expenses" as const,
	expenseById: (id: number | string) =>
		`/api/v1/finances/expenses/${id}` as const,
	expensesSummary: "/api/v1/finances/expenses/summary" as const,
	expensesTags: "/api/v1/finances/expenses/tags" as const,
	vendors: "/api/v1/finances/vendors" as const,
	recurring: "/api/v1/finances/recurring" as const,
	recurringById: (id: number | string) =>
		`/api/v1/finances/recurring/${id}` as const,
	recurringPause: (id: number | string) =>
		`/api/v1/finances/recurring/${id}/pause` as const,
	recurringResume: (id: number | string) =>
		`/api/v1/finances/recurring/${id}/resume` as const,
	analyticsSummary: "/api/v1/analytics/stats/summary" as const,
	analyticsReports: "/api/v1/analytics/reports" as const,
	analyticsReportsSchedule: "/api/v1/analytics/reports/schedule" as const,
	reminders: "/api/v1/notify/reminders" as const,
	reminderById: (id: number | string) =>
		`/api/v1/notify/reminders/${id}` as const,
	notifications: "/api/v1/notify/notifications" as const,
	notificationById: (id: number | string) =>
		`/api/v1/notify/notifications/${id}` as const,
	testMessage: "/api/v1/notify/test-message" as const,
	sendMessage: "/api/v1/notify/send-message" as const,
	deleteMessage: "/api/v1/notify/delete-message" as const,
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
		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		// Log all outgoing requests
		try {
			LogRocket.log("[API Request]", {
				method: config.method?.toUpperCase(),
				url: config.url,
				baseURL: config.baseURL,
				data: config.data,
				params: config.params,
				hasAuthHeader: !!config.headers.Authorization,
			});
		} catch (e) {
			console.log(
				"[API Request]",
				config.method?.toUpperCase(),
				config.url,
				"Auth:",
				!!config.headers.Authorization,
			);
			LogRocket.log("[API Request]", {
				method: config.method?.toUpperCase(),
				url: config.url,
				baseURL: config.baseURL,
				data: config.data,
				params: config.params,
				hasAuthHeader: !!config.headers.Authorization,
			});
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
			LogRocket.log("[API Response Success]", {
				status: response.status,
				statusText: response.statusText,
				url: response.config.url,
				data: response.data,
			});
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
			LogRocket.error("[API Response Error]", {
				status: error.response?.status,
				statusText: error.response?.statusText,
				url: error.config?.url,
				data: error.response?.data,
				message: error.message,
			});
		}
		return Promise.reject(error);
	},
);

// Profile update request type
export type ProfileUpdateRequest = {
	email: string;
	name: string;
	country: string;
	language: string;
	timezone: string;
	currency: string;
	dateFormat: string;
	emailNotifications: boolean;
	darkMode: boolean;
};

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
		me: () => api.get<components["schemas"]["User"]>(ENDPOINTS.me),
		updateProfile: (data: ProfileUpdateRequest) =>
			api.put<components["schemas"]["User"]>(ENDPOINTS.profile, data),
		deleteAllData: () => api.delete<{ message: string }>(ENDPOINTS.deleteData),
		refresh: (data: { refreshToken?: string }) =>
			api.post<
				paths["/api/v1/auth/refresh"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.refresh, data),
		telegramLogin: (
			data: components["schemas"]["TelegramWebAppLoginRequest"],
		) =>
			api.post<
				paths["/api/v1/auth/telegram"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.telegramLogin, data),
		telegramLoginWidget: (
			data: components["schemas"]["TelegramLoginRequest"],
		) =>
			api.post<
				paths["/api/v1/auth/telegram/login"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.telegramLoginWidget, data),
		passwordReset: (data: components["schemas"]["ResetPasswordRequest"]) =>
			api.post<
				paths["/api/v1/auth/password/reset"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.passwordReset, data),
		passwordResetConfirm: (
			data: components["schemas"]["ResetPasswordConfirmRequest"],
		) =>
			api.post<
				paths["/api/v1/auth/password/reset/confirm"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.passwordResetConfirm, data),
	},
	expenses: {
		list: () => api.get<components["schemas"]["Expense"][]>(ENDPOINTS.expenses),
		listWithFilters: (url: string) => api.get(url),
		create: (data: components["schemas"]["Expense"]) =>
			api.post<components["schemas"]["Expense"]>(ENDPOINTS.expenses, data),
		getById: (id: number | string) =>
			api.get<components["schemas"]["Expense"]>(ENDPOINTS.expenseById(id)),
		update: (
			id: number | string,
			data: components["schemas"]["ExpensePatch"],
		) =>
			api.put<components["schemas"]["Expense"]>(
				ENDPOINTS.expenseById(id),
				data,
			),
		delete: (id: number | string) => api.delete(ENDPOINTS.expenseById(id)),
		summary: () =>
			api.get<components["schemas"]["ExpenseSummary"]>(
				ENDPOINTS.expensesSummary,
			),
		tags: (params?: { language?: string }) =>
			api.get<components["schemas"]["Tag"][]>(ENDPOINTS.expensesTags, {
				params,
			}),
	},
	vendors: {
		list: (params?: { space_id?: number }) =>
			api.get<components["schemas"]["Vendor"][]>(ENDPOINTS.vendors, {
				params,
			}),
		create: (data: { name: string; space_id?: number }) =>
			api.post<components["schemas"]["Vendor"]>(ENDPOINTS.vendors, data),
	},
	recurring: {
		list: () =>
			api.get<components["schemas"]["RecurringExpense"][]>(ENDPOINTS.recurring),
		create: (data: components["schemas"]["RecurringExpense"]) => {
			const { tagLabel, ...rest } = data;
			return api.post<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurring,
				{
					...rest,
					tag_label: tagLabel ?? "recurring",
				},
			);
		},
		getById: (id: number | string) =>
			api.get<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurringById(id),
			),
		update: (
			id: number | string,
			data: Partial<components["schemas"]["RecurringExpense"]>,
		) => {
			const { tagLabel, ...rest } = data;
			const body: Record<string, unknown> = { ...rest };
			if (tagLabel !== undefined) {
				body.tag_label = tagLabel;
			}
			return api.put<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurringById(id),
				body,
			);
		},
		pause: (id: number | string) =>
			api.post<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurringPause(id),
			),
		resume: (id: number | string) =>
			api.post<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurringResume(id),
			),
	},
	analytics: {
		summary: (period?: string, format?: string, userId?: string) =>
			api.get<Record<string, unknown>>(ENDPOINTS.analyticsSummary, {
				params: {
					period: period || "week",
					format: format || "json",
					...(userId ? { user_id: userId } : {}),
				},
			}),
		reports: () =>
			api.get<components["schemas"]["ReportSchedule"][]>(
				ENDPOINTS.analyticsReports,
			),
		createReport: (data: components["schemas"]["ReportSchedule"]) =>
			api.post<components["schemas"]["ReportSchedule"]>(
				ENDPOINTS.analyticsReports,
				data,
			),
		scheduleReport: (data: components["schemas"]["ReportSchedule"]) =>
			api.post<components["schemas"]["ReportSchedule"]>(
				ENDPOINTS.analyticsReportsSchedule,
				data,
			),
	},
	reminders: {
		list: () =>
			api.get<components["schemas"]["Reminder"][]>(ENDPOINTS.reminders),
		create: (data: components["schemas"]["Reminder"]) =>
			api.post<components["schemas"]["Reminder"]>(ENDPOINTS.reminders, data),
		getById: (id: number | string) =>
			api.get<components["schemas"]["Reminder"]>(ENDPOINTS.reminderById(id)),
		update: (
			id: number | string,
			data: Partial<components["schemas"]["Reminder"]>,
		) =>
			api.put<components["schemas"]["Reminder"]>(
				ENDPOINTS.reminderById(id),
				data,
			),
		delete: (id: number | string) => api.delete(ENDPOINTS.reminderById(id)),
	},
	notifications: {
		list: () =>
			api.get<components["schemas"]["Notification"][]>(ENDPOINTS.notifications),
		create: (data: components["schemas"]["Notification"]) =>
			api.post<components["schemas"]["Notification"]>(
				ENDPOINTS.notifications,
				data,
			),
		getById: (id: number | string) =>
			api.get<components["schemas"]["Notification"]>(
				ENDPOINTS.notificationById(id),
			),
		update: (
			id: number | string,
			data: Partial<components["schemas"]["Notification"]>,
		) =>
			api.put<components["schemas"]["Notification"]>(
				ENDPOINTS.notificationById(id),
				data,
			),
		delete: (id: number | string) => api.delete(ENDPOINTS.notificationById(id)),
	},
	notify: {
		testMessage: (data: { chat_id: number; message?: string }) =>
			api.post<{ success: boolean; message: string; chat_id: number }>(
				ENDPOINTS.testMessage,
				data,
			),
		sendMessage: (data: { chat_id: number; text: string }) =>
			api.post<{ success: boolean; message: string }>(
				ENDPOINTS.sendMessage,
				data,
			),
		deleteMessage: (data: { chat_id: number; message_id: number }) =>
			api.post<{
				success: boolean;
				message: string;
				chat_id: number;
				message_id: number;
			}>(ENDPOINTS.deleteMessage, data),
	},
};
