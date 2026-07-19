import type { Period } from "./expense-period";

type PlanItem = {
	name: string;
	category_id?: number | null;
};

export type FilterablePurchasePlan = {
	title: string;
	vendor_id?: number | null;
	vendor_name?: string;
	category_id?: number | null;
	due_date?: string | null;
	items?: PlanItem[];
};

const localDate = (date: Date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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
		const date = plan.due_date?.slice(0, 10) || "";
		if ((filters.from || filters.to) && !date) return false;
		if (filters.from && date < filters.from) return false;
		if (filters.to && date > filters.to) return false;
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
