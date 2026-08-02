export type CategoryBudgetAmount = {
	monthSpent: number;
	budgetAmount: number;
	budgetPeriod?: "week" | "month" | "";
};

export const categoryMonth = (date = new Date()) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const shiftCategoryMonth = (value: string, offset: number) => {
	const [year, month] = value.split("-").map(Number);
	return categoryMonth(new Date(year, month - 1 + offset, 1));
};

export const categoryBudgetSummary = (rows: CategoryBudgetAmount[]) => {
	const spent = rows.reduce((sum, row) => sum + row.monthSpent, 0);
	const limit = rows.reduce(
		(sum, row) => sum + (row.budgetPeriod === "month" ? row.budgetAmount : 0),
		0,
	);
	return { spent, limit, remaining: limit - spent };
};
