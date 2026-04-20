import type { StandardRecurringInterval } from "@cofi/api";

export type BuilderItem = {
	id: string;
	name: string;
	amount: string; // keep as string for controlled input
	tags: string; // comma separated
	/** Optional per-line memo (not expense-level business notes). */
	notes?: string;
	/** Per line: create a recurring schedule for this item only when the draft is approved */
	recurring_enabled?: boolean;
	recurring_interval?: StandardRecurringInterval;
};

export const newBuilderItem = (): BuilderItem => ({
	id: crypto.randomUUID(),
	name: "",
	amount: "",
	tags: "",
	notes: "",
});

export const toNumber = (s: string) => {
	const n = Number(String(s).replace(",", "."));
	return Number.isFinite(n) ? n : 0;
};

export const parseTags = (s: string) =>
	s
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
