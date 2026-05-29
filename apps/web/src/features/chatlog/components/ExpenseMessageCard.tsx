import type { Transaction } from "@cofi/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import { apiClient } from "../../../shared/lib/apiClient";
import { isNotFoundHttpError } from "../../../shared/lib/apiErrors";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { TransactionInlineActions } from "../../transactions/components/RecurringScheduleInlineActions";

type Props = {
	transactionId: string | number;
	/** Space context for expense thread navigation. */
	spaceId?: string | number;
	/** Active chat workspace (passed through thread deep links). */
	chatWorkspace?: ChatWorkspaceScope;
	/** When set (e.g. ChatLogPage), opens the expense review thread inline instead of navigating. */
	onOpenExpenseThread?: (expenseId: string | number) => void;
	/** When the transaction no longer exists (404); parent may remove the chat row. */
	onTransactionOrphaned?: () => void;
	/** Narrow summary row; primary action opens the workspace expenses panel. */
	compact?: boolean;
	/** Chat-selected visual state when inspector is open for this expense. */
	isSelected?: boolean;
	/** Whether the shared inspector is currently open in chat. */
	inspectorOpen?: boolean;
	/** Timeline updates for this expense object (oldest -> latest). */
	updates?: Array<{
		state: "draft" | "approved" | "needs_review";
		timestamp?: string | null;
		note?: string | null;
	}>;
};

export const ExpenseMessageCard = ({
	transactionId,
	spaceId,
	chatWorkspace,
	onOpenExpenseThread,
	onTransactionOrphaned,
	compact = false,
	isSelected = false,
	inspectorOpen = false,
	updates = [],
}: Props) => {
	const navigate = useNavigate();
	const { formatMoney, formatDateTime } = useUserFormat();
	const [tx, setTx] = useState<Transaction | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [orphanNotice, setOrphanNotice] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);

	useEffect(() => {
		let isMounted = true;
		const run = async () => {
			try {
				const data =
					spaceId == null
						? await apiClient.transactions.getById(transactionId)
						: await apiClient.transactions.getBySpaceAndId(
								spaceId,
								transactionId,
							);
				if (!isMounted) return;
				setTx(data);
				setError(null);
				setOrphanNotice(null);
			} catch (e) {
				if (!isMounted) return;
				setTx(null);
				if (isNotFoundHttpError(e)) {
					setError(null);
					setOrphanNotice(
						"This transaction was removed or is no longer available.",
					);
				} else {
					setOrphanNotice(null);
					setError(
						e instanceof Error ? e.message : "Failed to load transaction",
					);
				}
			}
		};
		void run();
		return () => {
			isMounted = false;
		};
	}, [spaceId, transactionId, reloadToken]);

	useEffect(() => {
		if (!orphanNotice || !onTransactionOrphaned) return;
		const t = window.setTimeout(() => onTransactionOrphaned(), 2500);
		return () => window.clearTimeout(t);
	}, [orphanNotice, onTransactionOrphaned]);

	if (orphanNotice) {
		return (
			<output
				aria-live="polite"
				className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground"
			>
				{orphanNotice}
				{onTransactionOrphaned ? (
					<span className="mt-1 block text-[10px] text-muted-foreground">
						This chat line will be removed in a moment.
					</span>
				) : null}
			</output>
		);
	}

	if (error) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
				Failed to load transaction #{String(transactionId)}: {error}
			</div>
		);
	}

	if (!tx) {
		return (
			<div className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
				Loading transaction #{String(transactionId)}…
			</div>
		);
	}

	if (compact && onOpenExpenseThread && spaceId != null) {
		const handleOpen = () => {
			onOpenExpenseThread(tx.id);
		};
		const selectedInInspector = inspectorOpen && isSelected;
		const compactRows = tx.items.slice(0, 3);
		const compactMoreCount = Math.max(0, tx.items.length - compactRows.length);

		const chatToolbarBtn =
			"inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-8";

		const heading =
			tx.title?.trim() ||
			tx.description?.trim() ||
			`Confirmed expense #${String(tx.id)}`;
		const updateRows =
			updates.length > 0
				? updates
				: [{ state: "approved" as const, timestamp: tx.created_at ?? null }];
		const stateLabel = (state: "draft" | "approved" | "needs_review") => {
			if (state === "draft") return "Draft";
			if (state === "approved") return "Approved";
			return "Needs review";
		};

		return (
			<div className="w-full min-w-0 max-w-full">
				<div
					className={`space-y-1.5 rounded-xl border px-2.5 py-2 shadow-sm ${
						isSelected
							? "border-[rgba(120,98,62,0.42)] bg-[linear-gradient(180deg,#fffbf3_0%,#f8efe2_100%)] shadow-[0_4px_12px_-10px_rgba(70,55,30,0.42)]"
							: "border-emerald-300/35 bg-[linear-gradient(180deg,#f7fcf8_0%,#f1f9f2_100%)]"
					}`}
				>
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
								<span>Ceits saved this</span>
								<span>·</span>
								<span>Approved</span>
							</div>
							<div className="mt-1 flex items-start justify-between gap-3">
								<div className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
									{heading}
								</div>
								<div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
									{formatMoney(tx.total)}
								</div>
							</div>
							<div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
								<span>{tx.items.length} items</span>
								<span>· Approved</span>
								{tx.created_at ? (
									<span>· Saved {formatDateTime(tx.created_at)}</span>
								) : null}
							</div>
						</div>
					</div>

					{compactRows.length > 0 ? (
						<div className="space-y-0.5 rounded-lg bg-[rgba(255,255,255,0.34)] px-2 py-1.5">
							<div className="space-y-0.5">
								{compactRows.map((it, idx) => (
									<div
										className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 text-[11px] text-foreground/90 transition-colors hover:bg-[rgba(120,100,80,0.06)]"
										key={`${String(tx.id)}-${idx}-${it.name}`}
									>
										<span className="line-clamp-1 min-w-0 flex-1">
											{it.name}
										</span>
										<span className="shrink-0 tabular-nums text-muted-foreground">
											{formatMoney(it.amount)}
										</span>
									</div>
								))}
							</div>
							{compactMoreCount > 0 ? (
								<div className="px-1 pt-0.5 text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2">
									+{compactMoreCount} more line
									{compactMoreCount === 1 ? "" : "s"}
								</div>
							) : null}
						</div>
					) : (
						<p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
							No line items on this posting.
						</p>
					)}
					{updateRows.length > 1 ? (
						<div className="pt-0.5 text-[10px] text-muted-foreground">
							History: {updateRows.map((u) => stateLabel(u.state)).join(" -> ")}
						</div>
					) : null}
				</div>

				<div className="mt-1 flex flex-wrap items-center gap-1.5">
					<button
						aria-label="Open expense inspector"
						className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
						onClick={handleOpen}
						type="button"
					>
						View
					</button>
					{!selectedInInspector ? (
						<button
							aria-label="Review split details"
							className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
							onClick={handleOpen}
							type="button"
						>
							Split
						</button>
					) : null}
					<button
						aria-label="Open more expense options"
						className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
						onClick={handleOpen}
						type="button"
					>
						More
					</button>
				</div>
			</div>
		);
	}

	const topItems = tx.items.slice(0, 3);
	const otherCount = Math.max(0, tx.items.length - topItems.length);

	return (
		<div className="rounded-md border border-border bg-muted p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate text-xs font-semibold text-muted-foreground">
						Confirmed expense · tx #{String(tx.id)}
					</div>
					<div className="mt-0.5 text-sm font-semibold">
						{formatMoney(tx.total)}
					</div>
				</div>
				<div className="shrink-0 text-[10px] text-muted-foreground">
					{tx.created_at ? formatDateTime(tx.created_at) : ""}
				</div>
			</div>

			<div className="mt-2 space-y-1">
				{topItems.map((it, idx) => (
					<div
						className="flex items-center justify-between gap-3 text-xs"
						key={`${idx}-${it.name}`}
					>
						<div className="min-w-0 truncate">{it.name}</div>
						<div className="shrink-0 font-mono text-muted-foreground">
							{formatMoney(it.amount)}
						</div>
					</div>
				))}
				{otherCount ? (
					<div className="text-[10px] text-muted-foreground">
						+ {otherCount} more item{otherCount === 1 ? "" : "s"}
					</div>
				) : null}
			</div>

			{tx.items.some((i) => i.tags?.length) ? (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{Array.from(
						new Set(tx.items.flatMap((i) => i.tags ?? []).filter(Boolean)),
					)
						.slice(0, 8)
						.map((t) => (
							<span
								className="rounded bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
								key={t}
							>
								{t}
							</span>
						))}
				</div>
			) : null}

			<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2">
				{spaceId != null ? (
					<button
						aria-label="Open expense discussion thread"
						className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
						onClick={() =>
							onOpenExpenseThread
								? onOpenExpenseThread(tx.id)
								: navigate(
										`/console/chat/thread?spaceId=${encodeURIComponent(String(spaceId))}&expenseId=${encodeURIComponent(String(tx.id))}`,
										{
											state: chatWorkspace ? { chatWorkspace } : undefined,
										},
									)
						}
						type="button"
					>
						Open thread
					</button>
				) : null}
				<TransactionInlineActions
					expenseId={tx.id}
					onAfterChange={() => setReloadToken((n) => n + 1)}
					onResourceGone={onTransactionOrphaned}
					recurringId={
						tx.recurring_id != null && Number(tx.recurring_id) > 0
							? Number(tx.recurring_id)
							: undefined
					}
					recurringPaused={tx.recurring_paused}
				/>
			</div>
		</div>
	);
};
