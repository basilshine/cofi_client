import type { ExpenseDetail, Transaction } from "@cofi/api";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	EntityDetailHeader,
	EntityListItem,
} from "../../../shared/lib/entityPresentation";
import {
	expenseItemTagNames,
	toExpenseItemEntity,
} from "../../../shared/lib/expenseItemPresentation";
import {
	expenseStatusClass,
	expenseStatusLabel,
	toTransactionExpenseEntity,
} from "../../../shared/lib/expensePresentation";
import { ExpenseInlineActions } from "../../transactions/components/RecurringScheduleInlineActions";
import { parseTags } from "./transactionBuilderTypes";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	transaction: Transaction | null;
	titleId: string;
	onRequestCopyToWorkspace: () => void;
	/** When true, open dialog already in edit mode (after load). */
	initialEditMode?: boolean;
	onMutated?: () => void | Promise<void>;
};

type EditRow = {
	name: string;
	amount: string;
	emotion: string;
	tagsInput: string;
};

const tagNamesFromItem = (
	tags: Array<{ name?: string }> | undefined,
): string[] => expenseItemTagNames({ tags });

const expenseToEditRows = (exp: ExpenseDetail | null): EditRow[] => {
	const items = exp?.items ?? [];
	if (!items.length) {
		return [{ name: "", amount: "", emotion: "", tagsInput: "general" }];
	}
	return items.map((it) => ({
		name: it.name ?? "",
		amount: String(it.amount ?? ""),
		emotion: it.emotion ?? "",
		tagsInput: tagNamesFromItem(it.tags).join(", "),
	}));
};

const loadSpaceExpense = (transaction: Transaction): Promise<ExpenseDetail> =>
	apiClient.spaces.expenses.get(transaction.space_id, transaction.id);

const updateSpaceExpense = (
	transaction: Transaction,
	body: Parameters<typeof apiClient.spaces.expenses.update>[2],
): Promise<ExpenseDetail> =>
	apiClient.spaces.expenses.update(transaction.space_id, transaction.id, body);

export const SpaceTransactionDetailDialog = ({
	open,
	onOpenChange,
	transaction,
	titleId,
	onRequestCopyToWorkspace,
	initialEditMode = false,
	onMutated,
}: Props) => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [expense, setExpense] = useState<ExpenseDetail | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editDescription, setEditDescription] = useState("");
	const [editRows, setEditRows] = useState<EditRow[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	useEffect(() => {
		const d = dialogRef.current;
		if (!d) return;
		if (open && transaction) {
			d.showModal();
		} else if (d.open) {
			d.close();
		}
	}, [open, transaction]);

	useEffect(() => {
		if (!open || !transaction) {
			setExpense(null);
			setLoadError(null);
			setIsEditing(false);
			setSaveError(null);
			return;
		}
		let cancelled = false;
		const run = async () => {
			setLoadError(null);
			setSaveError(null);
			try {
				const data = await loadSpaceExpense(transaction);
				if (cancelled) return;
				setExpense(data);
				setEditDescription(data.description ?? "");
				setEditRows(expenseToEditRows(data));
				setIsEditing(initialEditMode);
			} catch (e) {
				if (!cancelled) {
					setExpense(null);
					setLoadError(
						e instanceof Error ? e.message : "Failed to load expense",
					);
				}
			}
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [open, transaction, initialEditMode]);

	const handleChangeClick = () => {
		const ok = window.confirm(
			"Copy this expense into the workspace as editable line items? Your current workspace content will be replaced. Saved expense records are not edited in place — you are creating a new candidate from this copy.",
		);
		if (!ok) return;
		onRequestCopyToWorkspace();
		onOpenChange(false);
	};

	const handleStartEdit = () => {
		if (!expense) return;
		setEditDescription(expense.description ?? "");
		setEditRows(expenseToEditRows(expense));
		setSaveError(null);
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		if (expense) {
			setEditDescription(expense.description ?? "");
			setEditRows(expenseToEditRows(expense));
		}
		setSaveError(null);
	};

	const handleRowChange = (
		index: number,
		field: keyof EditRow,
		value: string,
	) => {
		setEditRows((prev) => {
			const next = [...prev];
			const row = next[index];
			if (!row) return prev;
			next[index] = { ...row, [field]: value };
			return next;
		});
	};

	const handleAddRow = () => {
		setEditRows((prev) => [
			...prev,
			{ name: "", amount: "", emotion: "", tagsInput: "general" },
		]);
	};

	const handleRemoveRow = (index: number) => {
		setEditRows((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSaveEdit = async () => {
		if (!transaction || !expense) return;
		const rows = editRows.filter((r) => r.name.trim() && r.amount.trim());
		if (!rows.length) {
			setSaveError("Add at least one line with a name and amount.");
			return;
		}
		setIsSaving(true);
		setSaveError(null);
		try {
			const itemsPayload = rows.map((row) => {
				const amount = Number(String(row.amount).replace(",", "."));
				const tagNames = parseTags(row.tagsInput);
				const tags = tagNames.length > 0 ? tagNames : ["general"];
				return {
					amount,
					name: row.name.trim(),
					emotion: row.emotion.trim(),
					tags: tags.map((name) => ({ name })),
				};
			});
			await updateSpaceExpense(transaction, {
				description: editDescription.trim(),
				items: itemsPayload,
			});
			const fresh = await loadSpaceExpense(transaction);
			setExpense(fresh);
			setIsEditing(false);
			if (onMutated) await onMutated();
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : "Failed to save");
		} finally {
			setIsSaving(false);
		}
	};

	if (!transaction) return null;

	const displayTotal =
		expense?.items?.reduce((acc, it) => acc + (Number(it.amount) || 0), 0) ??
		transaction.total;

	const txForActions: Transaction = {
		...transaction,
		recurring_id: expense?.recurring_id ?? transaction.recurring_id,
		recurring_paused: expense?.recurring_paused ?? transaction.recurring_paused,
	};
	const entityStatus = expense?.status ?? transaction.status;
	const sourceDocumentId =
		expense?.source_document_id ?? transaction.source_document_id ?? null;
	const sourceCaptureHref =
		sourceDocumentId != null && Number(sourceDocumentId) > 0
			? `/console/review?spaceId=${encodeURIComponent(String(transaction.space_id))}&sourceDocumentId=${encodeURIComponent(String(sourceDocumentId))}`
			: null;
	const expenseEntity = toTransactionExpenseEntity(
		{ ...transaction, status: entityStatus },
		{
			amountLabel: formatMoney(displayTotal),
		},
	);

	return (
		<dialog
			aria-labelledby={titleId}
			className="z-[70] max-h-[85vh] w-[min(100%,28rem)] overflow-hidden rounded-lg border border-border bg-card p-0 shadow-xl backdrop:bg-black/50 open:flex open:flex-col"
			onClose={() => onOpenChange(false)}
			ref={dialogRef}
		>
			<div className="border-b border-border px-4 py-3">
				<EntityDetailHeader
					entity={{
						...expenseEntity,
						status: expenseStatusLabel(entityStatus),
						statusClassName: expenseStatusClass(entityStatus),
					}}
					size="md"
					titleId={titleId}
					trailing={
						<div className="rounded-xl border border-[rgba(120,100,80,0.14)] bg-white/70 px-3 py-2 text-right shadow-sm">
							<div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								Amount
							</div>
							<div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
								{formatMoney(displayTotal)}
							</div>
						</div>
					}
				/>
				<p className="mt-1 text-xs text-muted-foreground">
					{isEditing
						? "Edit description and line items, then save."
						: "View, edit in place, delete, or copy to the manual workspace."}
				</p>
			</div>
			<div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-3">
				{loadError ? (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
						{loadError}
					</div>
				) : null}

				{!isEditing && expense ? (
					<>
						{transaction.created_at ? (
							<div className="text-xs text-muted-foreground">
								{formatDateTime(transaction.created_at)}
							</div>
						) : null}
						{sourceCaptureHref ? (
							<div className="rounded-lg border border-[rgba(48,83,120,0.18)] bg-[rgba(239,247,255,0.68)] px-3 py-2 text-xs text-[rgba(34,72,108,0.92)]">
								<div className="font-semibold">
									Source capture #{sourceDocumentId}
								</div>
								<Link
									className="mt-1 inline-flex font-semibold underline-offset-2 hover:underline"
									to={sourceCaptureHref}
								>
									Review capture
								</Link>
							</div>
						) : null}
						<ul className="space-y-2 border-t border-border pt-3">
							{(expense.items ?? []).map((it, idx) => {
								const itemEntity = toExpenseItemEntity(it, { index: idx });
								return (
									<li key={`${String(transaction.id)}-${idx}-${it.name}`}>
										<EntityListItem
											entity={itemEntity}
											trailing={
												<span className="rounded-xl border border-[rgba(110,104,92,0.14)] bg-white/70 px-3 py-2 text-sm font-semibold tabular-nums text-foreground shadow-sm">
													{formatMoney(it.amount)}
												</span>
											}
										/>
									</li>
								);
							})}
						</ul>
					</>
				) : null}

				{isEditing ? (
					<div className="space-y-3 border-t border-border pt-3">
						<label className="grid gap-1">
							<span className="text-xs font-medium text-muted-foreground">
								Description
							</span>
							<textarea
								aria-label="Expense description"
								className="min-h-[4rem] w-full resize-y rounded-md border border-border bg-background p-2 text-sm"
								onChange={(e) => setEditDescription(e.target.value)}
								value={editDescription}
							/>
						</label>
						<div className="text-xs font-medium text-muted-foreground">
							Line items
						</div>
						<div className="space-y-2">
							{editRows.map((row, index) => (
								<div
									className="grid gap-2 rounded-md border border-border p-2"
									key={`edit-${String(transaction.id)}-${index}`}
								>
									<input
										aria-label={`Item ${index + 1} name`}
										className="h-9 rounded-md border border-border bg-background px-2 text-sm"
										onChange={(e) =>
											handleRowChange(index, "name", e.target.value)
										}
										placeholder="Name"
										type="text"
										value={row.name}
									/>
									<div className="grid grid-cols-2 gap-2">
										<input
											aria-label={`Item ${index + 1} amount`}
											className="h-9 rounded-md border border-border bg-background px-2 text-sm"
											inputMode="decimal"
											onChange={(e) =>
												handleRowChange(index, "amount", e.target.value)
											}
											placeholder="Amount"
											type="text"
											value={row.amount}
										/>
										<input
											aria-label={`Item ${index + 1} emotion`}
											className="h-9 rounded-md border border-border bg-background px-2 text-sm"
											onChange={(e) =>
												handleRowChange(index, "emotion", e.target.value)
											}
											placeholder="Emotion"
											type="text"
											value={row.emotion}
										/>
									</div>
									<input
										aria-label={`Item ${index + 1} tags`}
										className="h-9 rounded-md border border-border bg-background px-2 text-sm"
										onChange={(e) =>
											handleRowChange(index, "tagsInput", e.target.value)
										}
										placeholder="Tags, comma-separated"
										type="text"
										value={row.tagsInput}
									/>
									<button
										className="text-xs text-muted-foreground underline disabled:opacity-40"
										disabled={editRows.length <= 1}
										onClick={() => handleRemoveRow(index)}
										type="button"
									>
										Remove line
									</button>
								</div>
							))}
						</div>
						<button
							className="text-xs font-medium text-primary underline"
							onClick={handleAddRow}
							type="button"
						>
							Add line
						</button>
						{saveError ? (
							<div className="text-sm text-destructive">{saveError}</div>
						) : null}
					</div>
				) : null}

				{expense && !isEditing ? (
					<div className="border-t border-border pt-3">
						<div className="mb-2 text-[10px] font-medium text-muted-foreground">
							Schedule &amp; expense record
						</div>
						<ExpenseInlineActions
							expenseId={transaction.id}
							onAfterChange={async () => {
								if (onMutated) await onMutated();
								if (!transaction) return;
								try {
									const data = await loadSpaceExpense(transaction);
									setExpense(data);
								} catch {
									onOpenChange(false);
								}
							}}
							recurringId={
								txForActions.recurring_id != null &&
								Number(txForActions.recurring_id) > 0
									? Number(txForActions.recurring_id)
									: undefined
							}
							recurringPaused={txForActions.recurring_paused}
							spaceId={transaction.space_id}
						/>
					</div>
				) : null}
			</div>
			<div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
				<button
					className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
					onClick={() => onOpenChange(false)}
					type="button"
				>
					Close
				</button>
				{!isEditing && expense ? (
					<button
						className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
						onClick={handleStartEdit}
						type="button"
					>
						Edit
					</button>
				) : null}
				{isEditing ? (
					<>
						<button
							className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent"
							disabled={isSaving}
							onClick={handleCancelEdit}
							type="button"
						>
							Cancel edit
						</button>
						<button
							className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
							disabled={isSaving || !!loadError}
							onClick={() => void handleSaveEdit()}
							type="button"
						>
							{isSaving ? "Saving…" : "Save changes"}
						</button>
					</>
				) : null}
				{!isEditing ? (
					<button
						className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
						onClick={handleChangeClick}
						type="button"
					>
						Copy to workspace
					</button>
				) : null}
			</div>
		</dialog>
	);
};
