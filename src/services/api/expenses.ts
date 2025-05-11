import { apiService } from '../api';
import { useAuthStore } from '@store/useStore';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  userId: string;
}

export interface ExpenseSummary {
  total: number;
  byCategory: Record<string, number>;
  monthlyAverage: number;
}

export interface MostUsedCategories {
  category: string;
  count: number;
}

export const expensesService = {
  getExpenses: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');
    
    const response = await apiService.expenses.list();
    return response.data as Expense[];
  },

  createExpense: async (expense: Omit<Expense, 'id' | 'userId'>) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');
    
    const expenseWithUserId = {
      ...expense,
      userId,
    };
    
    const response = await apiService.expenses.create(expenseWithUserId);
    return response.data as Expense;
  },

  getSummary: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');
    
    const response = await apiService.analytics.monthly();
    return response.data as ExpenseSummary;
  },

  getMostUsedCategories: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');
    
    const response = await apiService.analytics.categories();
    return response.data as MostUsedCategories[];
  },
}; 