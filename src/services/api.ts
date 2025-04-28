import axios from 'axios';
import { useAuthStore } from '@store/useStore';
import type { paths, components } from '@/types/api-types';

const ENDPOINTS = {
	login: '/api/v1/auth/login' as const,
	register: '/api/v1/auth/register' as const,
	expenses: '/api/v1/expenses' as const,
	categories: '/api/v1/categories' as const,
	analyticsSummary: '/api/v1/analytics/stats/summary' as const,
};

const api = axios.create({
	baseURL: import.meta.env.VITE_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
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
		login: (data: components['schemas']['LoginRequest']) =>
			api.post<
				paths['/api/v1/auth/login']['post']['responses']['200']['content']['application/json']
			>(ENDPOINTS.login, data),
		register: (data: components['schemas']['RegisterRequest']) =>
			api.post<
				paths['/api/v1/auth/register']['post']['responses']['200']['content']['application/json']
			>(ENDPOINTS.register, data),
		requestPasswordReset: (data: { email: string }) => {
			return api.post('/auth/request-password-reset', data);
		},
		resetPassword: (data: { token: string; newPassword: string }) => {
			return api.post('/auth/reset-password', data);
		},
	},
	expenses: {
		list: () => api.get<components['schemas']['Expense'][]>(ENDPOINTS.expenses),
		create: (data: components['schemas']['Expense']) =>
			api.post<components['schemas']['Expense']>(ENDPOINTS.expenses, data),
		update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
		delete: (id: string) => api.delete(`/expenses/${id}`),
	},
	analytics: {
		summary: (userId: string, period?: string) =>
			api.get<
				paths['/api/v1/analytics/stats/summary']['get']['responses']['200']['content']['application/json']
			>(ENDPOINTS.analyticsSummary, {
				params: { user_id: userId, ...(period ? { period } : {}) },
			}),
	},
};
