import type { ExpenseThreadSummary, SpaceMember } from "@cofi/api";
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
	percentsToAmounts,
	userIsThreadOrSpaceMaster,
} from "../hooks/useExpenseThreadState";

const memberLabel = (members: SpaceMember[], userId: number): string => {
	const m = members.find((x) => Number(x.user_id) === userId);
	if (!m) return `User #${userId}`;
	return m.name?.trim() || m.email?.trim() || `User #${userId}`;
};

const equalPercentsForMembers = (members: SpaceMember[]): SplitPercentRow[] => {
	const n = members.length;
	if (n <= 0) return [];
	const eq = 100 / n;
	return members.map((m, i) => ({
		user_id: Number(m.user_id),
		percent:
			i === n - 1
				? String(Math.round((100 - eq * (n - 1)) * 100) / 100)
				: String(Math.round(eq * 100) / 100),
	}));
};

const ownerHundredPercents = (
	members: SpaceMember[],
	ownerUserId: number,
): SplitPercentRow[] =>
	members.map((m) => {
		const uid = Number(m.user_id);
		return {
			user_id: uid,
			percent: uid === ownerUserId ? "100" : "0",
		};
	});

/** 50% draft owner, remaining 50% split equally among everyone else in the space. */
const ownerHalfRestEqualPercents = (
	members: SpaceMember[],
	ownerUserId: number,
): SplitPercentRow[] => {
	const others = members.filter((m) => Number(m.user_id) !== ownerUserId);
	const n = others.length;
	if (n === 0) return ownerHundredPercents(members, ownerUserId);
	const eq = 50 / n;
	const otherRows: SplitPercentRow[] = others.map((m, i) => ({
		user_id: Number(m.user_id),
		percent:
			i === n - 1
				? String(Math.round((50 - eq * (n - 1)) * 100) / 100)
				: String(Math.round(eq * 100) / 100),
	}));
	const byId = new Map(otherRows.map((r) => [r.user_id, r]));
	return members.map((m) => {
		const uid = Number(m.user_id);
		if (uid === ownerUserId) return { user_id: uid, percent: "50" };
		return byId.get(uid) ?? { user_id: uid, percent: "0" };
	});
};

const twoWaySplitPercents = (members: SpaceMember[]): SplitPercentRow[] => {
	if (members.length !== 2) return equalPercentsForMembers(members);
	return members.map((m) => ({
		user_id: Number(m.user_id),
		percent: "50",
	}));
};

export type ExpenseSplitDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	spaceId: string | number;
	expenseId: string | number;
	expenseTotal: number;
	/** Draft / expense owner (thread creator in this product). */
	expenseOwnerUserId: number;
	currentUserId: number | null;
	formatMoney: (n: number) => string;
	onSaved?: () => void;
};

/**
 * Full-screen split editor for a space expense (same rules as the expense thread sidebar).
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
	const [summary, setSummary] = useState<ExpenseThreadSummary | null>(null);
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
			setLoadError("Missing expense owner — reload the draft and try again.");
			setLoading(false);
			return;
		}
		try {
			await apiClient.threads.getOrCreate(spaceId, expenseId);
			const [sum, memRes, splitRes] = await Promise.all([
				apiClient.threads.getSummary(spaceId, expenseId),
				apiClient.spaces.listMembers(spaceId),
				apiClient.finances.expenses.listSplits(expenseId).catch(() => null),
			]);
			const mem = memRes.members ?? [];
			setSummary(sum);
			setMembers(mem);
			const total = expenseTotal;
			if (splitRes?.splits?.length && total > 0) {
				const byUser = new Map(
					splitRes.splits.map((s) => [s.user_id, s.amount]),
				);
				setSplitRows(
					mem.map((m) => {
						const uid = Number(m.user_id);
						const amt = byUser.get(uid) ?? 0;
						const pct = total > 0 ? (amt / total) * 100 : 0;
						return {
							user_id: uid,
							percent: String(Math.round(pct * 100) / 100),
						};
					}),
				);
			} else {
				setSplitRows(ownerHundredPercents(mem, expenseOwnerUserId));
			}
		} catch (e) {
			setLoadError(
				e instanceof Error ? e.message : "Failed to load split editor",
			);
			setMembers([]);
			setSummary(null);
			setSplitRows([]);
		} finally {
			setLoading(false);
		}
	}, [spaceId, expenseId, expenseTotal, expenseOwnerUserId]);

	useEffect(() => {
		if (!open) return;
		void loadData();
	}, [open, loadData]);

	const finalized = summary?.thread.status === "finalized";
	const canEdit =
		currentUserId != null &&
		summary != null &&
		!finalized &&
		userIsThreadOrSpaceMaster(summary, members, currentUserId);

	const setPercentChange = useCallback((userId: number, value: string) => {
		setSplitRows((prev) =>
			prev.map((row) =>
				row.user_id === userId ? { ...row, percent: value } : row,
			),
		);
	}, []);

	const bumpPercent = useCallback((userId: number, delta: number) => {
		setSplitRows((prev) =>
			prev.map((row) => {
				if (row.user_id !== userId) return row;
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
		setSaving(true);
		setActionError(null);
		try {
			await apiClient.finances.expenses.putSplits(
				expenseId,
				splitRows.map((r, i) => ({
					user_id: r.user_id,
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

	const nMembers = members.length;

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
						space members. Percentages must sum to 100%. Same rules as the
						expense thread: thread creator or space owner can save (creator is
						the expense owner).
					</p>

					{loading ? (
						<p className="mt-4 text-sm text-muted-foreground">Loading…</p>
					) : null}
					{loadError ? (
						<div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{loadError}
						</div>
					) : null}

					{!loading && !loadError && members.length > 0 ? (
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
													key={row.user_id}
												>
													<td className="px-2 py-2">
														{memberLabel(members, row.user_id)}
													</td>
													<td className="px-2 py-2">
														{canEdit ? (
															<div className="flex items-center gap-1">
																<button
																	aria-label={`Decrease percent for ${memberLabel(members, row.user_id)}`}
																	className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
																	disabled={saving}
																	onClick={() => bumpPercent(row.user_id, -1)}
																	type="button"
																>
																	−
																</button>
																<input
																	aria-label={`Percent for ${memberLabel(members, row.user_id)}`}
																	className="w-16 rounded border border-border bg-background px-1 py-1 text-center font-mono text-xs"
																	inputMode="decimal"
																	onChange={(e) =>
																		setPercentChange(
																			row.user_id,
																			e.target.value,
																		)
																	}
																	type="text"
																	value={row.percent}
																/>
																<button
																	aria-label={`Increase percent for ${memberLabel(members, row.user_id)}`}
																	className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-sm hover:bg-accent disabled:opacity-50"
																	disabled={saving}
																	onClick={() => bumpPercent(row.user_id, 1)}
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
												ownerHundredPercents(members, expenseOwnerUserId),
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
												ownerHalfRestEqualPercents(members, expenseOwnerUserId),
											)
										}
										type="button"
									>
										Owner 50% · rest equal
									</button>
									<button
										className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
										onClick={() =>
											setSplitRows(equalPercentsForMembers(members))
										}
										type="button"
									>
										Equal ({nMembers})
									</button>
									{nMembers === 2 ? (
										<button
											className="rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent"
											onClick={() => setSplitRows(twoWaySplitPercents(members))}
											type="button"
										>
											50 / 50
										</button>
									) : null}
								</div>
							) : (
								<p className="mt-3 text-xs text-muted-foreground">
									{finalized
										? "Thread is finalized — splits are read-only."
										: "Only the thread creator or the space owner can edit splits."}
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
