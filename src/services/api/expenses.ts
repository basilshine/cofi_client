import { useAuthStore } from "@/store/useStore";
import type { components } from "@/types/api-types";
import { pickExpenseSummaryNumbers } from "@/utils/expenseTags";
import LogRocket from "logrocket";
import { apiService } from "../api";

// Expense filtering and pagination types
export interface ExpenseFilters {
	/** Tag name to filter (backend query param remains `category`). */
	tag?: string;
	emotion?: string;
	dateRange?: string;
	search?: string;
	page?: number;
	limit?: number;
}

export interface PaginatedExpensesResponse {
	expenses: components["schemas"]["Expense"][];
	total_count: number;
	page: number;
	limit: number;
	has_more: boolean;
}

export interface PaginatedExpenseItemsResponse {
	expense_items: components["schemas"]["ExpenseItem"][];
	total_count: number;
	page: number;
	limit: number;
	has_more: boolean;
}

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

	getExpensesWithFilters: async (
		filters: ExpenseFilters,
	): Promise<PaginatedExpensesResponse> => {
		try {
			LogRocket.log(
				"[expensesService.getExpensesWithFilters] Starting request",
				filters,
			);

			// Create query parameters
			const params = new URLSearchParams();
			if (filters.tag) params.append("category", filters.tag);
			if (filters.emotion) params.append("emotion", filters.emotion);
			if (filters.dateRange) params.append("date_range", filters.dateRange);
			if (filters.search) params.append("search", filters.search);
			if (filters.page) params.append("page", filters.page.toString());
			if (filters.limit) params.append("limit", filters.limit.toString());

			const url = `/api/v1/finances/expenses?${params.toString()}`;
			const response = await apiService.expenses.listWithFilters(url);

			LogRocket.log(
				"[expensesService.getExpensesWithFilters] Success:",
				response.data,
			);
			return response.data as PaginatedExpensesResponse;
		} catch (error) {
			LogRocket.error(
				"[expensesService.getExpensesWithFilters] Failed:",
				error,
			);
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
			const response = await apiService.expenses.getById(id);
			LogRocket.log("[expensesService.getExpenseById] Success:", response.data);
			return response.data as components["schemas"]["Expense"];
		} catch (error) {
			LogRocket.error("[expensesService.getExpenseById] Failed:", error);
			throw error;
		}
	},

	createExpense: async (
		expense: Omit<components["schemas"]["Expense"], "id" | "user_id">,
	) => {
		try {
			LogRocket.log(
				"[expensesService.createExpense] Starting request:",
				expense,
			);
			const { user } = useAuthStore.getState();
			const userId = user?.id;
			if (!userId) {
				const error = "User not authenticated";
				LogRocket.error("[expensesService.createExpense] Error:", error);
				throw new Error(error);
			}
			const expenseWithUserId = {
				...expense,
				user_id: Number(userId),
			};
			LogRocket.log(
				"[expensesService.createExpense] Payload:",
				expenseWithUserId,
			);
			const response = await apiService.expenses.create(expenseWithUserId);
			LogRocket.log("[expensesService.createExpense] Success:", response.data);
			return response.data as components["schemas"]["Expense"];
		} catch (error) {
			LogRocket.error("[expensesService.createExpense] Failed:", error);
			throw error;
		}
	},

	updateExpense: async (
		id: string,
		expense: components["schemas"]["ExpensePatch"],
	) => {
		try {
			LogRocket.log("[expensesService.updateExpense] Starting request:", {
				id,
				expense,
			});
			const response = await apiService.expenses.update(id, expense);
			LogRocket.log("[expensesService.updateExpense] Success:", response.data);
			return response.data as components["schemas"]["Expense"];
		} catch (error) {
			LogRocket.error("[expensesService.updateExpense] Failed:", error);
			throw error;
		}
	},

	listVendors: async (spaceId?: number) => {
		const response = await apiService.vendors.list(
			spaceId !== undefined ? { space_id: spaceId } : undefined,
		);
		return response.data as components["schemas"]["Vendor"][];
	},

	createVendor: async (name: string, spaceId?: number) => {
		const response = await apiService.vendors.create({
			name,
			...(spaceId !== undefined ? { space_id: spaceId } : {}),
		});
		return response.data as components["schemas"]["Vendor"];
	},

	deleteExpense: async (id: string) => {
		try {
			LogRocket.log(
				"[expensesService.deleteExpense] Starting request for ID:",
				id,
			);
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
		const response = await apiService.expenses.approve({
			user_id: Number(userId),
			expense_id: Number(expenseId),
		});
		if (response.status !== 200) {
			throw new Error("Failed to approve expense");
		}
		return response.data;
	},

	cancelExpense: async (expenseId: string) => {
		const { user } = useAuthStore.getState();
		const userId = user?.id;
		if (!userId) throw new Error("User not authenticated");
		const response = await apiService.expenses.cancel({
			user_id: Number(userId),
			expense_id: Number(expenseId),
		});
		if (response.status !== 200) {
			throw new Error("Failed to cancel expense");
		}
		return response.data;
	},

	getSummary: async (_userId: number) => {
		try {
			LogRocket.log("[expensesService.getSummary] Starting request");
			const response = await apiService.expenses.summary();
			LogRocket.log("[expensesService.getSummary] Success:", response.data);
			const p = pickExpenseSummaryNumbers(response.data);
			return {
				totalExpenses: p.totalExpenses,
				byTag: p.byTag,
				thisMonth: p.thisMonth,
				lastMonth: p.lastMonth,
			} satisfies components["schemas"]["ExpenseSummary"];
		} catch (error) {
			LogRocket.error("[expensesService.getSummary] Failed:", error);
			throw error;
		}
	},

	getMostUsedTags: async () => {
		try {
			LogRocket.log("[expensesService.getMostUsedTags] Starting request");
			const response = await apiService.expenses.mostUsedTags();
			LogRocket.log(
				"[expensesService.getMostUsedTags] Success:",
				response.data,
			);
			return response.data;
		} catch (error) {
			LogRocket.error("[expensesService.getMostUsedTags] Failed:", error);
			throw error;
		}
	},

	getExpenseItems: async () => {
		try {
			LogRocket.log("[expensesService.getExpenseItems] Starting request");
			const response = await apiService.expenses.listItems();
			LogRocket.log("[expensesService.getExpenseItems] Success:", {
				count: response.data?.length || 0,
				data: response.data,
			});
			return response.data as components["schemas"]["ExpenseItem"][];
		} catch (error) {
			LogRocket.error("[expensesService.getExpenseItems] Failed:", error);
			throw error;
		}
	},

	getExpenseItemsWithFilters: async (
		filters: ExpenseFilters,
	): Promise<PaginatedExpenseItemsResponse> => {
		try {
			LogRocket.log(
				"[expensesService.getExpenseItemsWithFilters] Starting request",
				filters,
			);

			// Create query parameters
			const params = new URLSearchParams();
			if (filters.tag) params.append("category", filters.tag);
			if (filters.emotion) params.append("emotion", filters.emotion);
			if (filters.dateRange) params.append("date_range", filters.dateRange);
			if (filters.search) params.append("search", filters.search);
			if (filters.page) params.append("page", filters.page.toString());
			if (filters.limit) params.append("limit", filters.limit.toString());

			const url = `/api/v1/finances/expenses/items?${params.toString()}`;
			const response = await apiService.expenses.listItemsWithFilters(url);

			LogRocket.log(
				"[expensesService.getExpenseItemsWithFilters] Success:",
				response.data,
			);
			return response.data as PaginatedExpenseItemsResponse;
		} catch (error) {
			LogRocket.error(
				"[expensesService.getExpenseItemsWithFilters] Failed:",
				error,
			);
			throw error;
		}
	},
};
