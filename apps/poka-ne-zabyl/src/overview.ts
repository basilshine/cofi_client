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

export type HomePlanOverview<T> = {
	plans: T[];
	remainder: {
		plans: T[];
		homeAmount: number;
	} | null;
};

export type CategoryChartRow<T> = {
	category: T | null;
	amount: number;
	share: number;
};

export type CategoryChart<T> = {
	rows: CategoryChartRow<T>[];
	total: number;
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

export const homePlanOverview = <T>(
	plans: T[],
	amountForPlan: (plan: T) => number,
	maxRows = 5,
): HomePlanOverview<T> => {
	const limit = Number.isFinite(maxRows) ? Math.max(0, Math.floor(maxRows)) : 5;
	const visiblePlans = plans.slice(0, limit);
	const remainderPlans = plans.slice(limit);
	if (remainderPlans.length === 0) {
		return { plans: visiblePlans, remainder: null };
	}
	return {
		plans: visiblePlans,
		remainder: {
			plans: remainderPlans,
			homeAmount: remainderPlans.reduce((sum, plan) => {
				const amount = amountForPlan(plan);
				return sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
			}, 0),
		},
	};
};

export const categoryChartRows = <T>(
	categories: T[],
	amountForCategory: (category: T) => number,
	maxRows = 5,
): CategoryChart<T> => {
	const limit = Number.isFinite(maxRows) ? Math.max(1, Math.floor(maxRows)) : 5;
	const ranked = categories
		.map((category) => ({ category, amount: amountForCategory(category) }))
		.filter(({ amount }) => Number.isFinite(amount) && amount > 0)
		.sort((left, right) => right.amount - left.amount);
	const total = ranked.reduce((sum, row) => sum + row.amount, 0);
	if (total <= 0) return { rows: [], total: 0 };

	const visibleCount = ranked.length > limit ? limit - 1 : limit;
	const visible = ranked.slice(0, visibleCount);
	const remainderAmount = ranked
		.slice(visibleCount)
		.reduce((sum, row) => sum + row.amount, 0);
	const rows: CategoryChartRow<T>[] = visible.map(({ category, amount }) => ({
		category,
		amount,
		share: (amount / total) * 100,
	}));
	if (remainderAmount > 0) {
		rows.push({
			category: null,
			amount: remainderAmount,
			share: (remainderAmount / total) * 100,
		});
	}
	return { rows, total };
};
