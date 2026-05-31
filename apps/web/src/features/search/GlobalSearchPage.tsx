import type { PromoCode, Space, Transaction } from "@cofi/api";
import {
	ArrowRight,
	ListChecks,
	ReceiptText,
	Search,
	Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import {
	type PromoBenefit,
	PromoBenefitMini,
	toPromoBenefit,
} from "../../shared/lib/benefitPresentation";
import {
	type EntityVisualKey,
	entityVisuals,
} from "../../shared/lib/entityVisual";
import { sortSpacesByLastActivity } from "../../shared/lib/recentSpaceIds";

type SearchEntityType = "all" | "spaces" | "expenses" | "items" | "promos";

type IndexedExpense = {
	space: Space;
	transaction: Transaction;
};

type IndexedPromo = {
	space: Space;
	promo: PromoBenefit;
};

type SearchResult = {
	id: string;
	type: Exclude<SearchEntityType, "all">;
	visualKey: EntityVisualKey;
	title: string;
	subtitle: string;
	detail: string;
	href: string;
	searchText: string;
	meta: string[];
};

const entityFilters: Array<{
	key: SearchEntityType;
	label: string;
	visualKey: EntityVisualKey;
}> = [
	{ key: "all", label: "Everything", visualKey: "unknown" },
	{ key: "expenses", label: "Expenses", visualKey: "expense" },
	{ key: "items", label: "Items", visualKey: "expenseItem" },
	{ key: "promos", label: "Promos", visualKey: "benefit" },
	{ key: "spaces", label: "Spaces", visualKey: "people" },
];

const sectionOrder: Array<Exclude<SearchEntityType, "all">> = [
	"promos",
	"expenses",
	"items",
	"spaces",
];

const sectionLabel: Record<Exclude<SearchEntityType, "all">, string> = {
	promos: "Promos",
	expenses: "Expenses",
	items: "Purchased items",
	spaces: "Spaces",
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const tokensFor = (query: string): string[] =>
	normalizeText(query).split(/\s+/).filter(Boolean);

const compactDate = (iso?: string | null): string => {
	if (!iso) return "No date";
	const ts = Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso);
	if (!Number.isFinite(ts)) return iso;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(ts));
};

const expenseTitle = (tx: Transaction): string => {
	const title = tx.title?.trim();
	if (title && title.toLowerCase() !== "expense") return title;
	const item = tx.items?.map((it) => it.name?.trim()).find(Boolean);
	if (item) return item;
	const description = tx.description?.trim();
	if (description) return description.split(/\r?\n/)[0]?.trim() || "Expense";
	return `Expense #${String(tx.id)}`;
};

const expenseSearchText = (tx: Transaction, space: Space): string =>
	[
		expenseTitle(tx),
		tx.description,
		tx.payee_text,
		tx.vendor_name,
		tx.status,
		tx.currency,
		space.name,
		...(tx.items ?? []).flatMap((item) => [
			item.name,
			item.notes,
			...(item.tags ?? []),
		]),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

const promoSearchText = (promo: PromoBenefit, space: Space): string =>
	[
		promo.title,
		promo.code,
		promo.merchant,
		promo.redeemAt,
		promo.discountLabel,
		promo.validUntil,
		promo.source,
		space.name,
		promo.raw.description,
		promo.raw.conditions_text,
		promo.raw.source_text,
		promo.raw.redeem_merchant_name,
		promo.raw.redeem_platform,
		promo.raw.source_merchant_name,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

const matchesTokens = (searchText: string, tokens: string[]): boolean =>
	tokens.length === 0 || tokens.every((token) => searchText.includes(token));

const resultShellClass =
	"group flex min-w-0 items-start gap-3 rounded-2xl border border-[rgba(120,100,80,0.14)] bg-[rgba(255,252,246,0.76)] p-3.5 shadow-sm transition hover:border-[rgba(120,100,80,0.28)] hover:bg-white";

const SearchResultRow = ({ result }: { result: SearchResult }) => {
	const visual = entityVisuals[result.visualKey];
	const Icon = visual.icon;
	return (
		<Link className={resultShellClass} to={result.href}>
			<span
				className={[
					"inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
					visual.toneClass,
				].join(" ")}
			>
				<Icon className="h-5 w-5" size={20} />
			</span>
			<span className="min-w-0 flex-1">
				<span className="flex min-w-0 flex-wrap items-center gap-2">
					<span className="truncate text-sm font-semibold text-foreground">
						{result.title}
					</span>
					<span className="rounded-full border border-[rgba(120,100,80,0.16)] bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
						{sectionLabel[result.type]}
					</span>
				</span>
				<span className="mt-1 block truncate text-sm text-foreground/72">
					{result.subtitle}
				</span>
				<span className="mt-1 block truncate text-xs text-muted-foreground">
					{result.detail}
				</span>
				{result.meta.length ? (
					<span className="mt-2 flex flex-wrap gap-1.5">
						{result.meta.slice(0, 3).map((item) => (
							<span
								className="rounded-full border border-[rgba(120,100,80,0.14)] bg-white/60 px-2 py-0.5 text-[11px] font-medium text-foreground/70"
								key={item}
							>
								{item}
							</span>
						))}
					</span>
				) : null}
			</span>
			<ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
		</Link>
	);
};

export const GlobalSearchPage = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const { spaces } = useWorkspaceSpaces();
	const { formatMoney } = useUserFormat();
	const [query, setQuery] = useState(searchParams.get("q") ?? "");
	const [entityFilter, setEntityFilter] = useState<SearchEntityType>(
		(searchParams.get("type") as SearchEntityType | null) ?? "all",
	);
	const [indexedExpenses, setIndexedExpenses] = useState<IndexedExpense[]>([]);
	const [indexedPromos, setIndexedPromos] = useState<IndexedPromo[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const indexedSpaces = useMemo(
		() => sortSpacesByLastActivity(spaces ?? []).slice(0, 8),
		[spaces],
	);

	useEffect(() => {
		const nextQuery = searchParams.get("q") ?? "";
		const nextType = searchParams.get("type") as SearchEntityType | null;
		setQuery(nextQuery);
		setEntityFilter(
			nextType &&
				["all", "spaces", "expenses", "items", "promos"].includes(nextType)
				? nextType
				: "all",
		);
	}, [searchParams]);

	useEffect(() => {
		if (indexedSpaces.length === 0) {
			setIndexedExpenses([]);
			setIndexedPromos([]);
			return;
		}

		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		void (async () => {
			try {
				const rows = await Promise.all(
					indexedSpaces.map(async (space) => {
						const [transactionsRes, promosRes] = await Promise.allSettled([
							apiClient.spaces.listTransactions(space.id, { limit: 80 }),
							apiClient.spaces.listPromos(space.id),
						]);
						return {
							space,
							transactions:
								transactionsRes.status === "fulfilled"
									? transactionsRes.value
									: [],
							promos:
								promosRes.status === "fulfilled" ? promosRes.value.promos : [],
						};
					}),
				);
				if (cancelled) return;
				setIndexedExpenses(
					rows.flatMap((row) =>
						row.transactions.map((transaction) => ({
							space: row.space,
							transaction,
						})),
					),
				);
				setIndexedPromos(
					rows.flatMap((row) =>
						row.promos.map((promo: PromoCode) => ({
							space: row.space,
							promo: toPromoBenefit(promo),
						})),
					),
				);
			} catch (error) {
				if (!cancelled) {
					setLoadError(
						error instanceof Error
							? error.message
							: "Failed to build search index",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [indexedSpaces]);

	const allResults = useMemo(() => {
		const spaceResults: SearchResult[] = indexedSpaces.map((space) => {
			const searchText = [space.name, space.description, space.tenant_name]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return {
				id: `space-${String(space.id)}`,
				type: "spaces",
				visualKey: "people",
				title: space.name,
				subtitle: space.description?.trim() || "Shared space",
				detail: space.tenant_name?.trim() || "Ceits space",
				href: `/console/spaces/${encodeURIComponent(String(space.id))}/overview`,
				searchText,
				meta: [
					space.last_activity_at
						? `Active ${compactDate(space.last_activity_at)}`
						: "Space",
				],
			};
		});

		const expenseResults: SearchResult[] = indexedExpenses.map(
			({ space, transaction }) => {
				const title = expenseTitle(transaction);
				const amount = formatMoney(transaction.total ?? 0);
				return {
					id: `expense-${String(space.id)}-${String(transaction.id)}`,
					type: "expenses",
					visualKey: "expense",
					title,
					subtitle: `${amount} in ${space.name}`,
					detail: [
						transaction.vendor_name || transaction.payee_text || "Expense",
						compactDate(transaction.txn_date ?? transaction.created_at),
					].join(" · "),
					href: `/console/chat/thread?spaceId=${encodeURIComponent(String(space.id))}&expenseId=${encodeURIComponent(String(transaction.id))}`,
					searchText: expenseSearchText(transaction, space),
					meta: [
						transaction.status || "expense",
						transaction.items?.length
							? `${transaction.items.length} item${transaction.items.length === 1 ? "" : "s"}`
							: "No items",
					],
				};
			},
		);

		const itemResults: SearchResult[] = indexedExpenses.flatMap(
			({ space, transaction }) =>
				(transaction.items ?? []).map((item, index) => {
					const itemText = [
						item.name,
						item.notes,
						...(item.tags ?? []),
						expenseTitle(transaction),
						transaction.vendor_name,
						transaction.payee_text,
						space.name,
					]
						.filter(Boolean)
						.join(" ")
						.toLowerCase();
					return {
						id: `item-${String(space.id)}-${String(transaction.id)}-${index}`,
						type: "items",
						visualKey: "expenseItem",
						title: item.name || "Expense item",
						subtitle: `${formatMoney(item.amount ?? 0)} in ${space.name}`,
						detail: expenseTitle(transaction),
						href: `/console/chat/thread?spaceId=${encodeURIComponent(String(space.id))}&expenseId=${encodeURIComponent(String(transaction.id))}&line=${encodeURIComponent(String(index))}`,
						searchText: itemText,
						meta: item.tags?.slice(0, 3) ?? [],
					};
				}),
		);

		const promoResults: SearchResult[] = indexedPromos.map(
			({ space, promo }) => ({
				id: `promo-${String(space.id)}-${String(promo.id)}`,
				type: "promos",
				visualKey: "benefit",
				title: promo.code,
				subtitle: `${promo.discountLabel} · ${promo.merchant}`,
				detail: `${space.name} · ${promo.validUntil}`,
				href: `/console/spaces/${encodeURIComponent(String(space.id))}/benefits`,
				searchText: promoSearchText(promo, space),
				meta: [promo.status.replace(/_/g, " "), promo.source],
			}),
		);

		return [
			...promoResults,
			...expenseResults,
			...itemResults,
			...spaceResults,
		];
	}, [formatMoney, indexedExpenses, indexedPromos, indexedSpaces]);

	const tokens = useMemo(() => tokensFor(query), [query]);
	const filteredResults = useMemo(() => {
		return allResults.filter((result) => {
			if (entityFilter !== "all" && result.type !== entityFilter) return false;
			return matchesTokens(result.searchText, tokens);
		});
	}, [allResults, entityFilter, tokens]);

	const resultCounts = useMemo(() => {
		const counts: Record<SearchEntityType, number> = {
			all: 0,
			spaces: 0,
			expenses: 0,
			items: 0,
			promos: 0,
		};
		for (const result of allResults) {
			if (matchesTokens(result.searchText, tokens)) {
				counts.all += 1;
				counts[result.type] += 1;
			}
		}
		return counts;
	}, [allResults, tokens]);

	const groupedResults = useMemo(() => {
		return sectionOrder
			.map((type) => ({
				type,
				items: filteredResults.filter((result) => result.type === type),
			}))
			.filter((section) => section.items.length > 0);
	}, [filteredResults]);

	const updateSearch = (next: { q?: string; type?: SearchEntityType }) => {
		const params = new URLSearchParams(searchParams);
		const nextQuery = next.q ?? query;
		const nextType = next.type ?? entityFilter;
		if (nextQuery.trim()) params.set("q", nextQuery);
		else params.delete("q");
		if (nextType !== "all") params.set("type", nextType);
		else params.delete("type");
		setSearchParams(params, { replace: true });
	};

	const topPromos = indexedPromos
		.filter(
			({ promo }) =>
				promo.status === "active" || promo.status === "expires_soon",
		)
		.slice(0, 3);

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f4f0e8_100%)]">
			<div className="scrollbar-editorial min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
				<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 lg:px-10 lg:py-10">
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div className="min-w-0 max-w-3xl space-y-1.5">
							<p className="eyebrow">Global search</p>
							<h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
								Find expenses, items, promos, and spaces
							</h1>
							<p className="max-w-prose text-sm text-muted-foreground">
								Search across the active spaces already loaded into Ceits. This
								is the first local search shell before the dedicated backend
								index.
							</p>
						</div>
					</header>

					<section className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-white/72 p-4 shadow-sm">
						<label className="flex min-w-0 items-center gap-3 rounded-xl border border-[rgba(120,100,80,0.18)] bg-[rgba(255,252,246,0.9)] px-3.5 py-3 shadow-inner">
							<Search className="h-5 w-5 shrink-0 text-muted-foreground" />
							<input
								aria-label="Search Ceits"
								autoComplete="off"
								className="h-8 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
								onChange={(event) => updateSearch({ q: event.target.value })}
								placeholder="Try a promo code, merchant, item, space, tag..."
								type="search"
								value={query}
							/>
						</label>
						<div className="mt-3 flex flex-wrap gap-2">
							{entityFilters.map((filter) => {
								const visual = entityVisuals[filter.visualKey];
								const active = entityFilter === filter.key;
								const Icon = filter.key === "all" ? Sparkles : visual.icon;
								return (
									<button
										className={[
											"inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition",
											active
												? "border-foreground/18 bg-foreground text-background"
												: "border-[rgba(120,100,80,0.16)] bg-white/64 text-foreground/72 hover:bg-white hover:text-foreground",
										].join(" ")}
										key={filter.key}
										onClick={() => updateSearch({ type: filter.key })}
										type="button"
									>
										<Icon className="h-3.5 w-3.5" size={14} />
										<span>{filter.label}</span>
										<span className="tabular-nums opacity-70">
											{resultCounts[filter.key]}
										</span>
									</button>
								);
							})}
						</div>
					</section>

					{loadError ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{loadError}
						</div>
					) : null}

					<section className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold text-foreground">
									{isLoading
										? "Building search index..."
										: `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"}`}
								</p>
								<p className="text-xs text-muted-foreground">
									Indexed {indexedSpaces.length} spaces,{" "}
									{indexedExpenses.length} expenses, {indexedPromos.length}{" "}
									promos.
								</p>
							</div>
							{query || entityFilter !== "all" ? (
								<button
									className="inline-flex h-9 items-center rounded-full border border-[rgba(120,100,80,0.18)] bg-white/70 px-3 text-xs font-semibold text-muted-foreground transition hover:bg-white hover:text-foreground"
									onClick={() => updateSearch({ q: "", type: "all" })}
									type="button"
								>
									Clear search
								</button>
							) : null}
						</div>

						{groupedResults.length ? (
							groupedResults.map((section) => (
								<div className="space-y-2" key={section.type}>
									<div className="flex items-center gap-2">
										<p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
											{sectionLabel[section.type]}
										</p>
										<span className="h-px flex-1 bg-[rgba(120,100,80,0.12)]" />
									</div>
									<div className="grid gap-2">
										{section.items.slice(0, 24).map((result) => (
											<SearchResultRow key={result.id} result={result} />
										))}
									</div>
								</div>
							))
						) : (
							<div className="rounded-2xl border border-dashed border-[rgba(120,100,80,0.2)] bg-white/58 p-8 text-center">
								<ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
								<h2 className="mt-3 text-base font-semibold text-foreground">
									No matching records yet
								</h2>
								<p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
									Try a different merchant, item name, promo code, tag, or
									space.
								</p>
							</div>
						)}
					</section>
				</div>
			</div>

			<aside
				aria-label="Search context"
				className="hidden shrink-0 self-stretch flex-col border-l border-border/60 bg-muted/30 xl:flex xl:w-[20rem]"
			>
				<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-8">
					<section className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-white/68 p-4 shadow-sm">
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
							Coverage
						</p>
						<div className="mt-3 grid grid-cols-2 gap-2">
							<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.72)] p-3">
								<p className="text-2xl font-bold tabular-nums">
									{indexedSpaces.length}
								</p>
								<p className="text-xs text-muted-foreground">spaces</p>
							</div>
							<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.72)] p-3">
								<p className="text-2xl font-bold tabular-nums">
									{indexedExpenses.length}
								</p>
								<p className="text-xs text-muted-foreground">expenses</p>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-white/68 p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
								Promos to remember
							</p>
							<ReceiptText className="h-4 w-4 text-muted-foreground" />
						</div>
						<div className="mt-3 space-y-2">
							{topPromos.length ? (
								topPromos.map(({ promo, space }) => (
									<PromoBenefitMini
										key={`${String(space.id)}-${String(promo.id)}`}
										promo={promo}
									/>
								))
							) : (
								<p className="rounded-xl border border-dashed border-[rgba(120,100,80,0.16)] p-3 text-sm text-muted-foreground">
									Saved promos will appear here after they are parsed or added.
								</p>
							)}
						</div>
					</section>
				</div>
			</aside>
		</div>
	);
};
