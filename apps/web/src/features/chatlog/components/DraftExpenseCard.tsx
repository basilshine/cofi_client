import { useEffect, useMemo, useState } from "react";
import { httpClient } from "../../../shared/lib/httpClient";

type ExpenseItem = {
	id: number;
	name: string;
	amount: number;
	emotion?: string;
	tags?: { id: number; name: string }[];
};

type Expense = {
	id: number;
	description?: string;
	status?: string;
	items?: ExpenseItem[];
	created_at?: string;
};

const formatMoney = (value: number) => {
	if (!Number.isFinite(value)) return "0";
	return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
};

export const DraftExpenseCard = ({ expenseId }: { expenseId: string | number }) => {
	const [expense, setExpense] = useState<Expense | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isActing, setIsActing] = useState(false);

	const total = useMemo(() => {
		const items = expense?.items ?? [];
		return items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
	}, [expense]);

	const handleLoad = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await httpClient.get<Expense>(`v1/finances/expenses/${String(expenseId)}`);
			setExpense(res.data);
		} catch (e) {
			setExpense(null);
			setError(e instanceof Error ? e.message : "Failed to load draft");
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfirm = async () => {
		setIsActing(true);
		setError(null);
		try {
			await httpClient.post(`v1/finances/expenses/${String(expenseId)}/confirm`);
			await handleLoad();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to confirm draft");
		} finally {
			setIsActing(false);
		}
	};

	const handleCancel = async () => {
		setIsActing(true);
		setError(null);
		try {
			await httpClient.post(`v1/finances/expenses/${String(expenseId)}/cancel`);
			await handleLoad();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to cancel draft");
		} finally {
			setIsActing(false);
		}
	};

	useEffect(() => {
		void handleLoad();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [expenseId]);

	if (isLoading && !expense) {
		return <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs">Loading draft…</div>;
	}

	if (error && !expense) {
		return (
			<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
				{error}
			</div>
		);
	}

	const items = expense?.items ?? [];

	return (
		<div className="rounded-md border border-border bg-card p-3">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="text-xs font-semibold text-muted-foreground">DRAFT EXPENSE</div>
					<div className="mt-1 truncate text-sm font-medium">
						{expense?.description || "Draft transaction"}
					</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Total: <span className="font-semibold text-foreground">{formatMoney(total)}</span>{" "}
						{expense?.status ? ` · ${expense.status}` : ""}
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<button
						aria-label="Confirm draft expense"
						className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
						disabled={isActing || expense?.status !== "draft"}
						onClick={() => void handleConfirm()}
						type="button"
					>
						Confirm
					</button>
					<button
						aria-label="Cancel draft expense"
						className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent disabled:opacity-50"
						disabled={isActing || expense?.status !== "draft"}
						onClick={() => void handleCancel()}
						type="button"
					>
						Cancel
					</button>
				</div>
			</div>

			{error ? (
				<div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			) : null}

			{items.length ? (
				<ul className="mt-3 space-y-2">
					{items.slice(0, 8).map((it) => (
						<li className="rounded-md border border-border bg-background px-3 py-2" key={it.id}>
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0 truncate text-sm font-medium">{it.name}</div>
								<div className="shrink-0 text-sm font-semibold">{formatMoney(it.amount)}</div>
							</div>
							<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
								{it.emotion ? <span>emotion: {it.emotion}</span> : null}
								{it.tags?.length ? (
									<span className="truncate">
										tags: {it.tags.map((t) => t.name).join(", ")}
									</span>
								) : null}
							</div>
						</li>
					))}
					{items.length > 8 ? (
						<li className="text-xs text-muted-foreground">…and {items.length - 8} more items</li>
					) : null}
				</ul>
			) : (
				<div className="mt-3 text-xs text-muted-foreground">No items found.</div>
			)}
		</div>
	);
};

