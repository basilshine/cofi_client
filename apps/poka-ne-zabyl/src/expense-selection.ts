export type SelectableExpenseItem = { id?: number };

export type SelectableExpense = {
	id: number;
	items: SelectableExpenseItem[];
};

export type ExpenseSelectionState = "empty" | "partial" | "complete";

export const expenseItemSelectionKey = (
	expenseID: number,
	item: SelectableExpenseItem,
	itemIndex: number,
) => `${expenseID}:${item.id ?? `index-${itemIndex}`}`;

export const expenseSelectionKeys = (expense: SelectableExpense) =>
	expense.items.map((item, itemIndex) =>
		expenseItemSelectionKey(expense.id, item, itemIndex),
	);

export const expenseSelectionState = (
	expense: SelectableExpense,
	selectedKeys: ReadonlySet<string>,
): ExpenseSelectionState => {
	const keys = expenseSelectionKeys(expense);
	const selectedCount = keys.filter((key) => selectedKeys.has(key)).length;
	if (selectedCount === 0) return "empty";
	return selectedCount === keys.length ? "complete" : "partial";
};

export const toggleExpenseSelection = (
	selectedKeys: ReadonlySet<string>,
	expense: SelectableExpense,
) => {
	const next = new Set(selectedKeys);
	const keys = expenseSelectionKeys(expense);
	const remove = keys.length > 0 && keys.every((key) => next.has(key));
	for (const key of keys) {
		if (remove) next.delete(key);
		else next.add(key);
	}
	return next;
};

export const toggleExpenseItemSelection = (
	selectedKeys: ReadonlySet<string>,
	expenseID: number,
	item: SelectableExpenseItem,
	itemIndex: number,
) => {
	const next = new Set(selectedKeys);
	const key = expenseItemSelectionKey(expenseID, item, itemIndex);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	return next;
};

export const setExpenseSelectionKeys = (
	selectedKeys: ReadonlySet<string>,
	targetKeys: Iterable<string>,
	selected: boolean,
) => {
	const next = new Set(selectedKeys);
	for (const key of targetKeys) {
		if (selected) next.add(key);
		else next.delete(key);
	}
	return next;
};
