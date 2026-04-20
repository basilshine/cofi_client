import { ManualTransactionEditor } from "./ManualTransactionEditor";
import type { BuilderItem } from "./transactionBuilderTypes";

type Props = {
	disabled: boolean;
	manualDescription: string;
	manualItems: BuilderItem[];
	activeDraftExpenseId: string | number | null;
	onChangeDescription: (v: string) => void;
	onChangeItem: (id: string, patch: Partial<BuilderItem>) => void;
	onAddItem: () => void;
	onRemoveItem: (id: string) => void;
	onSaveDraft: () => void;
	onApproveDraft: () => void;
	onDeclineDraft: () => void;
	onDeleteWorkspace: () => void;
};

export const ExpenseWorkspaceManualPanel = ({
	disabled,
	manualDescription,
	manualItems,
	activeDraftExpenseId,
	onChangeDescription,
	onChangeItem,
	onAddItem,
	onRemoveItem,
	onSaveDraft,
	onApproveDraft,
	onDeclineDraft,
	onDeleteWorkspace,
}: Props) => {
	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-sm font-semibold">Manual expense</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Each line can be one-time or recurring. Save draft, then approve.
				</p>
			</div>
			<ManualTransactionEditor
				description={manualDescription}
				disabled={disabled}
				items={manualItems}
				onAddItem={onAddItem}
				onChangeDescription={onChangeDescription}
				onChangeItem={onChangeItem}
				onRemoveItem={onRemoveItem}
				onSaveDraft={() => void onSaveDraft()}
			/>

			{activeDraftExpenseId ? (
				<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3">
					<div className="text-xs font-medium text-muted-foreground">
						Active draft:{" "}
						<span className="font-semibold text-foreground">
							{String(activeDraftExpenseId)}
						</span>
					</div>
					<div className="ml-auto flex flex-wrap items-center gap-2">
						<button
							aria-label="Approve active draft"
							className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
							disabled={disabled}
							onClick={() => void onApproveDraft()}
							type="button"
						>
							Approve
						</button>
						<button
							aria-label="Decline active draft"
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={disabled}
							onClick={() => void onDeclineDraft()}
							type="button"
						>
							Decline
						</button>
						<button
							aria-label="Clear workspace draft"
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
							disabled={disabled}
							onClick={() => void onDeleteWorkspace()}
							type="button"
						>
							Clear
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
};
