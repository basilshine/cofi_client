import type { Period } from "./expense-period";

type PlanItem = {
	name: string;
	category_id?: number | null;
};

export type FilterablePurchasePlan = {
	id?: number;
	title: string;
	vendor_id?: number | null;
	vendor_name?: string;
	category_id?: number | null;
	due_date?: string | null;
	recurrence_interval?: "" | "weekly" | "monthly";
	recurrence_series_id?: number | null;
	recurrence_day?: number;
	items?: PlanItem[];
};

const localDate = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const utcDate = (value: string) => {
	const [year, month, day] = value.slice(0, 10).split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, day));
};

const utcISODate = (date: Date) =>
	[
		date.getUTCFullYear(),
		String(date.getUTCMonth() + 1).padStart(2, "0"),
		String(date.getUTCDate()).padStart(2, "0"),
	].join("-");

const nextOccurrenceDate = (
	date: Date,
	interval: "weekly" | "monthly",
	anchorDay: number,
) => {
	if (interval === "weekly") {
		date.setUTCDate(date.getUTCDate() + 7);
		return date;
	}
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;
	const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)));
};

export const purchasePlanOccurrenceCount = (
	plan: FilterablePurchasePlan,
	from: string,
	to: string,
) => {
	const dueDate = plan.due_date?.slice(0, 10);
	if (!dueDate) return from || to ? 0 : 1;
	const inRange =
		(!from || dueDate >= from) && (!to || dueDate <= to);
	if (!plan.recurrence_interval || !to) return inRange ? 1 : 0;

	let current = utcDate(dueDate);
	const anchorDay = plan.recurrence_day || current.getUTCDate();
	let count = 0;
	for (let generated = 0; generated < 520; generated++) {
		const date = utcISODate(current);
		if (date > to) break;
		if (!from || date >= from) count++;
		current = nextOccurrenceDate(
			current,
			plan.recurrence_interval,
			anchorDay,
		);
	}
	return count;
};

export const collapsePurchasePlanSeries = <
	T extends FilterablePurchasePlan,
>(
	plans: T[],
) => {
	const collapsed: T[] = [];
	const series = new Map<number, T>();
	for (const plan of plans) {
		if (!plan.recurrence_series_id || !plan.recurrence_interval) {
			collapsed.push(plan);
			continue;
		}
		const current = series.get(plan.recurrence_series_id);
		if (
			!current ||
			(plan.due_date || "9999-12-31") <
				(current.due_date || "9999-12-31")
		) {
			series.set(plan.recurrence_series_id, plan);
		}
	}
	return [...collapsed, ...series.values()];
};

export const planPeriodBounds = (
	period: Period,
	customFrom = "",
	customTo = "",
	now = new Date(),
) => {
	if (period === "all") return { from: "", to: "" };
	if (period === "custom") return { from: customFrom, to: customTo };

	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (period === "three-days") end.setDate(end.getDate() + 2);
	if (period === "week") end.setDate(end.getDate() + 6);
	if (period === "month") end.setMonth(end.getMonth() + 1, 0);
	if (period === "three-months") end.setMonth(end.getMonth() + 3, 0);
	if (period === "six-months") end.setMonth(end.getMonth() + 6, 0);
	if (period === "year") end.setMonth(11, 31);
	return { from: localDate(now), to: localDate(end) };
};

export const filterPurchasePlans = <T extends FilterablePurchasePlan>(
	plans: T[],
	filters: {
		query: string;
		categoryID: number;
		vendorID: number;
		from: string;
		to: string;
	},
) => {
	const query = filters.query.trim().toLocaleLowerCase();
	return plans.filter((plan) => {
		const items = plan.items || [];
		if (
			(filters.from || filters.to) &&
			purchasePlanOccurrenceCount(plan, filters.from, filters.to) === 0
		)
			return false;
		if (
			filters.categoryID &&
			plan.category_id !== filters.categoryID &&
			!items.some((item) => item.category_id === filters.categoryID)
		)
			return false;
		if (filters.vendorID && plan.vendor_id !== filters.vendorID) return false;
		if (!query) return true;
		return [plan.title, plan.vendor_name, ...items.map((item) => item.name)]
			.filter(Boolean)
			.join(" ")
			.toLocaleLowerCase()
			.includes(query);
	});
};

export const partitionOverduePurchasePlans = <T extends FilterablePurchasePlan>(
	plans: T[],
	today: string,
) => ({
	overdue: plans.filter((plan) => {
		const date = plan.due_date?.slice(0, 10);
		return Boolean(date && date < today);
	}),
	current: plans.filter(
		(plan) => !plan.due_date || plan.due_date.slice(0, 10) >= today,
	),
});
