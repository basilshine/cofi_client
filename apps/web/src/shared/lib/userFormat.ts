/** Normalizes profile currency to a 3-letter ISO code for `Intl` (fallback USD). */
export const normalizeCurrencyCode = (raw?: string | null): string => {
	const t = raw?.trim().toUpperCase();
	if (t && /^[A-Z]{3}$/.test(t)) return t;
	return "USD";
};

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

export const formatCurrencyAmount = (
	amount: number,
	currencyCode: string,
): string => {
	if (!Number.isFinite(amount)) {
		return formatCurrencyAmount(0, currencyCode);
	}
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: currencyCode,
		}).format(amount);
	} catch {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: "USD",
		}).format(amount);
	}
};
