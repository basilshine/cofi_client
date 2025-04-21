import axios from 'axios';
import { useAuthStore } from '@store/useStore';

const api = axios.create({
  baseURL: '/api/v1',
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
    login: (data: { email: string; password: string }) =>
      api.post('/auth/login', data),
    register: (data: { email: string; password: string; name: string }) =>
      api.post('/auth/register', data),
  },
  expenses: {
    list: () => api.get('/expenses'),
    create: (data: {
      amount: number;
      category: string;
      description: string;
      date: string;
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