import type { Transaction } from "@cofi/api";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";

const listHeading = (tx: Transaction): string => {
	const t = tx.title?.trim();
	if (t) return t;
	const d = tx.description?.trim();
	if (d) return d.length > 72 ? `${d.slice(0, 69)}…` : d;
	return `Expense #${String(tx.id)}`;
};

const normalize = (s: string) => s.trim().toLowerCase();

const collectItemTags = (tx: Transaction): string[] => {
	const out: string[] = [];
	for (const it of tx.items ?? []) {
		for (const t of it.tags ?? []) {
			const n = String(t).trim();
			if (n) out.push(n);
		}
	}
	return out;
};

export type SpaceExpensesMainProps = {
	transactions: Transaction[] | null;
	listLoading: boolean;
	listError: string | null;
	onReload: () => void;
	onSelectExpense: (expenseId: string | number) => void;
	currentUserId: number | null;
};

type StatusFilter = "all" | "draft" | "approved" | "cancelled" | "other";
type TypeFilter = "all" | "expense" | "income";
type OwnerFilter = "all" | "mine" | "others";
type DatePreset = "all" | "7d" | "30d" | "90d";
type SortKey =
	| "date_desc"
	| "date_asc"
	| "amount_desc"
	| "amount_asc"
	| "created_desc";

const statusBucket = (raw: string | undefined): StatusFilter => {
	const s = (raw ?? "").toLowerCase();
	if (s === "draft") return "draft";
	if (s === "approved") return "approved";
	if (s === "cancelled" || s === "canceled") return "cancelled";
	return "other";
};

const parseTxnDate = (tx: Transaction): number | null => {
	const d = tx.txn_date?.trim();
	if (!d) return null;
	const t = Date.parse(`${d}T12:00:00`);
	return Number.isFinite(t) ? t : null;
};

export const SpaceExpensesMain = ({
	transactions,
	listLoading,
	listError,
	onReload,
	onSelectExpense,
	currentUserId,
}: SpaceExpensesMainProps) => {
	const { formatMoney, formatDateTime } = useUserFormat();
	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
	const [datePreset, setDatePreset] = useState<DatePreset>("all");
	const [currencyFilter, setCurrencyFilter] = useState<string>("all");
	const [recurringOnly, setRecurringOnly] = useState(false);
	const [sortKey, setSortKey] = useState<SortKey>("date_desc");

	const currencyOptions = useMemo(() => {
		const set = new Set<string>();
		for (const tx of transactions ?? []) {
			const c = tx.currency?.trim();
			if (c) set.add(c);
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [transactions]);

	const tagOptions = useMemo(() => {
		const set = new Set<string>();
		for (const tx of transactions ?? []) {
			for (const t of collectItemTags(tx)) {
				const n = t.trim();
				if (n) set.add(n);
			}
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [transactions]);

	const [tagFilter, setTagFilter] = useState<string>("all");

	const now = useMemo(() => Date.now(), []);
	const cutoffMs = useMemo(() => {
		if (datePreset === "all") return null;
		const days = datePreset === "7d" ? 7 : datePreset === "30d" ? 30 : 90;
		return now - days * 86400000;
	}, [datePreset, now]);

	const filteredSorted = useMemo(() => {
		const list = transactions ?? [];
		const q = normalize(query);
		const qTokens = q.length ? q.split(/\s+/).filter(Boolean) : [];

		let rows = list.filter((tx) => {
			if (typeFilter !== "all" && tx.type !== typeFilter) return false;
			if (recurringOnly && (tx.recurring_id == null || tx.recurring_id <= 0))
				return false;
			if (currencyFilter !== "all") {
				const c = tx.currency?.trim() ?? "";
				if (c !== currencyFilter) return false;
			}
			if (statusFilter !== "all") {
				const b = statusBucket(tx.status);
				if (statusFilter === "other") {
					if (b !== "other") return false;
				} else if (b !== statusFilter) {
					return false;
				}
			}
			if (ownerFilter !== "all" && currentUserId != null) {
				const uid = tx.user_id;
				if (ownerFilter === "mine") {
					if (uid == null || Number(uid) !== Number(currentUserId))
						return false;
				} else if (ownerFilter === "others") {
					if (uid != null && Number(uid) === Number(currentUserId))
						return false;
				}
			}
			if (tagFilter !== "all") {
				const tags = new Set(collectItemTags(tx).map((t) => normalize(t)));
				if (!tags.has(normalize(tagFilter))) return false;
			}
			if (cutoffMs != null) {
				const t = parseTxnDate(tx);
				if (t == null || t < cutoffMs) return false;
			}
			if (qTokens.length) {
				const hay = [
					listHeading(tx),
					tx.description ?? "",
					tx.payee_text ?? "",
					tx.vendor_name ?? "",
					...(tx.items ?? []).map((it) => it.name),
					tx.status ?? "",
				]
					.join(" ")
					.toLowerCase();
				for (const tok of qTokens) {
					if (!hay.includes(tok)) return false;
				}
			}
			return true;
		});

		const sortFn = (a: Transaction, b: Transaction): number => {
			switch (sortKey) {
				case "amount_desc":
					return (b.total ?? 0) - (a.total ?? 0);
				case "amount_asc":
					return (a.total ?? 0) - (b.total ?? 0);
				case "date_asc": {
					const da = parseTxnDate(a) ?? 0;
					const db = parseTxnDate(b) ?? 0;
					return da - db;
				}
				case "date_desc": {
					const da = parseTxnDate(a) ?? 0;
					const db = parseTxnDate(b) ?? 0;
					return db - da;
				}
				default: {
					const ca = a.created_at ? Date.parse(a.created_at) : 0;
					const cb = b.created_at ? Date.parse(b.created_at) : 0;
					return cb - ca;
				}
			}
		};

		rows = [...rows].sort(sortFn);
		return rows;
	}, [
		transactions,
		query,
		statusFilter,
		typeFilter,
		ownerFilter,
		currencyFilter,
		recurringOnly,
		tagFilter,
		cutoffMs,
		sortKey,
		currentUserId,
	]);

	const handleClearFilters = () => {
		setQuery("");
		setStatusFilter("all");
		setTypeFilter("all");
		setOwnerFilter("all");
		setDatePreset("all");
		setCurrencyFilter("all");
		setRecurringOnly(false);
		setTagFilter("all");
		setSortKey("date_desc");
	};

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="shrink-0 space-y-3 border-b border-border/70 bg-muted/15 px-3 py-3 sm:px-4">
				<div className="flex flex-wrap items-end gap-2 sm:gap-3">
					<label className="grid min-w-[min(100%,14rem)] flex-1 gap-1">
						<span className="text-[11px] font-medium text-muted-foreground">
							Search
						</span>
						<input
							aria-label="Search expenses"
							className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm"
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Title, payee, line items, status…"
							type="search"
							value={query}
						/>
					</label>
					<label className="grid gap-1">
						<span className="text-[11px] font-medium text-muted-foreground">
							Status
						</span>
						<select
							aria-label="Filter by status"
							className="h-9 min-w-[7.5rem] rounded-md border border-border bg-background px-2 text-sm"
							onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
							value={statusFilter}
						>
							<option value="all">All</option>
							<option value="draft">Draft</option>
							<option value="approved">Approved</option>
							<option value="cancelled">Cancelled</option>
							<option value="other">Other</option>
						</select>
					</label>
					<label className="grid gap-1">
						<span className="text-[11px] font-medium text-muted-foreground">
							Type
						</span>
						<select
							aria-label="Filter by type"
							className="h-9 min-w-[7.5rem] rounded-md border border-border bg-background px-2 text-sm"
							onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
							value={typeFilter}
						>
							<option value="all">All</option>
							<option value="expense">Expense</option>
							<option value="income">Income</option>
						</select>
					</label>
					<label className="grid gap-1">
						<span className="text-[11px] font-medium text-muted-foreground">
							Owner
						</span>
						<select
							aria-label="Filter by owner"
							className="h-9 min-w-[7.5rem] rounded-md border border-border bg-background px-2 text-sm"
							onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}
							value={ownerFilter}
							disabled={currentUserId == null}
							title={
								currentUserId == null ? "Sign in to filter by owner" : undefined
							}
						>
							<option value="all">All</option>
							<option value="mine">Mine</option>
							<option value="others">Others</option>
						</select>
					</label>
					<label className="grid gap-1">
						<span className="text-[11px] font-medium text-muted-foreground">
							Date
						</span>
						<select
							aria-label="Filter by expense date"
							className="h-9 min-w-[7rem] rounded-md border border-border bg-background px-2 text-sm"
							onChange={(e) => setDatePreset(e.target.value as DatePreset)}
							value={datePreset}
						>
							<option value="all">Any</option>
							<option value="7d">Last 7 days</option>
							<option value="30d">Last 30 days</option>
							<option value="90d">Last 90 days</option>
						</select>
					</label>
					<label className="grid gap-1">
						<span className="text-[11px] font-medium text-muted-foreground">
							Currency
						</span>
						<select
							aria-label="Filter by currency"
							className="h-9 min-w-[6rem] rounded-md border border-border bg-background px-2 text-sm"
							onChange={(e) => setCurrencyFilter(e.target.value)}
							value={currencyFilter}
						>
							<option value="all">All</option>
							{currencyOptions.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</label>
					{tagOptions.length ? (
						<label className="grid gap-1">
							<span className="text-[11px] font-medium text-muted-foreground">
								Tag
							</span>
							<select
								aria-label="Filter by line tag"
								className="h-9 min-w-[8rem] max-w-[12rem] rounded-md border border-border bg-background px-2 text-sm"
								onChange={(e) => setTagFilter(e.target.value)}
								value={tagFilter}
							>
								<option value="all">All tags</option>
								{tagOptions.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						</label>
					) : null}
					<label className="flex cursor-pointer items-center gap-2 pt-5 sm:pt-6">
						<input
							aria-label="Recurring only"
							checked={recurringOnly}
							className="h-4 w-4 rounded border-border"
							onChange={(e) => setRecurringOnly(e.target.checked)}
							type="checkbox"
						/>
						<span className="text-xs text-foreground">Recurring only</span>
					</label>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<label className="flex items-center gap-2">
						<span className="text-[11px] font-medium text-muted-foreground">
							Sort
						</span>
						<select
							aria-label="Sort expenses"
							className="h-9 rounded-md border border-border bg-background px-2 text-sm"
							onChange={(e) => setSortKey(e.target.value as SortKey)}
							value={sortKey}
						>
							<option value="date_desc">Expense date · newest</option>
							<option value="date_asc">Expense date · oldest</option>
							<option value="created_desc">Created · newest</option>
							<option value="amount_desc">Amount · high</option>
							<option value="amount_asc">Amount · low</option>
						</select>
					</label>
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-[11px] text-muted-foreground">
							{listLoading
								? "Loading…"
								: `${filteredSorted.length} shown${
										transactions?.length != null
											? ` · ${transactions.length} in space`
											: ""
									}`}
						</p>
						<button
							className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
							disabled={listLoading}
							onClick={() => onReload()}
							type="button"
						>
							Reload
						</button>
						<button
							className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
							onClick={handleClearFilters}
							type="button"
						>
							Reset filters
						</button>
						<Link
							className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
							to="/console/chat"
						>
							Back to chat
						</Link>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 sm:px-4">
				{listError ? (
					<div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{listError}
					</div>
				) : null}

				{listLoading && !transactions?.length ? (
					<p className="text-sm text-muted-foreground">Loading expenses…</p>
				) : null}

				{!listLoading && transactions && transactions.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No expenses in this space yet. Confirm a draft from chat or add one
						from capture.
					</p>
				) : null}

				{!listLoading && filteredSorted.length === 0 && transactions?.length ? (
					<p className="text-sm text-muted-foreground">
						No expenses match your filters. Try clearing search or reset
						filters.
					</p>
				) : null}

				<ul className="space-y-2">
					{filteredSorted.map((tx) => (
						<li key={`exp-${String(tx.id)}`}>
							<button
								aria-label={`Open expense ${listHeading(tx)} in the right panel`}
								className="w-full rounded-xl border border-border/80 bg-card/90 p-3 text-left shadow-sm ring-1 ring-border/20 transition hover:border-primary/35 hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								onClick={() => onSelectExpense(tx.id)}
								type="button"
							>
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="truncate text-xs font-semibold text-muted-foreground">
											#{String(tx.id)}
											{tx.currency ? (
												<span className="ml-1.5 font-normal">
													· {tx.currency}
												</span>
											) : null}
											{tx.status ? (
												<span className="ml-1.5 font-normal capitalize">
													· {tx.status}
												</span>
											) : null}
											{tx.recurring_id ? (
												<span className="ml-1.5 font-normal text-primary">
													· Recurring
												</span>
											) : null}
										</div>
										<div className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
											{listHeading(tx)}
										</div>
										{tx.txn_date ? (
											<div className="mt-0.5 text-[10px] text-muted-foreground">
												Expense date: {tx.txn_date}
											</div>
										) : null}
										{tx.created_at ? (
											<div className="mt-0.5 text-[10px] text-muted-foreground">
												Created {formatDateTime(tx.created_at)}
											</div>
										) : null}
									</div>
									<div className="shrink-0 text-right">
										<div className="text-sm font-semibold tabular-nums text-foreground">
											{formatMoney(tx.total)}
										</div>
										<div className="text-[10px] text-muted-foreground">
											{tx.type === "income" ? "Income" : "Expense"}
										</div>
									</div>
								</div>
								{tx.items?.length ? (
									<div className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
										{tx.items.slice(0, 3).map((it) => (
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
										{tx.items.length > 3 ? (
											<div className="mt-0.5 text-[10px]">
												+{tx.items.length - 3} more lines
											</div>
										) : null}
									</div>
								) : null}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
};
