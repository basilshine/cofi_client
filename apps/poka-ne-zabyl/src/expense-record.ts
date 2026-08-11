type UnknownRecord = Record<string, unknown>;

const recordValue = (value: unknown): UnknownRecord =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as UnknownRecord)
		: {};

const tagNames = (value: unknown): string[] => {
	if (!Array.isArray(value)) return [];
	return value.flatMap((tag) => {
		if (typeof tag === "string") {
			const name = tag.trim();
			return name ? [name] : [];
		}
		const name = recordValue(tag).name;
		return typeof name === "string" && name.trim() ? [name.trim()] : [];
	});
};

export const normalizeExpenseRecord = <T>(value: T): T => {
	const expense = recordValue(value);
	const items = Array.isArray(expense.items) ? expense.items : [];
	return {
		...expense,
		items: items.map((value) => {
			const item = recordValue(value);
			return { ...item, tags: tagNames(item.tags) };
		}),
	} as T;
};

export const normalizeExpenseRecords = <T>(values: T[] | null | undefined) =>
	(values || []).map(normalizeExpenseRecord);
