import type { ExpenseRecord } from "@cofi/api";
import type { ReactNode } from "react";
import { SpaceWorkspaceLayout } from "../../../app/layout/workspaceSpaces/SpaceWorkspaceLayout";
import { ChatToastPortal } from "./ChatToastPortal";
import { SpaceExpensesMain } from "./SpaceExpensesMain";

type SpaceExpensesWorkspaceProps = {
	currentUserId: number | null;
	errorMessage: string | null;
	expenseInspectorWorkspaceEditing: boolean;
	expenseRightPanel: ReactNode;
	listError: string | null;
	listHasMore?: boolean;
	listLoading: boolean;
	listLoadingMore?: boolean;
	onExpenseDeleted?: (expenseId: string | number) => void;
	onLoadMore?: () => void;
	onReload: () => void;
	onSelectExpense: (expenseId: string | number) => void;
	selectedExpenseId: string | number | null;
	selectedSpaceId: string | number | null;
	spaceName?: string | null;
	spaceExpenseRecords: ExpenseRecord[] | null;
	toastMessage: string | null;
};

export const SpaceExpensesWorkspace = ({
	currentUserId,
	errorMessage,
	expenseInspectorWorkspaceEditing,
	expenseRightPanel,
	listError,
	listHasMore = false,
	listLoading,
	listLoadingMore = false,
	onExpenseDeleted,
	onLoadMore,
	onReload,
	onSelectExpense,
	selectedExpenseId,
	selectedSpaceId,
	spaceName = null,
	spaceExpenseRecords,
	toastMessage,
}: SpaceExpensesWorkspaceProps) => {
	return (
		<SpaceWorkspaceLayout
			contentClassName="flex min-h-0 flex-1 flex-col p-0"
			rightRail={expenseRightPanel}
			rightRailClassName="xl:w-[22rem]"
			rightRailInnerClassName="min-h-0 flex-1 overflow-hidden p-0"
			rightRailLabel="Expenses inspector"
		>
			{errorMessage ? (
				<div className="shrink-0 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-sm text-destructive lg:px-6">
					{errorMessage}
				</div>
			) : null}

			{selectedSpaceId ? (
				<div
					className={
						expenseInspectorWorkspaceEditing
							? "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card opacity-[0.52] saturate-[0.68] contrast-[0.94] transition-[opacity,filter] duration-300 ease-out"
							: "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card transition-[opacity,filter] duration-300 ease-out"
					}
				>
					<SpaceExpensesMain
						currentUserId={currentUserId}
						listError={listError}
						listHasMore={listHasMore}
						listLoading={listLoading}
						listLoadingMore={listLoadingMore}
						onExpenseDeleted={onExpenseDeleted}
						onLoadMore={onLoadMore}
						onReload={onReload}
						onSelectExpense={onSelectExpense}
						selectedExpenseId={selectedExpenseId}
						spaceId={selectedSpaceId}
						spaceName={spaceName}
						expenseRecords={spaceExpenseRecords}
					/>
				</div>
			) : (
				<div className="border-b border-border px-4 py-6 text-sm text-muted-foreground">
					Select a space to load expenses.
				</div>
			)}

			<ChatToastPortal message={toastMessage} />
		</SpaceWorkspaceLayout>
	);
};
