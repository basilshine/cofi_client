import type { Transaction } from "@cofi/api";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";

const SPACE_EXPENSE_PAGE_SIZE = 50;

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
	const [spaceTransactionsLoadingMore, setSpaceTransactionsLoadingMore] =
		useState(false);
	const [spaceTransactionsHasMore, setSpaceTransactionsHasMore] =
		useState(false);
	const [spaceTransactionsNextOffset, setSpaceTransactionsNextOffset] =
		useState<number | null>(null);

	const mergeTransactions = useCallback(
		(current: Transaction[], incoming: Transaction[]) => {
			const byId = new Map<string, Transaction>();
			for (const tx of current) {
				byId.set(String(tx.id), tx);
			}
			for (const tx of incoming) {
				byId.set(String(tx.id), tx);
			}
			return Array.from(byId.values());
		},
		[],
	);

	const loadSpaceTransactions = useCallback(async () => {
		if (selectedSpaceId == null) {
			setSpaceTransactions(null);
			setSpaceTransactionsHasMore(false);
			setSpaceTransactionsNextOffset(null);
			return;
		}
		setSpaceTransactionsLoading(true);
		setSpaceTransactionsError(null);
		try {
			const data = await apiClient.spaces.expenses.list(selectedSpaceId, {
				limit: SPACE_EXPENSE_PAGE_SIZE,
				offset: 0,
			});
			setSpaceTransactions(data.expenses ?? []);
			setSpaceTransactionsHasMore(data.has_more === true);
			setSpaceTransactionsNextOffset(
				typeof data.next_offset === "number" ? data.next_offset : null,
			);
		} catch (e) {
			setSpaceTransactions(null);
			setSpaceTransactionsHasMore(false);
			setSpaceTransactionsNextOffset(null);
			setSpaceTransactionsError(
				e instanceof Error ? e.message : "Failed to load expenses",
			);
		} finally {
			setSpaceTransactionsLoading(false);
		}
	}, [selectedSpaceId]);

	const loadMoreSpaceTransactions = useCallback(async () => {
		if (
			selectedSpaceId == null ||
			spaceTransactionsLoadingMore ||
			spaceTransactionsNextOffset == null
		) {
			return;
		}
		setSpaceTransactionsLoadingMore(true);
		setSpaceTransactionsError(null);
		try {
			const data = await apiClient.spaces.expenses.list(selectedSpaceId, {
				limit: SPACE_EXPENSE_PAGE_SIZE,
				offset: spaceTransactionsNextOffset,
			});
			setSpaceTransactions((current) =>
				mergeTransactions(current ?? [], data.expenses ?? []),
			);
			setSpaceTransactionsHasMore(data.has_more === true);
			setSpaceTransactionsNextOffset(
				typeof data.next_offset === "number" ? data.next_offset : null,
			);
		} catch (e) {
			setSpaceTransactionsError(
				e instanceof Error ? e.message : "Failed to load more expenses",
			);
		} finally {
			setSpaceTransactionsLoadingMore(false);
		}
	}, [
		mergeTransactions,
		selectedSpaceId,
		spaceTransactionsLoadingMore,
		spaceTransactionsNextOffset,
	]);

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
		loadMoreSpaceTransactions,
		openExpenseDetail,
		selectExpense,
		setSelectedExpenseId,
		selectedExpenseId,
		spaceTransactions,
		spaceTransactionsError,
		spaceTransactionsHasMore,
		spaceTransactionsLoading,
		spaceTransactionsLoadingMore,
	};
};
