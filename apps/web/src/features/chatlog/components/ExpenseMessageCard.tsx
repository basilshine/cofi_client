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
};

export const ExpenseMessageCard = ({
	transactionId,
	spaceId,
	chatWorkspace,
	onOpenExpenseThread,
	onTransactionOrphaned,
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
