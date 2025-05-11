import axios from 'axios';
import { useAuthStore } from '@store/useStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL + '/api/v1',
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
    login: (data: { email: string; password: string }) => { 
      console.log('data', data);
      return api.post('/auth/login', data);
    },
    register: (data: { email: string; password: string; name: string }) => {
      return api.post('/auth/register', data);
    },
    requestPasswordReset: (data: { email: string }) => {
      return api.post('/auth/request-password-reset', data);
    },
    resetPassword: (data: { token: string; newPassword: string }) => {
      return api.post('/auth/reset-password', data);
    },
  },
  expenses: {
    list: () => api.get('/expenses'),
    create: (data: {
      amount: number;
      category: string;
      description: string;
      date: string;
      userId: string;
    }) => api.post('/expenses', data),
    update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
    delete: (id: string) => api.delete(`/expenses/${id}`),
  },
  analytics: {
    monthly: () => api.get('/analytics/monthly'),
    categories: () => api.get('/analytics/categories'),
    trends: () => api.get('/analytics/trends'),
  },
}; 