export type MoneyItem = {
	amount?: number;
	source_amount?: number;
	source_currency?: string;
	space_amount?: number;
	space_currency?: string;
};

export type MoneyExpense = {
	amount?: number;
	total?: number;
	currency?: string;
	source_currency?: string;
	space_total?: number;
	space_currency?: string;
	items: MoneyItem[];
};

const code = (value?: string) => value?.trim().toUpperCase() || "";

const sourceTotal = (expense: MoneyExpense) =>
	expense.total ??
	expense.amount ??
	expense.items.reduce(
		(sum, item) => sum + (item.source_amount ?? item.amount ?? 0),
		0,
	);

export const expenseAmountInCurrency = (
	expense: MoneyExpense,
	targetCurrency: string,
) => {
	const target = code(targetCurrency);
	if (target === code(expense.source_currency || expense.currency))
		return sourceTotal(expense);
	if (target === code(expense.space_currency))
		return (
			expense.space_total ??
			expense.items.reduce(
				(sum, item) => sum + (item.space_amount ?? item.amount ?? 0),
				0,
			)
		);
	return null;
};

export const itemAmountInCurrency = (
	item: MoneyItem,
	expense: MoneyExpense,
	targetCurrency: string,
) => {
	const target = code(targetCurrency);
	if (
		target ===
		code(item.source_currency || expense.source_currency || expense.currency)
	)
		return item.source_amount ?? item.amount ?? 0;
	if (target === code(item.space_currency || expense.space_currency))
		return item.space_amount ?? item.amount ?? 0;
	return null;
};

export const expenseDisplayMoney = (
	expense: MoneyExpense,
	targetCurrency: string,
) => ({
	amount:
		expenseAmountInCurrency(expense, targetCurrency) ?? sourceTotal(expense),
	currency:
		expenseAmountInCurrency(expense, targetCurrency) === null
			? code(expense.source_currency || expense.currency) || targetCurrency
			: code(targetCurrency),
});
