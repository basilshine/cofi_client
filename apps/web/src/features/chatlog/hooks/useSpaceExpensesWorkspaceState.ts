import type { Transaction } from "@cofi/api";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../../../shared/lib/apiClient";
import { useExpenseThreadState } from "./useExpenseThreadState";

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
	const [sidebarThreadExpenseId, setSidebarThreadExpenseId] = useState<
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
	const [threadDraftLineScroll, setThreadDraftLineScroll] = useState<
		number | null
	>(null);

	const expenseThreadCtrl = useExpenseThreadState(
		selectedSpaceId,
		sidebarThreadExpenseId,
	);

	const loadSpaceTransactions = useCallback(async () => {
		if (selectedSpaceId == null) {
			setSpaceTransactions(null);
			return;
		}
		setSpaceTransactionsLoading(true);
		setSpaceTransactionsError(null);
		try {
			const data = await apiClient.spaces.listTransactions(selectedSpaceId, {
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
		if (!isExpensesRoute || sidebarThreadExpenseId == null) {
			setExpenseInspectorWorkspaceEditing(false);
		}
	}, [isExpensesRoute, sidebarThreadExpenseId]);

	const clearExpenseThread = useCallback(() => {
		setSidebarThreadExpenseId(null);
		setThreadDraftLineScroll(null);
	}, []);

	const closeExpenseThread = useCallback(() => {
		clearExpenseThread();
		void loadSpaceTransactions();
	}, [clearExpenseThread, loadSpaceTransactions]);

	const selectExpense = useCallback(
		(expenseId: string | number) => {
			setSidebarThreadExpenseId(expenseId);
			onOpenInspector();
		},
		[onOpenInspector],
	);

	const openExpenseThread = useCallback(
		(expenseId: string | number, options?: { draftLine?: number | null }) => {
			setSidebarThreadExpenseId(expenseId);
			onOpenInspector();
			setThreadDraftLineScroll(options?.draftLine ?? null);
		},
		[onOpenInspector],
	);

	const clearDraftLineScroll = useCallback(() => {
		setThreadDraftLineScroll(null);
	}, []);

	return {
		clearDraftLineScroll,
		clearExpenseThread,
		closeExpenseThread,
		expenseInspectorWorkspaceEditing,
		expenseThreadCtrl,
		loadSpaceTransactions,
		openExpenseThread,
		selectExpense,
		setExpenseInspectorWorkspaceEditing,
		setSidebarThreadExpenseId,
		setThreadDraftLineScroll,
		sidebarThreadExpenseId,
		spaceTransactions,
		spaceTransactionsError,
		spaceTransactionsLoading,
		threadDraftLineScroll,
	};
};
