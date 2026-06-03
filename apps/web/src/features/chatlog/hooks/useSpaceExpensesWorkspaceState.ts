import type { Transaction } from "@cofi/api";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";

type UseSpaceExpensesWorkspaceStateArgs = {
	isExpensesRoute: boolean;
	onOpenInspector: () => void;
	selectedSpaceId: string | number | null;
};

export const useSpaceExpensesWorkspaceState = ({
	isExpensesRoute,
	onOpenInspector,
	selectedSpaceId,
}: UseSpaceExpensesWorkspaceStateArgs) => {
	const [selectedExpenseId, setSelectedExpenseId] = useState<
		string | number | null
	>(null);
	const [
		expenseInspectorWorkspaceEditing,
		setExpenseInspectorWorkspaceEditing,
	] = useState(false);
	const [spaceTransactions, setSpaceTransactions] = useState<
		Transaction[] | null
	>(null);
	const [spaceTransactionsError, setSpaceTransactionsError] = useState<
		string | null
	>(null);
	const [spaceTransactionsLoading, setSpaceTransactionsLoading] =
		useState(false);

	const loadSpaceTransactions = useCallback(async () => {
		if (selectedSpaceId == null) {
			setSpaceTransactions(null);
			return;
		}
		setSpaceTransactionsLoading(true);
		setSpaceTransactionsError(null);
		try {
			const data = await apiClient.spaces.expenses.list(selectedSpaceId, {
				limit: 200,
			});
			setSpaceTransactions(data ?? []);
		} catch (e) {
			setSpaceTransactions(null);
			setSpaceTransactionsError(
				e instanceof Error ? e.message : "Failed to load expenses",
			);
		} finally {
			setSpaceTransactionsLoading(false);
		}
	}, [selectedSpaceId]);

	useEffect(() => {
		void loadSpaceTransactions();
	}, [loadSpaceTransactions]);

	useEffect(() => {
		if (!isExpensesRoute || selectedExpenseId == null) {
			setExpenseInspectorWorkspaceEditing(false);
		}
	}, [isExpensesRoute, selectedExpenseId]);

	const clearSelectedExpense = useCallback(() => {
		setSelectedExpenseId(null);
	}, []);

	const selectExpense = useCallback(
		(expenseId: string | number) => {
			setSelectedExpenseId(expenseId);
			onOpenInspector();
		},
		[onOpenInspector],
	);

	const openExpenseDetail = useCallback(
		(expenseId: string | number) => {
			setSelectedExpenseId(expenseId);
			onOpenInspector();
		},
		[onOpenInspector],
	);

	return {
		clearSelectedExpense,
		expenseInspectorWorkspaceEditing,
		loadSpaceTransactions,
		openExpenseDetail,
		selectExpense,
		setSelectedExpenseId,
		selectedExpenseId,
		spaceTransactions,
		spaceTransactionsError,
		spaceTransactionsLoading,
	};
};
