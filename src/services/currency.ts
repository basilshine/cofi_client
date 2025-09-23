import type { components } from "@/types/api-types";

type User = components["schemas"]["User"];

// We need to get user data from AuthContext, but since this is a service file
// we can't use React hooks directly. We'll need to pass the user data as parameter
// or use a different approach.

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

// Get user's currency from user object, fallback to USD
export const getUserCurrency = (user?: User | null): CurrencyCode => {
	const userCurrency = (user?.currency?.toUpperCase() ?? "USD") as CurrencyCode;

	// Validate that the currency is supported
	if (userCurrency && userCurrency in CURRENCY_CONFIG) {
		return userCurrency;
	}

	// Default fallback
	return "USD";
};

// Get currency configuration for the user
export const getUserCurrencyConfig = (user?: User | null) => {
	const currencyCode = getUserCurrency(user);
	return CURRENCY_CONFIG[currencyCode];
};

// Format amount with user's currency
export const formatCurrency = (
	amount: number | undefined | null,
	user?: User | null,
): string => {
	if (amount === undefined || amount === null || Number.isNaN(amount)) {
		return formatCurrency(0, user);
	}

	const config = getUserCurrencyConfig(user);

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
export const getCurrencySymbol = (user?: User | null): string => {
	const config = getUserCurrencyConfig(user);
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

// Currency service object - these require user to be passed
export const currencyService = {
	formatCurrency,
	formatCurrencyWithCode,
	getCurrencySymbol,
	getUserCurrency,
	getUserCurrencyConfig,
	getAvailableCurrencies,
};
