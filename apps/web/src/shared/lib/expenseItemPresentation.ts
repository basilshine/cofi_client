import type { EntityViewModel } from "./entityPresentation";

export type ExpenseItemLike = {
	id?: number | string;
	name?: string | null;
	amount?: number | string | null;
	emotion?: string | null;
	notes?: string | null;
	expense_date?: string | null;
	tags?: string | Array<string | { name?: string | null }> | null;
};

export const expenseItemTagNames = (item: ExpenseItemLike): string[] => {
	if (typeof item.tags === "string") {
		return item.tags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
	}

	return (item.tags ?? [])
		.map((tag) =>
			typeof tag === "string" ? tag.trim() : (tag.name ?? "").trim(),
		)
		.filter(Boolean);
};

export const expenseItemTitle = (
	item: ExpenseItemLike,
	index?: number,
): string => {
	const name = (item.name ?? "").trim();
	if (name) return name;
	return index != null ? `Line item ${index + 1}` : "Line item";
};

export const toExpenseItemEntity = (
	item: ExpenseItemLike,
	options: { index?: number } = {},
): EntityViewModel => {
	const tags = expenseItemTagNames(item);
	const notes = (item.notes ?? "").trim();
	const emotion = (item.emotion ?? "").trim();
	const itemDate = (item.expense_date ?? "").trim();

	return {
		id: item.id != null ? String(item.id) : undefined,
		visualKey: "expenseItem",
		label: "Item",
		title: expenseItemTitle(item, options.index),
		detail: [notes, emotion ? `Mood: ${emotion}` : undefined, itemDate]
			.filter(Boolean)
			.join(" - "),
		meta: tags,
	};
};
