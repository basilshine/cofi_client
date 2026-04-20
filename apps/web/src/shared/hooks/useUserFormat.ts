import { useCallback, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
	type UserDateFormatPreference,
	formatCurrencyAmount,
	formatDateTimeForUser,
	normalizeCurrencyCode,
	normalizeDateFormat,
} from "../lib/userFormat";

export const useUserFormat = () => {
	const { user } = useAuth();

	const currency = useMemo(
		() => normalizeCurrencyCode(user?.currency),
		[user?.currency],
	);

	const dateFormat: UserDateFormatPreference = useMemo(
		() => normalizeDateFormat(user?.dateFormat),
		[user?.dateFormat],
	);

	const formatMoney = useCallback(
		(amount: number) => formatCurrencyAmount(amount, currency),
		[currency],
	);

	const formatDateTime = useCallback(
		(iso?: string) => formatDateTimeForUser(iso, dateFormat),
		[dateFormat],
	);

	return { formatMoney, formatDateTime, currency, dateFormat };
};
