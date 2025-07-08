import { useAuthStore, useIsAuthorized } from "@store/useStore";
import LogRocket from "logrocket";
import { apiService } from "../api";

export interface ExpenseItem {
	id?: number;
	amount: number;
	name: string;
	categoryId?: number;
	category?: {
		id: number;
		name: string;
	};
	emotion?: string;
	expenseDate?: string;
}

export interface Expense {
	id: number;
	amount: number; // This will be calculated from items
	description: string;
	status: string; // "draft" | "approved" | "cancelled"
	userId: number;
	items: ExpenseItem[];
	createdAt?: string;
	updatedAt?: string;
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
		try {
			LogRocket.log("[expensesService.getExpenses] Starting request");

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.getExpenses] Error:", error);
				throw new Error(error);
			}

			LogRocket.log("[expensesService.getExpenses] User ID:", userId);

			const response = await apiService.expenses.list();

			LogRocket.log("[expensesService.getExpenses] Success:", {
				count: response.data?.length || 0,
				data: response.data,
			});

			return response.data as Expense[];
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
			LogRocket.log(
				"[expensesService.getExpenseById] Starting request for ID:",
				id,
			);

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.getExpenseById] Error:", error);
				throw new Error(error);
			}

			const token = useAuthStore.getState().token;
			const url = `${import.meta.env.VITE_API_URL}/api/v1/finances/expenses/${id}`;

			LogRocket.log("[expensesService.getExpenseById] Making request to:", url);

			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			LogRocket.log(
				"[expensesService.getExpenseById] Response status:",
				response.status,
			);

			if (!response.ok) {
				const errorText = await response.text();
				LogRocket.error("[expensesService.getExpenseById] HTTP Error:", {
					status: response.status,
					statusText: response.statusText,
					body: errorText,
				});
				throw new Error(
					`Failed to fetch expense: ${response.status} ${response.statusText}`,
				);
			}

			const data = await response.json();
			LogRocket.log("[expensesService.getExpenseById] Success:", data);
			return data as Expense;
		} catch (error) {
			LogRocket.error("[expensesService.getExpenseById] Failed:", error);
			throw error;
		}
	},

	createExpense: async (expense: Omit<Expense, "id" | "userId">) => {
		try {
			LogRocket.log(
				"[expensesService.createExpense] Starting request:",
				expense,
			);

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.createExpense] Error:", error);
				throw new Error(error);
			}

			const expenseWithUserId = {
				...expense,
				userId,
			};

			LogRocket.log(
				"[expensesService.createExpense] Payload:",
				expenseWithUserId,
			);

			const response = await apiService.expenses.create(expenseWithUserId);

			LogRocket.log("[expensesService.createExpense] Success:", response.data);
			return response.data as Expense;
		} catch (error) {
			LogRocket.error("[expensesService.createExpense] Failed:", error);
			throw error;
		}
	},

	updateExpense: async (id: string, expense: Partial<Expense>) => {
		try {
			LogRocket.log("[expensesService.updateExpense] Starting request:", {
				id,
				expense,
			});

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.updateExpense] Error:", error);
				throw new Error(error);
			}

			const response = await apiService.expenses.update(id, expense);

			LogRocket.log("[expensesService.updateExpense] Success:", response.data);
			return response.data as Expense;
		} catch (error) {
			LogRocket.error("[expensesService.updateExpense] Failed:", error);
			throw error;
		}
	},

	deleteExpense: async (id: string) => {
		try {
			LogRocket.log(
				"[expensesService.deleteExpense] Starting request for ID:",
				id,
			);

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.deleteExpense] Error:", error);
				throw new Error(error);
			}

			await apiService.expenses.delete(id);
			LogRocket.log("[expensesService.deleteExpense] Success");
		} catch (error) {
			LogRocket.error("[expensesService.deleteExpense] Failed:", error);
			throw error;
		}
	},

	// Draft expense specific operations
	approveExpense: async (expenseId: string) => {
		const isAuthorized = useIsAuthorized();
		const { user } = useAuthStore.getState();
		const userId = isAuthorized ? Number(user?.id) : undefined;
		if (!userId) throw new Error("User not authenticated");

		const token = useAuthStore.getState().token;
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/api/v1/finances/expenses/approve`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					user_id: userId,
					expense_id: Number(expenseId),
				}),
			},
		);

		if (!response.ok) {
			throw new Error("Failed to approve expense");
		}

		return response.json();
	},

	cancelExpense: async (expenseId: string) => {
		const isAuthorized = useIsAuthorized();
		const { user } = useAuthStore.getState();
		const userId = isAuthorized ? Number(user?.id) : undefined;
		if (!userId) throw new Error("User not authenticated");

		const token = useAuthStore.getState().token;
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/api/v1/finances/expenses/cancel`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					user_id: userId,
					expense_id: Number(expenseId),
				}),
			},
		);

		if (!response.ok) {
			throw new Error("Failed to cancel expense");
		}

		return response.json();
	},

	getSummary: async () => {
		try {
			LogRocket.log("[expensesService.getSummary] Starting request");

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.getSummary] Error:", error);
				throw new Error(error);
			}

			LogRocket.log("[expensesService.getSummary] User ID:", userId);

			const response = await apiService.analytics.summary(userId);

			LogRocket.log("[expensesService.getSummary] Success:", response.data);
			return response.data as ExpenseSummary;
		} catch (error) {
			LogRocket.error("[expensesService.getSummary] Failed:", error);
			throw error;
		}
	},

	getMostUsedCategories: async () => {
		try {
			LogRocket.log("[expensesService.getMostUsedCategories] Starting request");

			const isAuthorized = useIsAuthorized();
			const { user } = useAuthStore.getState();
			const userId = isAuthorized ? Number(user?.id) : undefined;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error(
					"[expensesService.getMostUsedCategories] Error:",
					error,
				);
				throw new Error(error);
			}

			// Try to get expenses and calculate categories from them
			const expenses = await expensesService.getExpenses();
			LogRocket.log(
				"[expensesService.getMostUsedCategories] Retrieved expenses:",
				{ count: expenses.length },
			);

			// Group by categories and count from items
			const categoryCount: Record<string, number> = {};

			for (const expense of expenses) {
				if (expense.items) {
					for (const item of expense.items) {
						const categoryName = item.category?.name || "Uncategorized";
						categoryCount[categoryName] =
							(categoryCount[categoryName] || 0) + 1;
					}
				}
			}

			// Convert to array and sort by count
			const result = Object.entries(categoryCount)
				.map(([category, count]) => ({ category, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10); // Top 10 categories

			LogRocket.log("[expensesService.getMostUsedCategories] Success:", result);
			return result;
		} catch (error) {
			LogRocket.error("[expensesService.getMostUsedCategories] Failed:", error);
			return [];
		}
	},
};
