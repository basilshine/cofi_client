import type { Transaction } from "@cofi/api";
import { useCallback, useEffect, useState } from "react";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import { TransactionInlineActions } from "./components/RecurringScheduleInlineActions";

const primaryHeading = (tx: Transaction): string => {
	const t = tx.title?.trim();
	if (t) return t;
	const d = tx.description?.trim();
	if (d) return d.length > 120 ? `${d.slice(0, 120)}…` : d;
	return `Transaction #${String(tx.id)}`;
};

export const TransactionsPage = () => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const [transactions, setTransactions] = useState<Transaction[] | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [limit, setLimit] = useState(20);

	const handleLoadTransactions = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await apiClient.transactions.list({ limit });
			setTransactions(data);
		} catch (err) {
			setTransactions(null);
			setErrorMessage(
				err instanceof Error ? err.message : "Failed to load transactions",
			);
		} finally {
			setIsLoading(false);
		}
	}, [limit]);

	useEffect(() => {
		void handleLoadTransactions();
	}, [handleLoadTransactions]);

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">History</h1>
				<p className="text-sm text-muted-foreground">
					Approved expenses (Ceits global list). Vendor and invoice fields
					appear when set on the expense.
				</p>
			</div>

			<div className="flex flex-wrap items-end gap-2">
				<label className="grid gap-1">
					<span className="text-xs font-medium text-muted-foreground">
						Limit
					</span>
					<input
						className="h-10 w-28 rounded-md border border-border bg-background px-3 text-sm"
						min={1}
						onChange={(e) => setLimit(Number(e.target.value))}
						type="number"
						value={limit}
					/>
				</label>

				<button
					className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
					disabled={isLoading}
					onClick={handleLoadTransactions}
					type="button"
				>
					{isLoading ? "Loading…" : "Reload"}
				</button>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			{transactions && transactions.length === 0 ? (
				<p className="text-sm text-muted-foreground">No transactions yet.</p>
			) : null}

			{transactions && transactions.length > 0 ? (
				<ul className="space-y-3">
					{transactions.map((tx) => (
						<li key={String(tx.id)}>
							<div className="rounded-lg border border-border bg-muted/40 p-4">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0 space-y-1.5">
										<div className="text-xs font-semibold text-muted-foreground">
											#{String(tx.id)}
											{tx.currency ? (
												<span className="ml-2 font-normal">
													· {tx.currency}
												</span>
											) : null}
										</div>
										<div className="text-base font-semibold leading-snug text-foreground">
											{primaryHeading(tx)}
										</div>
										{tx.title?.trim() && tx.description?.trim() ? (
											<p className="line-clamp-2 text-xs text-muted-foreground">
												{tx.description.trim()}
											</p>
										) : null}
										<div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
											{tx.txn_date ? <span>Date {tx.txn_date}</span> : null}
											{tx.created_at ? (
												<span>Recorded {formatDateTime(tx.created_at)}</span>
											) : null}
										</div>
										{tx.vendor_name ? (
											<span className="inline-flex max-w-full rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
												{tx.vendor_name}
											</span>
										) : null}
										{tx.business_meta?.invoice_ref ||
										tx.business_meta?.notes ? (
											<div className="space-y-0.5 text-[11px] text-muted-foreground">
												{tx.business_meta?.invoice_ref ? (
													<div>
														<span className="font-medium text-foreground/80">
															Inv.{" "}
														</span>
														{tx.business_meta.invoice_ref}
													</div>
												) : null}
												{tx.business_meta?.notes ? (
													<p
														className="line-clamp-2"
														title={tx.business_meta.notes}
													>
														{tx.business_meta.notes}
													</p>
												) : null}
											</div>
										) : null}
										<div className="text-lg font-semibold tabular-nums">
											{formatMoney(tx.total)}
										</div>
									</div>
									<TransactionInlineActions
										className="max-w-[18rem] shrink-0"
										expenseId={tx.id}
										onAfterChange={handleLoadTransactions}
										recurringId={
											tx.recurring_id != null && Number(tx.recurring_id) > 0
												? Number(tx.recurring_id)
												: undefined
										}
										recurringPaused={tx.recurring_paused}
									/>
								</div>
								{tx.items?.length ? (
									<ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
										{tx.items.slice(0, 5).map((it, idx) => (
											<li
												className="flex justify-between gap-2"
												key={`${String(tx.id)}-${idx}-${it.name}`}
											>
												<span className="min-w-0 truncate">{it.name}</span>
												<span className="shrink-0 font-mono text-muted-foreground">
													{formatMoney(it.amount)}
												</span>
											</li>
										))}
										{tx.items.length > 5 ? (
											<li className="text-[10px] text-muted-foreground">
												+ {tx.items.length - 5} more
											</li>
										) : null}
									</ul>
								) : null}
							</div>
						</li>
					))}
				</ul>
			) : null}

			<details className="rounded-lg border border-border bg-muted/30">
				<summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted-foreground">
					Raw JSON
				</summary>
				<pre className="max-h-96 overflow-auto border-t border-border p-4 text-xs">
					{JSON.stringify(transactions, null, 2)}
				</pre>
			</details>
		</section>
	);
};
