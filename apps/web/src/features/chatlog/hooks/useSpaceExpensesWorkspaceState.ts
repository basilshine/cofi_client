import type { ExpenseRecord } from "@cofi/api";
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
	const [spaceExpenseRecords, setSpaceExpenseRecords] = useState<
		ExpenseRecord[] | null
	>(null);
	const [spaceExpenseRecordsError, setSpaceExpenseRecordsError] = useState<
		string | null
	>(null);
	const [spaceExpenseRecordsLoading, setSpaceExpenseRecordsLoading] =
		useState(false);
	const [spaceExpenseRecordsLoadingMore, setSpaceExpenseRecordsLoadingMore] =
		useState(false);
	const [spaceExpenseRecordsHasMore, setSpaceExpenseRecordsHasMore] =
		useState(false);
	const [spaceExpenseRecordsNextOffset, setSpaceExpenseRecordsNextOffset] =
		useState<number | null>(null);

	const mergeExpenseRecords = useCallback(
		(current: ExpenseRecord[], incoming: ExpenseRecord[]) => {
			const byId = new Map<string, ExpenseRecord>();
			for (const expense of current) {
				byId.set(String(expense.id), expense);
			}
			for (const expense of incoming) {
				byId.set(String(expense.id), expense);
			}
			return Array.from(byId.values());
		},
		[],
	);

	const loadSpaceExpenseRecords = useCallback(async () => {
		if (selectedSpaceId == null) {
			setSpaceExpenseRecords(null);
			setSpaceExpenseRecordsHasMore(false);
			setSpaceExpenseRecordsNextOffset(null);
			return;
		}
		setSpaceExpenseRecordsLoading(true);
		setSpaceExpenseRecordsError(null);
		try {
			const data = await apiClient.spaces.expenses.list(selectedSpaceId, {
				limit: SPACE_EXPENSE_PAGE_SIZE,
				offset: 0,
			});
			setSpaceExpenseRecords(data.expenses ?? []);
			setSpaceExpenseRecordsHasMore(data.has_more === true);
			setSpaceExpenseRecordsNextOffset(
				typeof data.next_offset === "number" ? data.next_offset : null,
			);
		} catch (e) {
			setSpaceExpenseRecords(null);
			setSpaceExpenseRecordsHasMore(false);
			setSpaceExpenseRecordsNextOffset(null);
			setSpaceExpenseRecordsError(
				e instanceof Error ? e.message : "Failed to load expenses",
			);
		} finally {
			setSpaceExpenseRecordsLoading(false);
		}
	}, [selectedSpaceId]);

	const loadMoreSpaceExpenseRecords = useCallback(async () => {
		if (
			selectedSpaceId == null ||
			spaceExpenseRecordsLoadingMore ||
			spaceExpenseRecordsNextOffset == null
		) {
			return;
		}
		setSpaceExpenseRecordsLoadingMore(true);
		setSpaceExpenseRecordsError(null);
		try {
			const data = await apiClient.spaces.expenses.list(selectedSpaceId, {
				limit: SPACE_EXPENSE_PAGE_SIZE,
				offset: spaceExpenseRecordsNextOffset,
			});
			setSpaceExpenseRecords((current) =>
				mergeExpenseRecords(current ?? [], data.expenses ?? []),
			);
			setSpaceExpenseRecordsHasMore(data.has_more === true);
			setSpaceExpenseRecordsNextOffset(
				typeof data.next_offset === "number" ? data.next_offset : null,
			);
		} catch (e) {
			setSpaceExpenseRecordsError(
				e instanceof Error ? e.message : "Failed to load more expenses",
			);
		} finally {
			setSpaceExpenseRecordsLoadingMore(false);
		}
	}, [
		mergeExpenseRecords,
		selectedSpaceId,
		spaceExpenseRecordsLoadingMore,
		spaceExpenseRecordsNextOffset,
	]);

	useEffect(() => {
		void loadSpaceExpenseRecords();
	}, [loadSpaceExpenseRecords]);

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
		loadSpaceExpenseRecords,
		loadMoreSpaceExpenseRecords,
		openExpenseDetail,
		selectExpense,
		setSelectedExpenseId,
		selectedExpenseId,
		spaceExpenseRecords,
		spaceExpenseRecordsError,
		spaceExpenseRecordsHasMore,
		spaceExpenseRecordsLoading,
		spaceExpenseRecordsLoadingMore,
	};
};
