export type Period =
	| "today"
	| "three-days"
	| "week"
	| "month"
	| "three-months"
	| "six-months"
	| "year"
	| "all"
	| "custom";

const localDate = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const periodBounds = (
	period: Period,
	customFrom = "",
	customTo = "",
	now = new Date(),
) => {
	if (period === "all") return { from: "", to: "" };
	if (period === "custom") return { from: customFrom, to: customTo };

	let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (period === "three-days") start.setDate(start.getDate() - 2);
	if (period === "week") start.setDate(start.getDate() - 6);
	if (period === "month")
		start = new Date(now.getFullYear(), now.getMonth(), 1);
	if (period === "three-months")
		start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
	if (period === "six-months")
		start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
	if (period === "year") start = new Date(now.getFullYear(), 0, 1);
	return { from: localDate(start), to: localDate(now) };
};

export const expenseSummaryTotal = (
	loadedTotal: number,
	monthTotal: number | null,
	period: Period,
	hasFilters: boolean,
) =>
	period === "month" && !hasFilters && monthTotal !== null
		? monthTotal
		: loadedTotal;
