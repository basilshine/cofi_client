import type { Transaction } from "@cofi/api";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import type { ExpenseThreadController } from "../hooks/useExpenseThreadState";
import { ExpenseThreadInlinePanel } from "./ExpenseThreadInlinePanel";
import type { ParseTestSnippet } from "./ParseExpenseComposer";

const listHeading = (tx: Transaction): string => {
	const t = tx.title?.trim();
	if (t) return t;
	const d = tx.description?.trim();
	if (d) return d.length > 72 ? `${d.slice(0, 69)}…` : d;
	return `Expense #${String(tx.id)}`;
};

type Props = {
	spaceId: string | number;
	spaceTransactions: Transaction[] | null;
	listLoading: boolean;
	listError: string | null;
	onReloadList: () => void;
	sidebarThreadExpenseId: string | number | null;
	onSelectExpense: (expenseId: string | number) => void;
	onCloseThread: () => void;
	expenseThreadCtrl: ExpenseThreadController;
	currentUserId: number | null;
	draftLineScrollRequest: number | null;
	onDraftLineScrollConsumed: () => void;
	parseTestSnippets: ParseTestSnippet[];
};

export const ChatExpenseRightPanelContent = ({
	spaceId,
	spaceTransactions,
	listLoading,
	listError,
	onReloadList,
	sidebarThreadExpenseId,
	onSelectExpense,
	onCloseThread,
	expenseThreadCtrl,
	currentUserId,
	draftLineScrollRequest,
	onDraftLineScrollConsumed,
	parseTestSnippets,
}: Props) => {
	const { formatMoney, formatDateTime } = useUserFormat();

	if (sidebarThreadExpenseId != null) {
		return (
			<div className="flex min-h-[min(100dvh-12rem,720px)] flex-col px-1 pb-3 pt-1 sm:px-2">
				<ExpenseThreadInlinePanel
					closeLabel="← Back to expense list"
					controller={expenseThreadCtrl}
					currentUserId={currentUserId}
					draftLineScrollRequest={draftLineScrollRequest}
					formatDateTime={formatDateTime}
					formatMoney={formatMoney}
					onClose={onCloseThread}
					onDraftLineScrollConsumed={onDraftLineScrollConsumed}
					parseTestSnippets={parseTestSnippets}
					spaceId={spaceId}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-3 px-3 py-3 sm:px-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-[11px] leading-snug text-muted-foreground">
					Approved expenses linked to this space (from your Ceits history).
					Open one to use the full thread — review, splits, and discussion.
				</p>
				<button
					aria-label="Reload expense list"
					className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
					disabled={listLoading}
					onClick={() => onReloadList()}
					type="button"
				>
					{listLoading ? "Loading…" : "Reload"}
				</button>
			</div>

			{listError ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{listError}
				</div>
			) : null}

			{listLoading && !spaceTransactions?.length ? (
				<p className="text-sm text-muted-foreground">Loading expenses…</p>
			) : null}

			{!listLoading && spaceTransactions && spaceTransactions.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No expenses in this space yet. Confirm a draft from chat or add one
					from capture.
				</p>
			) : null}

			{spaceTransactions && spaceTransactions.length > 0 ? (
				<ul className="space-y-2">
					{spaceTransactions.map((tx) => (
						<li key={`exp-${String(tx.id)}`}>
							<button
								aria-label={`Open expense thread ${listHeading(tx)}`}
								className="w-full rounded-xl border border-border/80 bg-card/90 p-3 text-left shadow-sm ring-1 ring-border/20 transition hover:border-primary/35 hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								onClick={() => onSelectExpense(tx.id)}
								type="button"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="truncate text-xs font-semibold text-muted-foreground">
											#{String(tx.id)}
											{tx.currency ? (
												<span className="ml-1.5 font-normal">· {tx.currency}</span>
											) : null}
										</div>
										<div className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
											{listHeading(tx)}
										</div>
										{tx.created_at ? (
											<div className="mt-1 text-[10px] text-muted-foreground">
												{formatDateTime(tx.created_at)}
											</div>
										) : null}
									</div>
									<div className="shrink-0 text-right">
										<div className="text-sm font-semibold tabular-nums text-foreground">
											{formatMoney(tx.total)}
										</div>
									</div>
								</div>
								{tx.items?.length ? (
									<div className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
										{tx.items.slice(0, 2).map((it) => (
											<div
												className="flex justify-between gap-2"
												key={String(it.name) + String(it.amount)}
											>
												<span className="min-w-0 truncate">{it.name}</span>
												<span className="shrink-0 tabular-nums">
													{formatMoney(it.amount)}
												</span>
											</div>
										))}
										{tx.items.length > 2 ? (
											<div className="mt-0.5 text-[10px]">
												+{tx.items.length - 2} more
											</div>
										) : null}
									</div>
								) : null}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
};
