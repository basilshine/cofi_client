import type { SpaceMember } from "@cofi/api";
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { apiClient } from "../../../shared/lib/apiClient";
import {
	type SplitPercentRow,
	applyAmountsToSplitRows,
	equalSplitRows,
	ownerHundredSplitRows,
	percentsToAmounts,
	splitRowKey,
	splitRowsFromParticipants,
	userCanManageExpenseSplits,
} from "../lib/spaceExpenseSplits";

/** 50% expense owner, remaining 50% split equally among everyone else in the space. */
const ownerHalfRestEqualPercents = (
	rows: SplitPercentRow[],
	ownerUserId: number,
): SplitPercentRow[] => {
	const others = rows.filter((row) => Number(row.user_id) !== ownerUserId);
	const n = others.length;
	if (n === 0) return ownerHundredSplitRows(rows, ownerUserId);
	const eq = 50 / n;
	const byRow = new Map(
		others.map((row, i) => [
			splitRowKey(row),
			i === n - 1
				? String(Math.round((50 - eq * (n - 1)) * 100) / 100)
				: String(Math.round(eq * 100) / 100),
		]),
	);
	return rows.map((row) => {
		if (Number(row.user_id) === ownerUserId) return { ...row, percent: "50" };
		return { ...row, percent: byRow.get(splitRowKey(row)) ?? "0" };
	});
};

const twoWaySplitPercents = (rows: SplitPercentRow[]): SplitPercentRow[] => {
	if (rows.length !== 2) return equalSplitRows(rows);
	return rows.map((row) => ({ ...row, percent: "50" }));
};

export type ExpenseSplitDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	spaceId: string | number;
	expenseId: string | number;
	expenseTotal: number;
	/** Expense owner. */
	expenseOwnerUserId: number;
	currentUserId: number | null;
	formatMoney: (n: number) => string;
	onSaved?: () => void;
};

/**
 * Full-screen split editor for a space expense.
 */
export const ExpenseSplitDialog = ({
	open,
	onOpenChange,
	spaceId,
	expenseId,
	expenseTotal,
	expenseOwnerUserId,
	currentUserId,
	formatMoney,
	onSaved,
}: ExpenseSplitDialogProps) => {
	const titleId = useId();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [members, setMembers] = useState<SpaceMember[]>([]);
	const [expenseStatus, setExpenseStatus] = useState<string | null>(null);
	const [loadedExpenseOwnerUserId, setLoadedExpenseOwnerUserId] =
		useState<number>(expenseOwnerUserId);
	const [splitRows, setSplitRows] = useState<SplitPercentRow[]>([]);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	/** Open/close native modal after paint; `showModal` must run when the dialog node exists. */
	useLayoutEffect(() => {
		const el = dialogRef.current;
		if (!el) return;
		if (open) {
			if (!el.open) el.showModal();
		} else {
			el.close();
		}
	}, [open]);

	const loadData = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		setActionError(null);
		if (expenseOwnerUserId <= 0) {
			setLoadError("Missing expense owner — reload the expense and try again.");
			setLoading(false);
			return;
		}
		try {
			const [expense, memRes, participantRes, splitRes] = await Promise.all([
				apiClient.spaces.expenses.get(spaceId, expenseId),
				apiClient.spaces.listMembers(spaceId),
				apiClient.spaces.listParticipants(spaceId),
				apiClient.spaces.expenses
					.listSplits(spaceId, expenseId)
					.catch(() => null),
			]);
			const mem = memRes.members ?? [];
			setExpenseStatus(expense.status ?? null);
			setLoadedExpenseOwnerUserId(expense.user_id ?? expenseOwnerUserId);
			setMembers(mem);
			const total = expenseTotal;
			const participantRows = splitRowsFromParticipants(
				participantRes.participants ?? [],
			);
			if (participantRows.length === 0) {
				throw new Error("No space participants found for this expense.");
			}
			if (splitRes?.splits?.length && total > 0) {
				setSplitRows(
					applyAmountsToSplitRows(participantRows, splitRes.splits, total),
				);
			} else {
				setSplitRows(
					ownerHundredSplitRows(participantRows, expenseOwnerUserId),
				);
			}
		} catch (e) {
			setLoadError(
				e instanceof Error ? e.message : "Failed to load split editor",
			);
			setMembers([]);
			setExpenseStatus(null);
			setLoadedExpenseOwnerUserId(expenseOwnerUserId);
			setSplitRows([]);
		} finally {
			setLoading(false);
		}
	}, [spaceId, expenseId, expenseTotal, expenseOwnerUserId]);

	useEffect(() => {
		if (!open) return;
		void loadData();
	}, [open, loadData]);

	const finalized =
		expenseStatus === "approved" || expenseStatus === "cancelled";
	const canEdit =
		currentUserId != null &&
		!finalized &&
		userCanManageExpenseSplits(
			loadedExpenseOwnerUserId,
			members,
			currentUserId,
		);

	const setPercentChange = useCallback((rowKey: string, value: string) => {
		setSplitRows((prev) =>
			prev.map((row) =>
				splitRowKey(row) === rowKey ? { ...row, percent: value } : row,
			),
		);
	}, []);

	const bumpPercent = useCallback((rowKey: string, delta: number) => {
		setSplitRows((prev) =>
			prev.map((row) => {
				if (splitRowKey(row) !== rowKey) return row;
				const p = Number.parseFloat(row.percent);
				const base = Number.isNaN(p) ? 0 : p;
				const next = Math.max(
					0,
					Math.min(100, Math.round((base + delta) * 100) / 100),
				);
				return { ...row, percent: String(next) };
			}),
		);
	}, []);

	const handleSave = async () => {
		if (
			currentUserId == null ||
			!canEdit ||
			expenseTotal <= 0 ||
			splitRows.length === 0 ||
			expenseOwnerUserId <= 0
		)
			return;
		const pcts = splitRows.map((r) => Number.parseFloat(r.percent));
		if (pcts.some((p) => Number.isNaN(p) || p < 0)) {
			setActionError("Enter a valid percentage for each member.");
			return;
		}
		const sumPct = pcts.reduce((s, p) => s + p, 0);
		if (Math.abs(sumPct - 100) > 0.1) {
			setActionError("Percentages must sum to 100%.");
			return;
		}
		const amounts = percentsToAmounts(pcts, expenseTotal);
		if (splitRows.some((row) => row.space_participant_id == null)) {
			setActionError("Each split line must have a space participant.");
			return;
		}
		setSaving(true);
		setActionError(null);
		try {
			await apiClient.spaces.expenses.putSplits(
				spaceId,
				expenseId,
				splitRows.map((r, i) => ({
					space_participant_id: Number(r.space_participant_id),
					amount: amounts[i] ?? 0,
				})),
			);
			onSaved?.();
			onOpenChange(false);
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Failed to save splits");
		} finally {
			setSaving(false);
		}
	};

	const nParticipants = splitRows.length;

	const dialogNode = (
		<dialog
			aria-labelledby={titleId}
			className="fixed inset-0 z-[200] max-h-none w-full max-w-none border-0 bg-transparent p-4 backdrop:bg-black/50"
			onCancel={(e) => {
				e.preventDefault();
				onOpenChange(false);
			}}
			ref={dialogRef}
		>
			<div className="flex max-h-[min(100vh,100dvh)] w-full items-start justify-center overflow-y-auto py-6">
				<div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg">
					<h2 className="text-base font-semibold text-foreground" id={titleId}>
						Split expense
					</h2>
					<p className="mt-1 text-xs leading-snug text-muted-foreground">
						Set how the total ({formatMoney(expenseTotal)}) is shared between
						space participants. Percentages must sum to 100%. The expense owner
						or space owner can save changes.
					</p>

					{loading ? (
						<p className="mt-4 text-sm text-muted-foreground">Loading…</p>
					) : null}
					{loadError ? (
						<div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{loadError}
						</div>
					) : null}

					{!loading && !loadError && splitRows.length > 0 ? (
						<>
							<div className="mt-4 overflow-x-auto rounded-lg border border-border">
								<table className="w-full min-w-[280px] text-left text-sm">
									<thead>
										<tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
											<th className="px-2 py-2 font-medium">Member</th>
											<th className="px-2 py-2 font-medium">%</th>
											<th className="px-2 py-2 font-medium">≈ Amount</th>
										</tr>
									</thead>
									<tbody>
										{splitRows.map((row) => {
											const pct = Number.parseFloat(row.percent);
											const approx =
												!Number.isNaN(pct) && expenseTotal > 0
													? formatMoney((expenseTotal * pct) / 100)
													: "—";
											return (
												<tr
													className="border-b border-border/60"
													key={splitRowKey(row)}
												>
													<td className="px-2 py-2">{row.label}</td>
													<td className="px-2 py-2">
														{canEdit ? (
															<div className="flex items-center gap-1">
																<button
																	aria-label={`Decrease percent for ${row.label}`}
																	className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
																	disabled={saving}
																	onClick={() =>
																		bumpPercent(splitRowKey(row), -1)
																	}
																	type="button"
																>
																	−
																</button>
																<input
																	aria-label={`Percent for ${row.label}`}
																	className="w-16 rounded border border-border bg-background px-1 py-1 text-center font-mono text-xs"
																	inputMode="decimal"
																	onChange={(e) =>
																		setPercentChange(
																			splitRowKey(row),
																			e.target.value,
																		)
																	}
																	type="text"
																	value={row.percent}
																/>
																<button
																	aria-label={`Increase percent for ${row.label}`}
																	className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
																	disabled={saving}
																	onClick={() =>
																		bumpPercent(splitRowKey(row), 1)
																	}
																	type="button"
																>
																	+
																</button>
															</div>
														) : (
															<span className="font-mono text-xs">
																{row.percent}%
															</span>
														)}
													</td>
													<td className="px-2 py-2 text-xs text-muted-foreground">
														{approx}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

							{canEdit ? (
								<div className="mt-3 flex flex-wrap gap-2">
									<button
										className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
										onClick={() =>
											setSplitRows(
												ownerHundredSplitRows(splitRows, expenseOwnerUserId),
											)
										}
										type="button"
									>
										Owner 100%
									</button>
									<button
										className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
										onClick={() =>
											setSplitRows(
												ownerHalfRestEqualPercents(
													splitRows,
													expenseOwnerUserId,
												),
											)
										}
										type="button"
									>
										Owner 50% · rest equal
									</button>
									<button
										className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
										onClick={() => setSplitRows(equalSplitRows(splitRows))}
										type="button"
									>
										Equal ({nParticipants})
									</button>
									{nParticipants === 2 ? (
										<button
											className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
											onClick={() =>
												setSplitRows(twoWaySplitPercents(splitRows))
											}
											type="button"
										>
											50 / 50
										</button>
									) : null}
								</div>
							) : (
								<p className="mt-3 text-xs text-muted-foreground">
									{finalized
										? "This expense is finalized — splits are read-only."
										: "Only the expense owner or the space owner can edit splits."}
								</p>
							)}

							{actionError ? (
								<div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
									{actionError}
								</div>
							) : null}
						</>
					) : null}

					<div className="mt-6 flex flex-wrap justify-end gap-2">
						<button
							className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
							onClick={() => onOpenChange(false)}
							type="button"
						>
							{canEdit ? "Cancel" : "Close"}
						</button>
						{canEdit ? (
							<button
								className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
								disabled={saving || loading || expenseTotal <= 0}
								onClick={() => void handleSave()}
								type="button"
							>
								{saving ? "Saving…" : "Save splits"}
							</button>
						) : null}
					</div>
				</div>
			</div>
		</dialog>
	);

	if (typeof document === "undefined") return null;
	return createPortal(dialogNode, document.body);
};
