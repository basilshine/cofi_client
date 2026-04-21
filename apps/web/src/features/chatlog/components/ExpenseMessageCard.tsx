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
};

export const ExpenseMessageCard = ({
	transactionId,
	spaceId,
	chatWorkspace,
	onOpenExpenseThread,
	onTransactionOrphaned,
	compact = false,
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
				const data = await apiClient.transactions.getById(transactionId);
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
	}, [transactionId, reloadToken]);

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
		const compactRows = tx.items.slice(0, 10);
		const compactMoreCount = Math.max(0, tx.items.length - compactRows.length);

		const chatToolbarBtn =
			"inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:h-9";

		const heading =
			tx.title?.trim() ||
			tx.description?.trim() ||
			`Confirmed expense #${String(tx.id)}`;

		return (
			<div className="w-full min-w-0 max-w-full space-y-2">
				<div className="space-y-2.5 rounded-lg border border-border/80 bg-gradient-to-br from-muted/50 to-card/95 p-3 shadow-sm ring-1 ring-border/15">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="min-w-0">
							<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
								Confirmed expense · #{String(tx.id)}
							</div>
							<div className="mt-0.5 line-clamp-3 text-sm font-semibold leading-snug text-foreground">
								{heading}
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								Total{" "}
								<span className="font-semibold tabular-nums text-foreground">
									{formatMoney(tx.total)}
								</span>
								{tx.created_at ? (
									<span className="ml-2 text-[10px]">
										· {formatDateTime(tx.created_at)}
									</span>
								) : null}
							</div>
						</div>
					</div>

					{compactRows.length > 0 ? (
						<div className="overflow-hidden rounded-lg border border-border/70 bg-muted/25">
							<table className="w-full min-w-0 border-collapse text-left text-[11px]">
								<thead>
									<tr className="border-b border-border/60 bg-muted/60">
										<th
											className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
											scope="col"
										>
											Line
										</th>
										<th
											className="px-2.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
											scope="col"
										>
											Amount
										</th>
									</tr>
								</thead>
								<tbody>
									{compactRows.map((it, idx) => (
										<tr
											className="border-b border-border/40 last:border-b-0"
											key={`${String(tx.id)}-${idx}-${it.name}`}
										>
											<td className="max-w-[14rem] px-2.5 py-1.5 font-medium text-foreground">
												<span className="line-clamp-2">{it.name}</span>
											</td>
											<td className="whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
												{formatMoney(it.amount)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{compactMoreCount > 0 ? (
								<div className="border-t border-border/50 bg-muted/40 px-2.5 py-1.5 text-[10px] text-muted-foreground">
									+{compactMoreCount} more line{compactMoreCount === 1 ? "" : "s"} —
									open thread for full detail
								</div>
							) : null}
						</div>
					) : (
						<p className="rounded-md border border-dashed border-border/80 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
							No line items on this posting.
						</p>
					)}

					{tx.items.some((i) => i.tags?.length) ? (
						<div className="flex flex-wrap gap-1.5">
							{Array.from(
								new Set(tx.items.flatMap((i) => i.tags ?? []).filter(Boolean)),
							)
								.slice(0, 8)
								.map((t) => (
									<span
										className="rounded-md bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60"
										key={t}
									>
										{t}
									</span>
								))}
						</div>
					) : null}
				</div>

				<div className="space-y-2 border-t border-border/40 pt-2">
					<div className="flex flex-wrap items-center gap-2">
						<button
							aria-label="Open expense discussion thread"
							className={`${chatToolbarBtn} border-border bg-background hover:bg-accent`}
							onClick={handleOpen}
							type="button"
						>
							Open thread
						</button>
					</div>
					<div className="rounded-lg border border-border/60 bg-muted/20 p-2">
						<div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							Posting actions
						</div>
						<TransactionInlineActions
							className="!space-y-1.5"
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
