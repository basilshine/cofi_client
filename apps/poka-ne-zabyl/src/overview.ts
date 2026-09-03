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

export type HomeCategoryRemainder<T> = {
	categories: T[];
	homeAmount: number;
	homeShare: number;
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
	if (maxRows <= 0) return [];
	const categorizedTotal = categories.reduce(
		(sum, category) => sum + Math.max(0, category.homeAmount),
		0,
	);
	const denominator = Math.max(total, categorizedTotal);
	if (denominator <= 0) return [];
	return [...categories]
		.filter((category) => category.homeAmount > 0)
		.sort((left, right) => right.homeAmount - left.homeAmount)
		.slice(0, maxRows)
		.map((category) => ({
			...category,
			homeShare: Math.min(100, (category.homeAmount / denominator) * 100),
		}));
};

export const homeCategoryRemainder = <
	T extends { id: number; homeAmount: number },
>(
	allCategories: T[],
	visibleCategories: Pick<T, "id">[],
	total: number,
): HomeCategoryRemainder<T> | null => {
	const visibleIDs = new Set(visibleCategories.map(({ id }) => id));
	const categories = allCategories.filter(
		(category) =>
			Number.isFinite(category.homeAmount) &&
			category.homeAmount > 0 &&
			!visibleIDs.has(category.id),
	);
	if (categories.length === 0) return null;
	const categorizedTotal = allCategories.reduce(
		(sum, category) =>
			sum +
			(Number.isFinite(category.homeAmount)
				? Math.max(0, category.homeAmount)
				: 0),
		0,
	);
	const denominator = Math.max(
		Number.isFinite(total) ? Math.max(0, total) : 0,
		categorizedTotal,
	);
	const homeAmount = categories.reduce(
		(sum, category) => sum + category.homeAmount,
		0,
	);
	return {
		categories,
		homeAmount,
		homeShare: denominator > 0 ? (homeAmount / denominator) * 100 : 0,
	};
};
