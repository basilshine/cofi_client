import { apiService } from "../api";
import type { components } from "@/types/api-types";
import LogRocket from "logrocket";
import { useAuthStore } from "@/store/useStore";

export const expensesService = {
  getExpenses: async () => {
    try {
      LogRocket.log("[expensesService.getExpenses] Starting request");
      const response = await apiService.expenses.list();
      LogRocket.log("[expensesService.getExpenses] Success:", {
        count: response.data?.length || 0,
        data: response.data,
      });
      return response.data as components["schemas"]["Expense"][];
    } catch (error) {
      LogRocket.error("[expensesService.getExpenses] Failed:", error);
      throw error;
    }
  },

  getDraftExpenses: async () => {
    try {
      LogRocket.log("[expensesService.getDraftExpenses] Starting request");
      const expenses = await expensesService.getExpenses();
      const drafts = expenses.filter((expense) => expense.status === "draft");
      LogRocket.log("[expensesService.getDraftExpenses] Success:", {
        count: drafts.length,
      });
      return drafts;
    } catch (error) {
      LogRocket.error("[expensesService.getDraftExpenses] Failed:", error);
      throw error;
    }
  },

  getExpenseById: async (id: string) => {
    try {
      LogRocket.log("[expensesService.getExpenseById] Starting request for ID:", id);
      const response = await apiService.expenses.getById(id);
      LogRocket.log("[expensesService.getExpenseById] Success:", response.data);
      return response.data as components["schemas"]["Expense"];
    } catch (error) {
      LogRocket.error("[expensesService.getExpenseById] Failed:", error);
      throw error;
    }
  },

  createExpense: async (expense: Omit<components["schemas"]["Expense"], "id" | "userId">) => {
    try {
      LogRocket.log("[expensesService.createExpense] Starting request:", expense);
      const { user } = useAuthStore.getState();
      const userId = user?.id;
      if (!userId) {
        const error = "User not authenticated";
        LogRocket.error("[expensesService.createExpense] Error:", error);
        throw new Error(error);
      }
      const expenseWithUserId = {
        ...expense,
        userId: Number(userId),
      };
      LogRocket.log("[expensesService.createExpense] Payload:", expenseWithUserId);
      const response = await apiService.expenses.create(expenseWithUserId);
      LogRocket.log("[expensesService.createExpense] Success:", response.data);
      return response.data as components["schemas"]["Expense"];
    } catch (error) {
      LogRocket.error("[expensesService.createExpense] Failed:", error);
      throw error;
    }
  },

  updateExpense: async (id: string, expense: Partial<components["schemas"]["Expense"]>) => {
    try {
      LogRocket.log("[expensesService.updateExpense] Starting request:", { id, expense });
      const response = await apiService.expenses.update(id, expense);
      LogRocket.log("[expensesService.updateExpense] Success:", response.data);
      return response.data as components["schemas"]["Expense"];
    } catch (error) {
      LogRocket.error("[expensesService.updateExpense] Failed:", error);
      throw error;
    }
  },

  deleteExpense: async (id: string) => {
    try {
      LogRocket.log("[expensesService.deleteExpense] Starting request for ID:", id);
      await apiService.expenses.delete(id);
      LogRocket.log("[expensesService.deleteExpense] Success");
    } catch (error) {
      LogRocket.error("[expensesService.deleteExpense] Failed:", error);
      throw error;
    }
  },

  approveExpense: async (expenseId: string) => {
    const { user } = useAuthStore.getState();
    const userId = user?.id;
    if (!userId) throw new Error("User not authenticated");
    const response = await apiService.expenses.approve({ user_id: Number(userId), expense_id: Number(expenseId) });
    if (response.status !== 200) {
      throw new Error("Failed to approve expense");
    }
    return response.data;
  },

  cancelExpense: async (expenseId: string) => {
    const { user } = useAuthStore.getState();
    const userId = user?.id;
    if (!userId) throw new Error("User not authenticated");
    const response = await apiService.expenses.cancel({ user_id: Number(userId), expense_id: Number(expenseId) });
    if (response.status !== 200) {
      throw new Error("Failed to cancel expense");
    }
    return response.data;
  },

  getSummary: async (userId: number) => {
    try {
      LogRocket.log("[expensesService.getSummary] Starting request", { userId });
      const response = await apiService.analytics.summary(userId);
      LogRocket.log("[expensesService.getSummary] Success:", response.data);
      return response.data as components["schemas"]["ExpenseSummary"];
    } catch (error) {
      LogRocket.error("[expensesService.getSummary] Failed:", error);
      throw error;
    }
  },

  getMostUsedCategories: async () => {
    try {
      LogRocket.log("[expensesService.getMostUsedCategories] Starting request");
      const response = await apiService.expenses.mostUsedCategories();
      LogRocket.log("[expensesService.getMostUsedCategories] Success:", response.data);
      return response.data as components["schemas"]["Category"][];
    } catch (error) {
      LogRocket.error("[expensesService.getMostUsedCategories] Failed:", error);
      throw error;
    }
  },
};
