import type { RecurringExpense } from "@cofi/api";
import type { EntityViewModel } from "./entityPresentation";

export const recurringScheduleTitle = (row: RecurringExpense): string =>
	row.name?.trim() || "Schedule";

const recurringStatusClass = (row: RecurringExpense): string =>
	row.paused === true
		? "border-[rgba(172,124,35,0.22)] bg-[rgba(255,250,236,0.76)] text-[#7a5514]"
		: "border-[rgba(72,107,82,0.18)] bg-[rgba(247,252,248,0.78)] text-[#365f42]";

export const toRecurringScheduleEntity = (
	row: RecurringExpense,
	options: {
		amountLabel?: string;
		cadenceLabel?: string;
		selected?: boolean;
	} = {},
): EntityViewModel => {
	const tag = row.tag_label ?? row.tagLabel;
	return {
		id: row.id != null ? String(row.id) : undefined,
		visualKey: "future",
		label: "Recurring",
		title: recurringScheduleTitle(row),
		subtitle: [options.amountLabel, options.cadenceLabel]
			.filter(Boolean)
			.join(" · "),
		meta: [tag?.trim()].filter(Boolean),
		status: row.paused === true ? "Paused" : "Active",
		statusClassName: recurringStatusClass(row),
		selected: options.selected,
	};
};
