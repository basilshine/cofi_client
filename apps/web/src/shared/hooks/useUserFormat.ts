import { useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
	type UserDateFormatPreference,
	formatCurrencyAmount,
	formatDateTimeForUser,
	normalizeCurrencyCode,
	normalizeDateFormat,
} from "../lib/userFormat";

export const useUserFormat = (currencyOverride?: string | null) => {
	const { user } = useAuth();

	const currency = useMemo(
		() => normalizeCurrencyCode(currencyOverride ?? user?.currency),
		[currencyOverride, user?.currency],
	);

	const dateFormat: UserDateFormatPreference = useMemo(
		() => normalizeDateFormat(user?.dateFormat),
		[user?.dateFormat],
	);

	const formatMoney = useCallback(
		(amount: number, amountCurrency?: string | null) =>
			formatCurrencyAmount(
				amount,
				amountCurrency == null
					? currency
					: normalizeCurrencyCode(amountCurrency),
			),
		[currency],
	);

	const formatDateTime = useCallback(
		(iso?: string) => formatDateTimeForUser(iso, dateFormat),
		[dateFormat],
	);

	return { formatMoney, formatDateTime, currency, dateFormat };
};
