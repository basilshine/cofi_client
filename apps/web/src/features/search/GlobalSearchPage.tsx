import type { SearchEntityType, SearchResult } from "@cofi/api";
import { ListChecks, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import {
	EntityIcon,
	EntityListItem,
	EntityMini,
	type EntityViewModel,
} from "../../shared/lib/entityPresentation";
import type { EntityVisualKey } from "../../shared/lib/entityVisual";

type SearchFilter = "all" | SearchEntityType;

const entityFilters: Array<{
	key: SearchFilter;
	label: string;
	visualKey: EntityVisualKey;
	serverType?: SearchEntityType;
}> = [
	{ key: "all", label: "Everything", visualKey: "unknown" },
	{
		key: "expense",
		label: "Expenses",
		visualKey: "expense",
		serverType: "expense",
	},
	{
		key: "expense_item",
		label: "Items",
		visualKey: "expenseItem",
		serverType: "expense_item",
	},
	{
		key: "promo_code",
		label: "Promos",
		visualKey: "benefit",
		serverType: "promo_code",
	},
	{
		key: "participant",
		label: "People",
		visualKey: "people",
		serverType: "participant",
	},
	{
		key: "split",
		label: "Splits",
		visualKey: "split",
		serverType: "split",
	},
	{
		key: "recurring",
		label: "Recurring",
		visualKey: "future",
		serverType: "recurring",
	},
	{
		key: "source_document",
		label: "Captures",
		visualKey: "reviewPacket",
		serverType: "source_document",
	},
	{ key: "space", label: "Spaces", visualKey: "people", serverType: "space" },
];

const sectionOrder: SearchEntityType[] = [
	"promo_code",
	"expense",
	"expense_item",
	"participant",
	"split",
	"recurring",
	"source_document",
	"space",
];

const sectionLabel: Record<SearchEntityType, string> = {
	promo_code: "Promos",
	expense: "Expenses",
	expense_item: "Purchased items",
	participant: "People",
	split: "Splits",
	recurring: "Recurring",
	source_document: "Captures",
	space: "Spaces",
};

const visualForResult = (type: SearchEntityType): EntityVisualKey => {
	switch (type) {
		case "expense":
			return "expense";
		case "expense_item":
			return "expenseItem";
		case "promo_code":
			return "benefit";
		case "participant":
			return "people";
		case "split":
			return "split";
		case "recurring":
			return "future";
		case "source_document":
			return "reviewPacket";
		case "space":
			return "people";
		default:
			return "unknown";
	}
};

const formatDate = (iso?: string): string | null => {
	if (!iso) return null;
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return null;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(ts));
};

const searchStatusLabel = (status?: string | null): string | undefined => {
	const normalized = status?.trim().toLowerCase();
	if (!normalized) return undefined;
	if (normalized === "records_created") return "Records created";
	if (normalized === "pending_review") return "Needs review";
	if (normalized === "captured") return "Captured";
	return normalized
		.replace(/_/g, " ")
		.replace(/^\w/, (letter) => letter.toUpperCase());
};

const searchStatusClassName = (status?: string | null): string | undefined => {
	const normalized = status?.trim().toLowerCase();
	if (normalized === "records_created") {
		return "border-[rgba(72,112,76,0.22)] bg-[rgba(236,247,238,0.92)] text-[#355a3c]";
	}
	if (normalized === "pending_review") {
		return "border-[rgba(181,131,52,0.28)] bg-[rgba(255,240,208,0.86)] text-[#73501b]";
	}
	return undefined;
};

const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchTokens = (query: string): string[] => {
	const seen = new Set<string>();
	return query
		.trim()
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length >= 2)
		.filter((token) => {
			const key = token.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
};

const HighlightedText = ({
	className,
	query,
	text,
}: {
	className?: string;
	query: string;
	text: string;
}) => {
	const tokens = searchTokens(query);
	if (tokens.length === 0) {
		return <span className={className}>{text}</span>;
	}
	const matcher = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
	const tokenSet = new Set(tokens.map((token) => token.toLowerCase()));
	return (
		<span className={className}>
			{text.split(matcher).map((part, index) => {
				if (!part) return null;
				const key = `${part}-${index}`;
				if (tokenSet.has(part.toLowerCase())) {
					return (
						<mark
							className="rounded bg-[rgba(220,170,72,0.28)] px-0.5 text-inherit"
							key={key}
						>
							{part}
						</mark>
					);
				}
				return <span key={key}>{part}</span>;
			})}
		</span>
	);
};

const SearchResultRow = ({
	query,
	result,
}: {
	query: string;
	result: SearchResult;
}) => {
	const { formatMoney } = useUserFormat();
	const amount =
		result.amount == null || !Number.isFinite(result.amount)
			? null
			: formatMoney(result.amount, result.currency);
	const when = formatDate(result.occurred_at ?? result.created_at);
	const sourceCapture =
		result.source_document_id != null && Number(result.source_document_id) > 0
			? `Source capture #${Number(result.source_document_id)}`
			: null;
	const sourceCaptureHref =
		result.space_id != null &&
		result.source_document_id != null &&
		Number(result.source_document_id) > 0
			? `/console/review?spaceId=${encodeURIComponent(String(result.space_id))}&sourceDocumentId=${encodeURIComponent(String(result.source_document_id))}`
			: null;
	const statusLabel = searchStatusLabel(result.status);
	const entity: EntityViewModel = {
		id: result.id,
		visualKey: visualForResult(result.type),
		label: sectionLabel[result.type],
		title: (
			<HighlightedText
				className="truncate text-sm font-semibold text-foreground"
				query={query}
				text={result.title}
			/>
		),
		subtitle: (
			<HighlightedText
				className="mt-1 block truncate text-sm text-foreground/72"
				query={query}
				text={result.subtitle || result.space_name || "Ceits"}
			/>
		),
		detail: result.detail ? (
			<HighlightedText
				className="mt-1 block truncate text-xs text-muted-foreground"
				query={query}
				text={result.detail}
			/>
		) : undefined,
		href: result.href,
		status: statusLabel,
		statusClassName: searchStatusClassName(result.status),
		meta: [
			amount,
			when,
			sourceCapture,
			...(result.matched_fields ?? []).slice(0, 2),
		].filter(Boolean),
	};

	return (
		<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
			<div className="min-w-0 flex-1">
				<EntityListItem entity={entity} />
			</div>
			{sourceCaptureHref ? (
				<Link
					className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-[rgba(82,72,57,0.16)] bg-white/70 px-3 text-[11px] font-semibold text-foreground transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mt-3"
					to={sourceCaptureHref}
				>
					Review capture
				</Link>
			) : null}
		</div>
	);
};

const isSearchFilter = (value: string | null): value is SearchFilter =>
	value === "all" ||
	value === "space" ||
	value === "expense" ||
	value === "expense_item" ||
	value === "promo_code" ||
	value === "participant" ||
	value === "split" ||
	value === "recurring" ||
	value === "source_document";

export const GlobalSearchPage = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [query, setQuery] = useState(searchParams.get("q") ?? "");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [scope, setScope] = useState("all_accessible");
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const entityFilter = useMemo<SearchFilter>(() => {
		const raw = searchParams.get("types");
		return isSearchFilter(raw) ? raw : "all";
	}, [searchParams]);

	const spaceId = searchParams.get("spaceId") ?? searchParams.get("space_id");

	useEffect(() => {
		setQuery(searchParams.get("q") ?? "");
	}, [searchParams]);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		void apiClient.search
			.get({
				q: searchParams.get("q") ?? "",
				spaceId,
				types: entityFilter === "all" ? undefined : [entityFilter],
				limit: 80,
			})
			.then((response) => {
				if (cancelled) return;
				setResults(response.results ?? []);
				setScope(response.scope);
				setTotal(response.total);
			})
			.catch((error) => {
				if (cancelled) return;
				setLoadError(
					error instanceof Error ? error.message : "Failed to search Ceits",
				);
				setResults([]);
				setTotal(0);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [entityFilter, searchParams, spaceId]);

	const resultCounts = useMemo(() => {
		const counts: Record<SearchFilter, number> = {
			all: results.length,
			space: 0,
			expense: 0,
			expense_item: 0,
			promo_code: 0,
			participant: 0,
			split: 0,
			recurring: 0,
			source_document: 0,
		};
		for (const result of results) {
			counts[result.type] += 1;
		}
		return counts;
	}, [results]);

	const groupedResults = useMemo(() => {
		return sectionOrder
			.map((type) => ({
				type,
				items: results.filter((result) => result.type === type),
			}))
			.filter((section) => section.items.length > 0);
	}, [results]);

	const updateSearch = (next: { q?: string; type?: SearchFilter }) => {
		const params = new URLSearchParams(searchParams);
		const nextQuery = next.q ?? query;
		const nextType = next.type ?? entityFilter;
		if (nextQuery.trim()) params.set("q", nextQuery);
		else params.delete("q");
		if (nextType !== "all") params.set("types", nextType);
		else params.delete("types");
		setSearchParams(params, { replace: true });
	};

	const promoResults = results
		.filter((result) => result.type === "promo_code")
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
								Search across the spaces and records you can access. Results use
								the server search contract, so this page can grow without each
								section inventing its own filters.
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
								const active = entityFilter === filter.key;
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
										<EntityIcon
											className={active ? "border-background/20" : ""}
											size="xs"
											visualKey={filter.visualKey}
										/>
										<span>{filter.label}</span>
										<span className="tabular-nums opacity-70">
											{filter.key === "all"
												? total
												: (resultCounts[filter.key] ?? 0)}
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
										? "Searching..."
										: `${total} result${total === 1 ? "" : "s"}`}
								</p>
								<p className="text-xs text-muted-foreground">
									Scope: {scope.replace(/_/g, " ")}
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
										{section.items.map((result) => (
											<SearchResultRow
												key={result.id}
												query={query}
												result={result}
											/>
										))}
									</div>
								</div>
							))
						) : (
							<div className="rounded-2xl border border-dashed border-[rgba(120,100,80,0.2)] bg-white/58 p-8 text-center">
								<ListChecks className="mx-auto h-8 w-8 text-muted-foreground" />
								<h2 className="mt-3 text-base font-semibold text-foreground">
									{isLoading
										? "Looking through Ceits"
										: "No matching records yet"}
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
							Result shape
						</p>
						<div className="mt-3 grid grid-cols-2 gap-2">
							<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.72)] p-3">
								<p className="text-2xl font-bold tabular-nums">{total}</p>
								<p className="text-xs text-muted-foreground">results</p>
							</div>
							<div className="rounded-xl border border-[rgba(120,100,80,0.12)] bg-[rgba(255,252,246,0.72)] p-3">
								<p className="text-2xl font-bold tabular-nums">
									{groupedResults.length}
								</p>
								<p className="text-xs text-muted-foreground">groups</p>
							</div>
						</div>
					</section>

					<section className="rounded-2xl border border-[rgba(120,100,80,0.14)] bg-white/68 p-4 shadow-sm">
						<div className="flex items-center justify-between gap-3">
							<p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
								Promo matches
							</p>
							<EntityIcon size="xs" visualKey="benefit" />
						</div>
						<div className="mt-3 space-y-2">
							{promoResults.length ? (
								promoResults.map((result) => (
									<EntityMini
										entity={{
											id: result.id,
											visualKey: "benefit",
											label: "Promos",
											title: result.title,
											subtitle: result.subtitle || result.space_name || "Promo",
											href: result.href,
										}}
										key={result.id}
									/>
								))
							) : (
								<p className="rounded-xl border border-dashed border-[rgba(120,100,80,0.16)] p-3 text-sm text-muted-foreground">
									Promo matches will appear here when search finds them.
								</p>
							)}
						</div>
					</section>
				</div>
			</aside>
		</div>
	);
};
