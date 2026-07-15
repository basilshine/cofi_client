export type MoneyItem = {
	amount?: number;
	source_amount?: number;
	source_currency?: string;
	space_amount?: number;
	space_currency?: string;
	reporting_amount?: number;
};

export type MoneyExpense = {
	amount?: number;
	total?: number;
	currency?: string;
	source_currency?: string;
	space_total?: number;
	space_currency?: string;
	reporting_total?: number;
	reporting_currency?: string;
	items: MoneyItem[];
};

const code = (value?: string) => value?.trim().toUpperCase() || "";

export const formatMoney = (amount: number, currency: string) =>
	new Intl.NumberFormat("ru-RU", {
		style: "currency",
		currency: currency || "RUB",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(amount || 0);

export const moneyAmountsMatch = (left: number, right: number) =>
	Math.round(left * 100) === Math.round(right * 100);

const sourceTotal = (expense: MoneyExpense) =>
	expense.items.length > 0
		? expense.items.reduce(
				(sum, item) => sum + (item.source_amount ?? item.amount ?? 0),
				0,
			)
		: (expense.total ?? expense.amount ?? 0);

export const expenseAmountInCurrency = (
	expense: MoneyExpense,
	targetCurrency: string,
) => {
	const target = code(targetCurrency);
	if (target === code(expense.reporting_currency))
		return expense.reporting_total ?? null;
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
	if (target === code(expense.reporting_currency))
		return item.reporting_amount ?? null;
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

export const itemDisplayMoney = (
	item: MoneyItem,
	expense: MoneyExpense,
	targetCurrency: string,
) => {
	const converted = itemAmountInCurrency(item, expense, targetCurrency);
	return {
		amount: converted ?? item.source_amount ?? item.amount ?? 0,
		currency:
			converted === null
				? code(
						item.source_currency || expense.source_currency || expense.currency,
					) || targetCurrency
				: code(targetCurrency),
	};
};
