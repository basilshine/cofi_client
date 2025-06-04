import { useAuthStore } from "@store/useStore";
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
	id: string;
	amount: number; // This will be calculated from items
	description: string;
	status: string; // "draft" | "approved" | "cancelled"
	userId: string;
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
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		const response = await apiService.expenses.list();
		return response.data as Expense[];
	},

	getDraftExpenses: async () => {
		const expenses = await expensesService.getExpenses();
		return expenses.filter((expense) => expense.status === "draft");
	},

	getExpenseById: async (id: string) => {
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		const token = useAuthStore.getState().token;
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/api/v1/finances/expenses/${id}`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			throw new Error("Failed to fetch expense");
		}

		const data = await response.json();
		return data as Expense;
	},

	createExpense: async (expense: Omit<Expense, "id" | "userId">) => {
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		const expenseWithUserId = {
			...expense,
			userId,
		};

		const response = await apiService.expenses.create(expenseWithUserId);
		return response.data as Expense;
	},

	updateExpense: async (id: string, expense: Partial<Expense>) => {
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		const response = await apiService.expenses.update(id, expense);
		return response.data as Expense;
	},

	deleteExpense: async (id: string) => {
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		await apiService.expenses.delete(id);
	},

	// Draft expense specific operations
	approveExpense: async (expenseId: string) => {
		const userId = useAuthStore.getState().user?.id;
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
					user_id: Number.parseInt(userId),
					expense_id: Number.parseInt(expenseId),
				}),
			},
		);

		if (!response.ok) {
			throw new Error("Failed to approve expense");
		}

		return response.json();
	},

	cancelExpense: async (expenseId: string) => {
		const userId = useAuthStore.getState().user?.id;
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
					user_id: Number.parseInt(userId),
					expense_id: Number.parseInt(expenseId),
				}),
			},
		);

		if (!response.ok) {
			throw new Error("Failed to cancel expense");
		}

		return response.json();
	},

	getSummary: async () => {
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		const response = await apiService.analytics.summary(userId);
		return response.data as ExpenseSummary;
	},

	getMostUsedCategories: async () => {
		const userId = useAuthStore.getState().user?.id;
		if (!userId) throw new Error("User not authenticated");

		try {
			// Try to get expenses and calculate categories from them
			const expenses = await expensesService.getExpenses();

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
			return Object.entries(categoryCount)
				.map(([category, count]) => ({ category, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 10); // Top 10 categories
		} catch (error) {
			console.error("Failed to get most used categories:", error);
			return [];
		}
	},
};
