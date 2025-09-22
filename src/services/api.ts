import type { components, paths } from "@/types/api-types";
import axios from "axios";
import LogRocket from "logrocket";

const ENDPOINTS = {
	login: "/api/v1/auth/login" as const,
	register: "/api/v1/auth/register" as const,
	me: "/api/v1/auth/me" as const,
	profile: "/api/v1/auth/profile" as const,
	refresh: "/api/v1/auth/refresh" as const,
	telegramLogin: "/api/v1/auth/telegram" as const,
	telegramLoginWidget: "/api/v1/auth/telegram/login" as const,
	telegramUpdate: "/api/v1/auth/telegram/update" as const,
	sync: "/api/v1/auth/sync" as const,
	passwordReset: "/api/v1/auth/password/reset" as const,
	passwordResetConfirm: "/api/v1/auth/password/reset/confirm" as const,
	parser: "/api/v1/parser" as const,
	parserImage: "/api/v1/parser/image" as const,
	expenses: "/api/v1/finances/expenses" as const,
	expenseById: (id: number | string) =>
		`/api/v1/finances/expenses/${id}` as const,
	expensesSummary: "/api/v1/finances/expenses/summary" as const,
	expensesApprove: "/api/v1/finances/expenses/approve" as const,
	expensesCancel: "/api/v1/finances/expenses/cancel" as const,
	expensesText: "/api/v1/finances/expenses/text" as const,
	expensesVoice: "/api/v1/finances/expenses/voice" as const,
	expensesTags: "/api/v1/finances/expenses/tags" as const,
	expensesMostUsedCategories:
		"/api/v1/finances/expenses/most-used-categories" as const,
	expensesMostUsedTags: "/api/v1/finances/expenses/most-used-tags" as const,
	categories: "/api/v1/finances/categories" as const,
	categoryById: (id: number | string) =>
		`/api/v1/finances/categories/${id}` as const,
	recurring: "/api/v1/finances/recurring" as const,
	recurringById: (id: number | string) =>
		`/api/v1/finances/recurring/${id}` as const,
	analyticsSummary: "/api/v1/analytics/stats/summary" as const,
	analyticsWeek: "/api/v1/analytics/stats/week" as const,
	analyticsMonth: "/api/v1/analytics/stats/month" as const,
	analyticsEmotions: "/api/v1/analytics/stats/emotions" as const,
	analyticsReports: "/api/v1/analytics/reports" as const,
	analyticsReportsSchedule: "/api/v1/analytics/reports/schedule" as const,
	reminders: "/api/v1/notify/reminders" as const,
	reminderById: (id: number | string) =>
		`/api/v1/notify/reminders/${id}` as const,
	notifications: "/api/v1/notify/notifications" as const,
	notificationById: (id: number | string) =>
		`/api/v1/notify/notifications/${id}` as const,
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
		console.log(
			"[API Debug] Token from localStorage:",
			token ? `${token.substring(0, 20)}...` : "null",
		);
		LogRocket.log(
			"[API Debug] Token from localStorage:",
			token ? `${token.substring(0, 20)}...` : "null",
		);

		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
			console.log(
				"[API Debug] Authorization header set:",
				`Bearer ${token.substring(0, 20)}...`,
			);
			LogRocket.log(
				"[API Debug] Authorization header set:",
				`Bearer ${token.substring(0, 20)}...`,
			);
		} else {
			console.log("[API Debug] No token found, no Authorization header set");
			LogRocket.log("[API Debug] No token found, no Authorization header set");
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
				headers: config.headers,
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
		telegramUpdate: (data: components["schemas"]["TelegramUpdateRequest"]) =>
			api.post<
				paths["/api/v1/auth/telegram/update"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.telegramUpdate, data),
		sync: (data: components["schemas"]["SyncUserRequest"]) =>
			api.post<
				paths["/api/v1/auth/sync"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.sync, data),
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
	parser: {
		parseText: (data: components["schemas"]["ParseRequest"]) =>
			api.post<
				paths["/api/v1/parser"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.parser, data),
		parseImage: (formData: FormData) =>
			api.post<
				paths["/api/v1/parser/image"]["post"]["responses"]["200"]["content"]["application/json"]
			>(ENDPOINTS.parserImage, formData, {
				headers: { "Content-Type": "multipart/form-data" },
			}),
	},
	expenses: {
		list: () => api.get<components["schemas"]["Expense"][]>(ENDPOINTS.expenses),
		create: (data: components["schemas"]["Expense"]) =>
			api.post<components["schemas"]["Expense"]>(ENDPOINTS.expenses, data),
		getById: (id: number | string) =>
			api.get<components["schemas"]["Expense"]>(ENDPOINTS.expenseById(id)),
		update: (
			id: number | string,
			data: Partial<components["schemas"]["Expense"]>,
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
		approve: (data: components["schemas"]["ApproveExpensesRequest"]) =>
			api.post<{ message?: string }>(ENDPOINTS.expensesApprove, data),
		cancel: (data: components["schemas"]["CancelDraftExpensesRequest"]) =>
			api.post<{ message?: string }>(ENDPOINTS.expensesCancel, data),
		createFromText: (data: { text?: string }) =>
			api.post<components["schemas"]["Expense"]>(ENDPOINTS.expensesText, data),
		createFromVoice: (formData: FormData) =>
			api.post<components["schemas"]["Expense"]>(
				ENDPOINTS.expensesVoice,
				formData,
				{
					headers: { "Content-Type": "multipart/form-data" },
				},
			),
		tags: (params?: { language?: string }) =>
			api.get<components["schemas"]["Tag"][]>(ENDPOINTS.expensesTags, {
				params,
			}),
		mostUsedCategories: () =>
			api.get<components["schemas"]["Category"][]>(
				ENDPOINTS.expensesMostUsedCategories,
			),
		mostUsedTags: () =>
			api.get<components["schemas"]["Tag"][]>(ENDPOINTS.expensesMostUsedTags),
	},
	categories: {
		list: () =>
			api.get<components["schemas"]["Category"][]>(ENDPOINTS.categories),
		create: (data: components["schemas"]["Category"]) =>
			api.post<components["schemas"]["Category"]>(ENDPOINTS.categories, data),
		getById: (id: number | string) =>
			api.get<components["schemas"]["Category"]>(ENDPOINTS.categoryById(id)),
		update: (
			id: number | string,
			data: Partial<components["schemas"]["Category"]>,
		) =>
			api.put<components["schemas"]["Category"]>(
				ENDPOINTS.categoryById(id),
				data,
			),
		delete: (id: number | string) => api.delete(ENDPOINTS.categoryById(id)),
	},
	recurring: {
		list: () =>
			api.get<components["schemas"]["RecurringExpense"][]>(ENDPOINTS.recurring),
		create: (data: components["schemas"]["RecurringExpense"]) =>
			api.post<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurring,
				data,
			),
		getById: (id: number | string) =>
			api.get<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurringById(id),
			),
		update: (
			id: number | string,
			data: Partial<components["schemas"]["RecurringExpense"]>,
		) =>
			api.put<components["schemas"]["RecurringExpense"]>(
				ENDPOINTS.recurringById(id),
				data,
			),
		delete: (id: number | string) => api.delete(ENDPOINTS.recurringById(id)),
	},
	analytics: {
		summary: (user_id: number) =>
			api.get<components["schemas"]["AnalyticsSummary"]>(
				ENDPOINTS.analyticsSummary,
				{ params: { user_id } },
			),
		week: (user_id: number) =>
			api.get<components["schemas"]["AnalyticsSummary"]>(
				ENDPOINTS.analyticsWeek,
				{ params: { user_id } },
			),
		month: (user_id: number) =>
			api.get<components["schemas"]["AnalyticsSummary"]>(
				ENDPOINTS.analyticsMonth,
				{ params: { user_id } },
			),
		emotions: (user_id: number) =>
			api.get<{
				emotions?: Record<string, unknown>;
				most_common?: string;
				regret_amount?: number;
			}>(ENDPOINTS.analyticsEmotions, { params: { user_id } }),
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
};
