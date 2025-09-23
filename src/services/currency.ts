import { useAuthStore } from "@/store/useStore";
import type { components } from "@/types/api-types";

type User = components["schemas"]["User"];

// Currency configurations
export const CURRENCY_CONFIG = {
	USD: {
		symbol: "$",
		code: "USD",
		name: "US Dollar",
		locale: "en-US",
		position: "before", // before or after the amount
	},
	RUB: {
		symbol: "₽",
		code: "RUB",
		name: "Russian Ruble",
		locale: "ru-RU",
		position: "after",
	},
	EUR: {
		symbol: "€",
		code: "EUR",
		name: "Euro",
		locale: "en-US", // or could be "de-DE" etc.
		position: "before",
	},
} as const;

export type CurrencyCode = keyof typeof CURRENCY_CONFIG;

// Get user's currency from auth store, fallback to USD
export const getUserCurrency = (): CurrencyCode => {
	const { user } = useAuthStore.getState();
	const userCurrency = ((user as User)?.currency?.toUpperCase() ??
		"USD") as CurrencyCode;

	// Validate that the currency is supported
	if (userCurrency && userCurrency in CURRENCY_CONFIG) {
		return userCurrency;
	}

	// Default fallback
	return "USD";
};

// Get currency configuration for the user
export const getUserCurrencyConfig = () => {
	const currencyCode = getUserCurrency();
	return CURRENCY_CONFIG[currencyCode];
};

// Format amount with user's currency
export const formatCurrency = (amount: number | undefined | null): string => {
	if (amount === undefined || amount === null || Number.isNaN(amount)) {
		return formatCurrency(0);
	}

	const config = getUserCurrencyConfig();

	// Format with proper locale and currency
	try {
		const formatter = new Intl.NumberFormat(config.locale, {
			style: "currency",
			currency: config.code,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});

		return formatter.format(amount);
	} catch (error) {
		// Fallback to manual formatting if Intl.NumberFormat fails
		const formattedAmount = amount.toFixed(2);

		if (config.position === "before") {
			return `${config.symbol}${formattedAmount}`;
		}
		return `${formattedAmount} ${config.symbol}`;
	}
};

// Format amount with custom currency (for specific use cases)
export const formatCurrencyWithCode = (
	amount: number,
	currencyCode: CurrencyCode,
): string => {
	if (Number.isNaN(amount)) {
		return formatCurrencyWithCode(0, currencyCode);
	}

	const config = CURRENCY_CONFIG[currencyCode];

	try {
		const formatter = new Intl.NumberFormat(config.locale, {
			style: "currency",
			currency: config.code,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});

		return formatter.format(amount);
	} catch (error) {
		const formattedAmount = amount.toFixed(2);

		if (config.position === "before") {
			return `${config.symbol}${formattedAmount}`;
		}
		return `${formattedAmount} ${config.symbol}`;
	}
};

// Get just the currency symbol for display
export const getCurrencySymbol = (): string => {
	const config = getUserCurrencyConfig();
	return config.symbol;
};

// Helper to get available currencies for settings
export const getAvailableCurrencies = () => {
	return Object.entries(CURRENCY_CONFIG).map(([code, config]) => ({
		code: code as CurrencyCode,
		name: config.name,
		symbol: config.symbol,
	}));
};

// Currency service object
export const currencyService = {
	formatCurrency,
	formatCurrencyWithCode,
	getCurrencySymbol,
	getUserCurrency,
	getUserCurrencyConfig,
	getAvailableCurrencies,
};
