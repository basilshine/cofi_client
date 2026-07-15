export const expensesForMonth = <T extends { expense_date: string }>(
	expenses: T[],
	now = new Date(),
) => {
	const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	return expenses.filter(
		(expense) => expense.expense_date.slice(0, 7) === month,
	);
};
