import { useEffect, useState } from "react";
import type { Transaction } from "@cofi/api";
import { apiClient } from "../../../shared/lib/apiClient";

type Props = {
	transactionId: string | number;
};

const formatMoney = (amount: number) => {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
	}).format(amount);
};

export const ExpenseMessageCard = ({ transactionId }: Props) => {
	const [tx, setTx] = useState<Transaction | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;
		const run = async () => {
			try {
				const data = await apiClient.transactions.getById(transactionId);
				if (!isMounted) return;
				setTx(data);
				setError(null);
			} catch (e) {
				if (!isMounted) return;
				setTx(null);
				setError(e instanceof Error ? e.message : "Failed to load transaction");
			}
		};
		void run();
		return () => {
			isMounted = false;
		};
	}, [transactionId]);

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
						Expense · tx #{String(tx.id)}
					</div>
					<div className="mt-0.5 text-sm font-semibold">
						{formatMoney(tx.total)}
					</div>
				</div>
				<div className="text-[10px] text-muted-foreground">
					{tx.created_at ? new Date(tx.created_at).toLocaleString() : ""}
				</div>
			</div>

			<div className="mt-2 space-y-1">
				{topItems.map((it, idx) => (
					<div className="flex items-center justify-between gap-3 text-xs" key={`${idx}-${it.name}`}>
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
		</div>
	);
};

