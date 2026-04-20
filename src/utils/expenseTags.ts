import type { components } from "@/types/api-types";

export const formatItemTagLabel = (
	item: components["schemas"]["ExpenseItem"],
): string => {
	const names = item.tags?.map((t) => t.name).filter(Boolean) as string[];
	if (names && names.length > 0) {
		return names.join(", ");
	}
	return "—";
};

/** Backend expense summary JSON uses snake_case (`total_expenses`, `by_tag`). */
export const pickExpenseSummaryNumbers = (
	raw: unknown,
): {
	totalExpenses: number;
	byTag: Record<string, number>;
	thisMonth: number;
	lastMonth: number;
} => {
	const r = raw as Record<string, unknown>;
	const by = (r.byTag ?? r.by_tag) as
		| Record<string, number>
		| string
		| undefined;
	const byTag: Record<string, number> =
		by && typeof by === "object" && !Array.isArray(by)
			? (by as Record<string, number>)
			: {};
	return {
		totalExpenses: Number(r.totalExpenses ?? r.total_expenses ?? 0),
		byTag,
		thisMonth: Number(r.thisMonth ?? r.this_month ?? 0),
		lastMonth: Number(r.lastMonth ?? r.last_month ?? 0),
	};
};
