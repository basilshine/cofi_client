import type { CurrencyCode } from "@cofi/api";

const FALLBACK_CURRENCY_CODES = [
	"USD",
	"EUR",
	"RUB",
	"GBP",
	"JPY",
	"CHF",
	"CNY",
	"KZT",
	"TRY",
	"AED",
	"CAD",
	"AUD",
];

/** Normalizes profile/space currency to a 3-letter ISO code for `Intl` (fallback USD). */
export const normalizeCurrencyCode = (raw?: string | null): CurrencyCode => {
	const t = raw?.trim().toUpperCase();
	if (t && /^[A-Z]{3}$/.test(t)) return t;
	return "USD";
};

export type CurrencyOption = {
	code: CurrencyCode;
	label: string;
};

export const getCurrencyOptions = (): CurrencyOption[] => {
	const supportedValuesOf = (
		Intl as typeof Intl & {
			supportedValuesOf?: (key: "currency") => string[];
		}
	).supportedValuesOf;
	const supported =
		typeof supportedValuesOf === "function"
			? supportedValuesOf("currency")
			: FALLBACK_CURRENCY_CODES;
	const codes = Array.from(
		new Set(
			[...FALLBACK_CURRENCY_CODES, ...supported].map(normalizeCurrencyCode),
		),
	).sort((a, b) => a.localeCompare(b));
	return codes.map((code) => ({ code, label: code }));
};

export const formatCurrencyAmount = (
	amount: number,
	currencyCode: CurrencyCode | string,
): string => {
	if (!Number.isFinite(amount)) {
		return formatCurrencyAmount(0, currencyCode);
	}
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: normalizeCurrencyCode(currencyCode),
		}).format(amount);
	} catch {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: "USD",
		}).format(amount);
	}
};
