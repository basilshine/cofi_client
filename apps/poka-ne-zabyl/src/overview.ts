export const entriesForMonth = <T>(
	entries: T[],
	dateOf: (entry: T) => string | null | undefined,
	now = new Date(),
) => {
	const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	return entries.filter((entry) => dateOf(entry)?.slice(0, 7) === month);
};

export const expensesForMonth = <T extends { expense_date: string }>(
	expenses: T[],
	now = new Date(),
) => entriesForMonth(expenses, (expense) => expense.expense_date, now);
