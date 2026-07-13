export {
	formatCurrencyAmount,
	getCurrencyOptions,
	normalizeCurrencyCode,
} from "./currency";

export type UserDateFormatPreference =
	| "YYYY-MM-DD"
	| "MM/DD/YYYY"
	| "DD/MM/YYYY";

export const normalizeDateFormat = (
	raw?: string | null,
): UserDateFormatPreference => {
	if (raw === "MM/DD/YYYY" || raw === "DD/MM/YYYY" || raw === "YYYY-MM-DD") {
		return raw;
	}
	return "YYYY-MM-DD";
};

const pad2 = (n: number) => String(n).padStart(2, "0");

export const formatDatePartForUser = (
	d: Date,
	dateFormat: UserDateFormatPreference,
): string => {
	const y = d.getFullYear();
	const m = pad2(d.getMonth() + 1);
	const day = pad2(d.getDate());
	if (dateFormat === "MM/DD/YYYY") return `${m}/${day}/${y}`;
	if (dateFormat === "DD/MM/YYYY") return `${day}/${m}/${y}`;
	return `${y}-${m}-${day}`;
};

/**
 * Formats an ISO timestamp using the user's date-order preference plus a local time
 * (hour/minute, same calendar day as stored instant).
 */
export const formatDateTimeForUser = (
	iso: string | undefined,
	dateFormat: UserDateFormatPreference,
): string => {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const datePart = formatDatePartForUser(d, dateFormat);
	const timePart = d.toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
	return `${datePart} ${timePart}`;
};
