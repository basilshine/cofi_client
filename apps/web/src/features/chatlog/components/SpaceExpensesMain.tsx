import type { Transaction } from "@cofi/api";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUserFormat } from "../../../shared/hooks/useUserFormat";
import { apiClient } from "../../../shared/lib/apiClient";
import { buildExpenseDetailHref } from "../../../shared/lib/expenseLinks";

const listHeading = (tx: Transaction): string => {
	const t = (tx.title ?? "").trim();
	const generic = !t || t.toLowerCase() === "expense";
	const firstLineName = (tx.items ?? [])
		.map((it) => (it.name ?? "").trim())
		.find((n) => n.length > 0);
	if (!generic) return t;
	if (firstLineName) {
		return firstLineName.length > 72
			? `${firstLineName.slice(0, 69)}…`
			: firstLineName;
	}
	const d = (tx.description ?? "").trim();
	if (d) {
		const line = d.split(/\r?\n/).find((l) => l.trim().length > 0) ?? d;
		const one = line.trim();
		return one.length > 72 ? `${one.slice(0, 69)}…` : one;
	}
	return `Expense #${String(tx.id)}`;
};

const displayMerchant = (tx: Transaction): string => {
	const v = tx.vendor_name?.trim();
	if (v) return v;
	const p = tx.payee_text?.trim();
	if (p) return p;
	return listHeading(tx);
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

const expenseTagPillClass =
	"inline-flex max-w-[9rem] truncate rounded-full border border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.9)] px-2.5 py-0.5 text-xs font-medium text-foreground/80";

type StatusTone = "draft" | "approved" | "cancelled" | "needs_review" | "other";

const statusTone = (raw?: string): StatusTone => {
	const s = (raw ?? "").toLowerCase();
	if (s === "approved") return "approved";
	if (s === "cancelled" || s === "canceled") return "cancelled";
	if (s === "draft") return "draft";
	if (
		s.includes("review") ||
		s.includes("question") ||
		(s.includes("pending") && !s.includes("draft"))
	) {
		return "needs_review";
	}
	return "other";
};

const expenseStatusPillClass = (statusRaw?: string) => {
	const tone = statusTone(statusRaw);
	if (tone === "approved") {
		return "inline-flex items-center rounded-full border border-[rgba(95,130,102,0.35)] bg-[rgba(120,154,124,0.14)] px-2.5 py-1 text-xs font-semibold text-[#2d4a32]";
	}
	if (tone === "draft") {
		return "inline-flex items-center rounded-full border border-[rgba(200,155,80,0.4)] bg-[rgba(255,236,200,0.55)] px-2.5 py-1 text-xs font-semibold text-[#6b4510]";
	}
	if (tone === "cancelled") {
		return "inline-flex items-center rounded-full border border-[rgba(160,90,90,0.28)] bg-[rgba(180,100,100,0.1)] px-2.5 py-1 text-xs font-semibold text-[rgba(110,55,55,0.95)]";
	}
	if (tone === "needs_review") {
		return "inline-flex items-center rounded-full border border-[rgba(210,120,45,0.55)] bg-[rgba(255,210,150,0.45)] px-2.5 py-1 text-xs font-bold text-[#5a3000]";
	}
	return "inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs font-semibold text-muted-foreground";
};

const statusLabelPretty = (raw?: string): string => {
	const s = (raw ?? "").trim();
	if (!s) return "Unknown";
	return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

type SourceKind = "receipt" | "manual" | "recurring" | "voice";

const sourceKind = (tx: Transaction): SourceKind => {
	if (tx.recurring_id != null && tx.recurring_id > 0) return "recurring";
	const blob = `${tx.title ?? ""} ${tx.description ?? ""}`.toLowerCase();
	if (
		blob.includes("voice") ||
		blob.includes("transcript") ||
		blob.includes("audio")
	) {
		return "voice";
	}
	if (
		blob.includes("receipt") ||
		blob.includes("parsed") ||
		blob.includes("scan")
	) {
		return "receipt";
	}
	return "manual";
};

const sourceContextLine = (tx: Transaction): string => {
	const kind = sourceKind(tx);
	if (kind === "recurring") return "Recurring";
	if (kind === "voice") return "Voice capture";
	if (kind === "receipt") return "Receipt";
	return "Manual";
};

const IconReceiptMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
	>
		<title>Receipt</title>
		<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
		<path d="M9 8h6M9 12h6" />
	</svg>
);

const IconMicMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
	>
		<title>Voice</title>
		<path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
		<path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
	</svg>
);

const IconPenMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
	>
		<title>Manual</title>
		<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
	</svg>
);

const IconCalendarMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
	>
		<title>Date</title>
		<rect height="16" rx="2" width="18" x="3" y="5" />
		<path d="M16 3v4M8 3v4M3 10h18" />
	</svg>
);

const IconRepeatMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="1.8"
		viewBox="0 0 24 24"
	>
		<title>Recurring</title>
		<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" />
	</svg>
);

const IconMoreMini = ({ className }: { className?: string }) => (
	<svg
		aria-hidden
		className={className}
		fill="none"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2"
		viewBox="0 0 24 24"
	>
		<title>More</title>
		<circle cx="12" cy="5" r="1" />
		<circle cx="12" cy="12" r="1" />
		<circle cx="12" cy="19" r="1" />
	</svg>
);

const SourceIcon = ({
	kind,
	className,
}: { kind: SourceKind; className?: string }) => {
	const c = className ?? "h-4 w-4";
	if (kind === "recurring") return <IconRepeatMini className={c} />;
	if (kind === "voice") return <IconMicMini className={c} />;
	if (kind === "receipt") return <IconReceiptMini className={c} />;
	return <IconPenMini className={c} />;
};

export type SpaceExpensesMainProps = {
	transactions: Transaction[] | null;
	listLoading: boolean;
	listError: string | null;
	onReload: () => void;
	onSelectExpense: (expenseId: string | number) => void;
	selectedExpenseId?: string | number | null;
	currentUserId: number | null;
	/** Space display name for page copy. */
	spaceName?: string | null;
	/** For links back to chat in this space. */
	spaceId?: string | number | null;
};

type StatusFilter =
	| "all"
	| "draft"
	| "approved"
	| "cancelled"
	| "needs_review"
	| "other";
type TypeFilter = "all" | "expense" | "income";
type OwnerFilter = "all" | "mine" | "others";
type DatePreset = "all" | "7d" | "30d" | "90d";
type SortKey =
	| "date_desc"
	| "date_asc"
	| "amount_desc"
	| "amount_asc"
	| "created_desc";

const parseTxnDate = (tx: Transaction): number | null => {
	const d = tx.txn_date?.trim();
	if (!d) return null;
	const t = Date.parse(`${d}T12:00:00`);
	return Number.isFinite(t) ? t : null;
};

const compactSelectClass =
	"h-9 rounded-lg border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.85)] px-2.5 text-sm text-foreground shadow-sm transition-colors duration-150 hover:border-[rgba(120,100,80,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const SpaceExpensesMain = ({
	transactions,
	listLoading,
	listError,
	onReload,
	onSelectExpense,
	selectedExpenseId = null,
	currentUserId,
	spaceName = null,
	spaceId = null,
}: SpaceExpensesMainProps) => {
	const { formatMoney } = useUserFormat();
	const spaceLabel = spaceName?.trim() || "this space";
	const chatSpaceHref =
		spaceId != null
			? `/console/chat?spaceId=${encodeURIComponent(String(spaceId))}`
			: "/console/chat";

	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
	const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
	const [datePreset, setDatePreset] = useState<DatePreset>("all");
	const [currencyFilter, setCurrencyFilter] = useState<string>("all");
	const [recurringOnly, setRecurringOnly] = useState(false);
	const [sortKey, setSortKey] = useState<SortKey>("date_desc");
	const [deletingId, setDeletingId] = useState<string | number | null>(null);
	const [cancellingId, setCancellingId] = useState<string | number | null>(
		null,
	);
	const [actionError, setActionError] = useState<string | null>(null);
	const [expandedItemsByExpenseId, setExpandedItemsByExpenseId] = useState<
		Record<string, boolean>
	>({});
	const [pendingCancelTx, setPendingCancelTx] = useState<Transaction | null>(
		null,
	);
	const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
	const [openMenuExpenseId, setOpenMenuExpenseId] = useState<
		string | number | null
	>(null);

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

	const listStats = useMemo(() => {
		const list = transactions ?? [];
		let draft = 0;
		let approved = 0;
		let cancelled = 0;
		let needsReview = 0;
		for (const tx of list) {
			const tone = statusTone(tx.status);
			if (tone === "draft") draft += 1;
			else if (tone === "approved") approved += 1;
			else if (tone === "cancelled") cancelled += 1;
			else if (tone === "needs_review") needsReview += 1;
		}
		return {
			total: list.length,
			draft,
			approved,
			cancelled,
			needsReview,
		};
	}, [transactions]);

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
				const tone = statusTone(tx.status);
				if (statusFilter === "other") {
					if (tone !== "other") return false;
				} else if (tone !== statusFilter) {
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
		setMoreFiltersOpen(false);
	};

	const handleDeleteExpense = async (tx: Transaction) => {
		const id = tx.id;
		if (id == null) return;
		const heading = listHeading(tx);
		if (!window.confirm(`Delete "${heading}"? This cannot be undone.`)) {
			return;
		}
		setDeletingId(id);
		setActionError(null);
		try {
			await apiClient.finances.expenses.delete(id);
			onReload();
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Failed to delete expense",
			);
		} finally {
			setDeletingId(null);
		}
		setOpenMenuExpenseId(null);
	};

	const handleCancelDraftExpense = async (tx: Transaction) => {
		const id = tx.id;
		if (id == null) return;
		setCancellingId(id);
		setActionError(null);
		try {
			await apiClient.finances.expenses.update(id, { status: "cancelled" });
			setPendingCancelTx(null);
			onReload();
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : "Failed to cancel draft expense",
			);
		} finally {
			setCancellingId(null);
		}
		setOpenMenuExpenseId(null);
	};

	const summaryChipClass =
		"inline-flex min-w-0 items-center gap-2 rounded-xl border border-[rgba(120,100,80,0.15)] bg-[rgba(255,252,246,0.65)] px-3 py-2 text-sm shadow-sm";

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f4f0e8_100%)]">
			<div className="shrink-0 border-b border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.92)] px-4 py-4 sm:px-5">
				<div className="mx-auto flex max-w-5xl flex-col gap-3">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
								Expenses
							</h1>
							<p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground/75">
								Review and manage expenses captured in {spaceLabel}.
							</p>
						</div>
						<div className="flex shrink-0 flex-wrap items-center gap-2">
							<button
								className="inline-flex h-9 items-center rounded-lg border border-[rgba(120,100,80,0.2)] bg-white/80 px-3 text-sm font-medium text-foreground/85 shadow-sm transition-all duration-150 hover:bg-white disabled:opacity-50"
								disabled={listLoading}
								onClick={() => onReload()}
								type="button"
							>
								Refresh
							</button>
							<Link
								className="inline-flex h-9 items-center rounded-lg border border-[rgba(120,100,80,0.2)] bg-white/80 px-3 text-sm font-medium text-foreground/85 shadow-sm transition-all duration-150 hover:bg-white"
								to={chatSpaceHref}
							>
								Open chat
							</Link>
						</div>
					</div>

					<div className="flex flex-wrap gap-2 sm:gap-3">
						<div className={summaryChipClass}>
							<span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Total
							</span>
							<span className="font-semibold tabular-nums text-foreground">
								{listStats.total}
							</span>
						</div>
						<div className={summaryChipClass}>
							<span className="text-xs font-semibold uppercase tracking-wide text-[#7a5210]">
								Drafts
							</span>
							<span className="font-semibold tabular-nums text-[#5a3008]">
								{listStats.draft}
							</span>
						</div>
						<div className={summaryChipClass}>
							<span className="text-xs font-semibold uppercase tracking-wide text-[#355a3c]">
								Approved
							</span>
							<span className="font-semibold tabular-nums text-[#2d4a32]">
								{listStats.approved}
							</span>
						</div>
						<div className={summaryChipClass}>
							<span className="text-xs font-semibold uppercase tracking-wide text-[#7a4510]">
								Needs review
							</span>
							<span className="font-semibold tabular-nums text-[#5a3008]">
								{listStats.needsReview}
							</span>
						</div>
					</div>

					<div className="flex flex-col gap-2 rounded-xl border border-[rgba(120,100,80,0.14)] bg-white/70 p-3 shadow-sm sm:p-3.5">
						<div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
							<div className="min-w-0 flex-1">
								<input
									aria-label="Search expenses"
									className="h-10 w-full rounded-lg border border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.95)] px-3.5 text-sm text-foreground shadow-inner transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-[rgba(160,120,70,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									onChange={(e) => setQuery(e.target.value)}
									placeholder="Search title, merchant, lines…"
									type="search"
									value={query}
								/>
							</div>
							<div className="flex flex-wrap items-center gap-2 lg:justify-end">
								<select
									aria-label="Filter by status"
									className={`${compactSelectClass} min-w-[7.5rem]`}
									onChange={(e) =>
										setStatusFilter(e.target.value as StatusFilter)
									}
									value={statusFilter}
								>
									<option value="all">All statuses</option>
									<option value="draft">Draft</option>
									<option value="needs_review">Needs review</option>
									<option value="approved">Approved</option>
									<option value="cancelled">Cancelled</option>
									<option value="other">Other</option>
								</select>
								<select
									aria-label="Filter by type"
									className={`${compactSelectClass} min-w-[6.5rem]`}
									onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
									value={typeFilter}
								>
									<option value="all">All types</option>
									<option value="expense">Expense</option>
									<option value="income">Income</option>
								</select>
								<select
									aria-label="Filter by expense date"
									className={`${compactSelectClass} min-w-[6.5rem]`}
									onChange={(e) => setDatePreset(e.target.value as DatePreset)}
									value={datePreset}
								>
									<option value="all">Any date</option>
									<option value="7d">Last 7 days</option>
									<option value="30d">Last 30 days</option>
									<option value="90d">Last 90 days</option>
								</select>
								<button
									aria-expanded={moreFiltersOpen}
									className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
										moreFiltersOpen
											? "border-[rgba(160,120,70,0.45)] bg-[rgba(255,240,215,0.55)] text-foreground"
											: "border-[rgba(120,100,80,0.22)] bg-[rgba(255,252,246,0.85)] text-foreground/85 hover:border-[rgba(120,100,80,0.35)]"
									}`}
									onClick={() => setMoreFiltersOpen((o) => !o)}
									type="button"
								>
									More filters
								</button>
								<div className="hidden h-8 w-px bg-[rgba(120,100,80,0.15)] sm:block" />
								<label className="flex items-center gap-2">
									<span className="sr-only sm:not-sr-only sm:text-xs sm:font-medium sm:text-muted-foreground">
										Sort
									</span>
									<select
										aria-label="Sort expenses"
										className={`${compactSelectClass} min-w-[10.5rem]`}
										onChange={(e) => setSortKey(e.target.value as SortKey)}
										value={sortKey}
									>
										<option value="date_desc">Date · newest</option>
										<option value="date_asc">Date · oldest</option>
										<option value="created_desc">Created · newest</option>
										<option value="amount_desc">Amount · high</option>
										<option value="amount_asc">Amount · low</option>
									</select>
								</label>
							</div>
						</div>

						{moreFiltersOpen ? (
							<div className="flex flex-wrap items-end gap-3 border-t border-[rgba(120,100,80,0.1)] pt-3">
								{tagOptions.length ? (
									<label className="grid min-w-[8rem] flex-1 gap-1">
										<span className="text-xs font-medium text-muted-foreground">
											Tag
										</span>
										<select
											aria-label="Filter by tag"
											className={compactSelectClass}
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
								<label className="grid min-w-[7rem] gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Owner
									</span>
									<select
										aria-label="Filter by owner"
										className={compactSelectClass}
										disabled={currentUserId == null}
										onChange={(e) =>
											setOwnerFilter(e.target.value as OwnerFilter)
										}
										value={ownerFilter}
										title={
											currentUserId == null
												? "Sign in to filter by owner"
												: undefined
										}
									>
										<option value="all">Everyone</option>
										<option value="mine">Mine</option>
										<option value="others">Others</option>
									</select>
								</label>
								<label className="grid min-w-[5.5rem] gap-1">
									<span className="text-xs font-medium text-muted-foreground">
										Currency
									</span>
									<select
										aria-label="Filter by currency"
										className={compactSelectClass}
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
								<label className="flex cursor-pointer items-center gap-2 pb-0.5">
									<input
										aria-label="Recurring expenses only"
										checked={recurringOnly}
										className="h-4 w-4 rounded border-border"
										onChange={(e) => setRecurringOnly(e.target.checked)}
										type="checkbox"
									/>
									<span className="text-sm text-foreground/85">
										Recurring only
									</span>
								</label>
								<button
									className="ml-auto inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-[rgba(120,100,80,0.06)] hover:text-foreground"
									onClick={handleClearFilters}
									type="button"
								>
									Reset all
								</button>
							</div>
						) : null}

						<p className="text-xs text-muted-foreground">
							{listLoading
								? "Loading…"
								: `${filteredSorted.length} shown${
										transactions?.length != null
											? ` · ${transactions.length} in space`
											: ""
									}`}
						</p>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
				<div className="mx-auto max-w-5xl">
					{listError ? (
						<div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{listError}
						</div>
					) : null}
					{actionError ? (
						<div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{actionError}
						</div>
					) : null}

					{listLoading && !transactions?.length ? (
						<p className="text-sm text-muted-foreground">Loading expenses…</p>
					) : null}

					{!listLoading && transactions && transactions.length === 0 ? (
						<p className="text-sm leading-relaxed text-muted-foreground">
							No expenses in this space yet. Confirm a draft from chat or
							capture something new.
						</p>
					) : null}

					{!listLoading &&
					filteredSorted.length === 0 &&
					transactions?.length ? (
						<p className="text-sm leading-relaxed text-muted-foreground">
							No expenses match your filters. Try adjusting search or filters.
						</p>
					) : null}

					<ul className="space-y-3">
						{filteredSorted.map((tx) => {
							const heading = listHeading(tx);
							const merchant = displayMerchant(tx);
							const isSelected =
								selectedExpenseId != null &&
								String(selectedExpenseId) === String(tx.id);
							const itemTags = [...new Set(collectItemTags(tx))].slice(0, 4);
							const itemRows = tx.items ?? [];
							const isItemsExpanded =
								tx.id != null
									? expandedItemsByExpenseId[String(tx.id)] === true
									: false;
							const previewLines = 2;
							const visibleItems = isItemsExpanded
								? itemRows
								: itemRows.slice(0, previewLines);
							const hiddenCount = Math.max(
								0,
								itemRows.length - visibleItems.length,
							);
							const isDraft = statusTone(tx.status) === "draft";
							const needsReview = statusTone(tx.status) === "needs_review";
							const kind = sourceKind(tx);
							const menuOpen = openMenuExpenseId === tx.id;
							const threadHref =
								spaceId != null && tx.id != null
									? buildExpenseDetailHref(spaceId, tx.id)
									: null;

							return (
								<li key={`exp-${String(tx.id)}`}>
									<div
										className={[
											"group relative overflow-hidden rounded-2xl border transition-all duration-150",
											isSelected
												? "border-[rgba(160,120,70,0.45)] bg-[rgba(255,252,246,0.98)] shadow-[0_12px_32px_-18px_rgba(100,72,40,0.2)] ring-2 ring-[rgba(200,155,95,0.25)]"
												: "border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.72)] shadow-sm hover:border-[rgba(140,115,85,0.28)] hover:bg-[rgba(255,252,246,0.92)] hover:shadow-md",
											!isSelected ? "opacity-[0.96]" : "",
										].join(" ")}
									>
										<button
											aria-label={`Open expense ${heading} in the panel`}
											className="flex w-full cursor-pointer gap-3 p-4 text-left sm:gap-4 sm:p-4"
											onClick={() => {
												setOpenMenuExpenseId(null);
												onSelectExpense(tx.id);
											}}
											type="button"
										>
											<div
												className={[
													"mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-inner",
													kind === "recurring"
														? "border-[rgba(100,130,108,0.35)] bg-[rgba(120,154,124,0.12)] text-[#355a3c]"
														: kind === "voice"
															? "border-[rgba(120,110,160,0.3)] bg-[rgba(125,120,185,0.1)] text-[#3d3a5c]"
															: kind === "receipt"
																? "border-[rgba(200,155,80,0.35)] bg-[rgba(255,236,200,0.35)] text-[#6b4510]"
																: "border-[rgba(120,100,80,0.2)] bg-white/90 text-foreground/70",
												].join(" ")}
											>
												<SourceIcon className="h-5 w-5" kind={kind} />
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
													<div className="min-w-0">
														<p className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground">
															{merchant}
														</p>
														{merchant !== heading ? (
															<p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
																{heading}
															</p>
														) : null}
														<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
															{tx.txn_date ? (
																<span className="inline-flex items-center gap-1.5">
																	<IconCalendarMini className="h-3.5 w-3.5 shrink-0 opacity-80" />
																	{tx.txn_date}
																</span>
															) : null}
															<span className="text-foreground/70">
																{sourceContextLine(tx)} ·{" "}
																{statusLabelPretty(tx.status)}
															</span>
														</div>
													</div>
													<div className="flex shrink-0 flex-col items-end gap-2">
														<p className="text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">
															{formatMoney(tx.total)}
														</p>
														{tx.status ? (
															<span
																className={expenseStatusPillClass(tx.status)}
															>
																{statusLabelPretty(tx.status)}
															</span>
														) : null}
													</div>
												</div>
												{itemTags.length ? (
													<div className="mt-2 flex flex-wrap gap-1.5">
														{itemTags.map((tag) => (
															<span className={expenseTagPillClass} key={tag}>
																{tag}
															</span>
														))}
													</div>
												) : null}
												{itemRows.length ? (
													<div className="mt-3 rounded-xl border border-[rgba(120,100,80,0.1)] bg-white/60 px-3 py-2.5">
														<ul className="space-y-1.5 text-sm">
															{visibleItems.map((it, idx) => (
																<li
																	className="flex justify-between gap-3 text-foreground/90"
																	key={`${String(it.name)}-${String(it.amount)}-${idx}`}
																>
																	<span className="min-w-0 truncate">
																		{it.name}
																	</span>
																	<span className="shrink-0 tabular-nums text-muted-foreground">
																		{formatMoney(it.amount)}
																	</span>
																</li>
															))}
														</ul>
														{itemRows.length > previewLines ? (
															<button
																className="mt-2 text-sm font-medium text-[#6b4510] underline decoration-[rgba(160,110,50,0.4)] underline-offset-2 transition hover:text-[#482a00]"
																onClick={(e) => {
																	e.stopPropagation();
																	if (tx.id == null) return;
																	setExpandedItemsByExpenseId((prev) => ({
																		...prev,
																		[String(tx.id)]: !isItemsExpanded,
																	}));
																}}
																type="button"
															>
																{isItemsExpanded
																	? "Show less"
																	: `+${hiddenCount} more line items`}
															</button>
														) : null}
													</div>
												) : null}
											</div>
										</button>

										<div className="flex items-center justify-between gap-2 border-t border-[rgba(120,100,80,0.08)] bg-[rgba(255,252,246,0.55)] px-3 py-2 sm:px-4">
											<div className="flex flex-wrap items-center gap-2">
												{isDraft || needsReview ? (
													<button
														className="inline-flex h-9 items-center rounded-lg bg-[rgba(55,45,30,0.92)] px-3.5 text-sm font-semibold text-[#fffaf0] shadow-sm transition hover:bg-[rgba(45,38,28,0.95)]"
														onClick={(e) => {
															e.stopPropagation();
															onSelectExpense(tx.id);
														}}
														type="button"
													>
														Review
													</button>
												) : null}
												<div className="pointer-events-none flex items-center gap-1 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100 sm:ml-1">
													<button
														className="inline-flex h-9 items-center rounded-lg border border-[rgba(120,100,80,0.2)] bg-white/90 px-3 text-sm font-medium text-foreground/85 transition hover:bg-white"
														onClick={(e) => {
															e.stopPropagation();
															onSelectExpense(tx.id);
														}}
														type="button"
													>
														Open
													</button>
												</div>
											</div>
											<div className="relative">
												<button
													aria-expanded={menuOpen}
													aria-haspopup="true"
													aria-label={`More actions for ${heading}`}
													className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:border-[rgba(120,100,80,0.15)] hover:bg-white/80 hover:text-foreground"
													onClick={(e) => {
														e.stopPropagation();
														setOpenMenuExpenseId((id) =>
															id === tx.id ? null : tx.id,
														);
													}}
													type="button"
												>
													<IconMoreMini className="h-4 w-4" />
												</button>
												{menuOpen ? (
													<div
														className="absolute bottom-full right-0 z-20 mb-1 min-w-[11rem] overflow-hidden rounded-xl border border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.98)] py-1 shadow-lg ring-1 ring-black/5"
														onMouseLeave={() => setOpenMenuExpenseId(null)}
														role="menu"
													>
														<button
															className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgba(120,100,80,0.06)]"
															onClick={(e) => {
																e.stopPropagation();
																setOpenMenuExpenseId(null);
																onSelectExpense(tx.id);
															}}
															role="menuitem"
															type="button"
														>
															Edit in panel
														</button>
														{threadHref ? (
															<Link
																className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[rgba(120,100,80,0.06)]"
																onClick={() => setOpenMenuExpenseId(null)}
																role="menuitem"
																to={threadHref}
															>
																Open detail page
															</Link>
														) : null}
														{isDraft ? (
															<button
																className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground/80 hover:bg-[rgba(120,100,80,0.06)]"
																disabled={cancellingId === tx.id}
																onClick={(e) => {
																	e.stopPropagation();
																	setOpenMenuExpenseId(null);
																	setPendingCancelTx(tx);
																}}
																role="menuitem"
																type="button"
															>
																{cancellingId === tx.id ? "…" : "Cancel draft"}
															</button>
														) : null}
														<button
															className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-[rgba(120,100,80,0.06)] hover:text-destructive"
															disabled={deletingId === tx.id}
															onClick={(e) => {
																e.stopPropagation();
																void handleDeleteExpense(tx);
															}}
															role="menuitem"
															type="button"
														>
															{deletingId === tx.id ? "…" : "Delete expense"}
														</button>
													</div>
												) : null}
											</div>
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			</div>

			{pendingCancelTx ? (
				<div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
					<div
						aria-modal="true"
						className="w-full max-w-md rounded-xl border border-[rgba(120,100,80,0.2)] bg-[rgba(255,252,246,0.98)] p-5 shadow-xl"
						role="dialog"
					>
						<h3 className="text-base font-semibold text-foreground">
							Cancel draft expense?
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
							This draft will be marked as cancelled. Line items and thread
							history are kept.
						</p>
						<div className="mt-5 flex items-center justify-end gap-2">
							<button
								className="inline-flex h-10 items-center rounded-lg border border-[rgba(120,100,80,0.2)] px-4 text-sm font-medium hover:bg-white disabled:opacity-50"
								disabled={cancellingId != null}
								onClick={() => setPendingCancelTx(null)}
								type="button"
							>
								Keep draft
							</button>
							<button
								className="inline-flex h-10 items-center rounded-lg bg-[rgba(130,70,70,0.9)] px-4 text-sm font-semibold text-white hover:bg-[rgba(110,55,55,0.95)] disabled:opacity-50"
								disabled={cancellingId != null}
								onClick={() => void handleCancelDraftExpense(pendingCancelTx)}
								type="button"
							>
								{cancellingId != null ? "Cancelling…" : "Cancel draft"}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
};
