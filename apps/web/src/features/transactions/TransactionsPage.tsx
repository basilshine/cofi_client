import { useState } from "react";
import type { Transaction } from "@cofi/api";
import { apiClient } from "../../shared/lib/apiClient";

export const TransactionsPage = () => {
	const [transactions, setTransactions] = useState<Transaction[] | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [limit, setLimit] = useState(20);

	const handleLoadTransactions = async () => {
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
	};

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-xl font-semibold">Transactions</h1>
				<p className="text-sm text-muted-foreground">
					Simple confirmed history list (Dev Console).
				</p>
			</div>

			<div className="flex flex-wrap items-end gap-2">
				<label className="grid gap-1">
					<span className="text-xs font-medium text-muted-foreground">Limit</span>
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
					Load transactions
				</button>
			</div>

			{errorMessage ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
					{errorMessage}
				</div>
			) : null}

			<pre className="overflow-auto rounded-lg border border-border bg-muted p-4 text-xs">
				{JSON.stringify(transactions, null, 2)}
			</pre>
		</section>
	);
};

