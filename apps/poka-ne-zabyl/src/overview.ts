export const expensesForMonth = <T extends { expense_date: string }>(
	expenses: T[],
	now = new Date(),
) => {
	const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	return expenses.filter(
		(expense) => expense.expense_date.slice(0, 7) === month,
	);
};

type CategoryOverviewInput = {
	filteredTotal: number;
	pinned?: boolean;
	budget_amount?: number | null;
	budget_spent?: number;
	budget_percent?: number;
};

export type HomeCategoryRow<T> = T & {
	homeAmount: number;
	homeDifference: number;
	homeHasLimit: boolean;
	homeOverLimit: boolean;
	homeProgress: number;
};

export const homeCategoryRows = <T extends CategoryOverviewInput>(
	categories: T[],
	maxRows = 5,
): HomeCategoryRow<T>[] => {
	const rows = categories
		.map((category) => {
			const limit = category.budget_amount || 0;
			const hasLimit = limit > 0;
			const amount = category.filteredTotal;
			const budgetSpent = category.budget_spent || 0;
			return {
				...category,
				homeAmount: amount,
				homeDifference: Math.abs(limit - budgetSpent),
				homeHasLimit: hasLimit,
				homeOverLimit: hasLimit && budgetSpent > limit,
				homeProgress: hasLimit
					? Math.min(
							100,
							category.budget_percent || (budgetSpent / limit) * 100,
						)
					: 0,
			};
		})
		.filter(
			(category) =>
				category.pinned || category.homeHasLimit || category.homeAmount > 0,
		)
		.sort(
			(left, right) =>
				Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) ||
				right.homeAmount - left.homeAmount,
		);
	const pinnedCount = rows.filter((category) => category.pinned).length;
	return rows.slice(0, Math.max(maxRows, pinnedCount));
};
