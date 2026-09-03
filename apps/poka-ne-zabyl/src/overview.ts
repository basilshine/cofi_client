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

export type HomeCategoryDistributionRow<T> = T & {
	homeShare: number;
};

export type HomeCategoryBreakdown<T> = {
	featured: HomeCategoryDistributionRow<T>[];
	remainder: {
		categories: HomeCategoryDistributionRow<T>[];
		homeAmount: number;
		homeShare: number;
	} | null;
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

export const homeCategoryDistribution = <T extends { homeAmount: number }>(
	categories: T[],
	total: number,
	maxRows = 3,
): HomeCategoryDistributionRow<T>[] => {
	return homeCategoryBreakdown(categories, total, maxRows).featured;
};

export const homeCategoryBreakdown = <T extends { homeAmount: number }>(
	categories: T[],
	total: number,
	maxRows = 3,
): HomeCategoryBreakdown<T> => {
	const categorizedTotal = categories.reduce(
		(sum, category) => sum + Math.max(0, category.homeAmount),
		0,
	);
	const denominator = Math.max(total, categorizedTotal);
	if (denominator <= 0) return { featured: [], remainder: null };
	const distribution = [...categories]
		.filter((category) => category.homeAmount > 0)
		.sort((left, right) => right.homeAmount - left.homeAmount)
		.map((category) => ({
			...category,
			homeShare: Math.min(100, (category.homeAmount / denominator) * 100),
		}));
	const featured = maxRows > 0 ? distribution.slice(0, maxRows) : [];
	const remainderCategories = distribution.slice(Math.max(0, maxRows));
	const remainderAmount = remainderCategories.reduce(
		(sum, category) => sum + category.homeAmount,
		0,
	);
	return {
		featured,
		remainder:
			remainderCategories.length > 0
				? {
						categories: remainderCategories,
						homeAmount: remainderAmount,
						homeShare: Math.min(100, (remainderAmount / denominator) * 100),
					}
				: null,
	};
};
