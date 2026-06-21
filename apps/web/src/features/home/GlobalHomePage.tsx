import type { DashboardResponse } from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import { toPromoBenefit } from "../../shared/lib/benefitPresentation";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { buildExpenseDetailHref } from "../../shared/lib/expenseLinks";
import { OverviewRightRail } from "../../widgets/overview-right-rail";
import { ActivityListCard } from "./components/ActivityListCard";
import {
	HomePromoModule,
	type HomePromoPreviewItem,
} from "./components/HomePromoModule";
import { InsightMetricCard } from "./components/InsightMetricCard";
import { OverviewHeroCard } from "./components/OverviewHeroCard";

const sectionEyebrow = "eyebrow";

const ghostButton =
	"inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/40 backdrop-blur-sm px-3.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const formatRelative = (iso?: string | null): string => {
	if (!iso) return "—";
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return iso;
	const diff = Date.now() - ts;
	const min = Math.round(diff / 60000);
	if (min < 1) return "just now";
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day < 7) return `${day}d ago`;
	const week = Math.round(day / 7);
	return `${week}w ago`;
};

const detectActivityType = (
	label: string,
	status?: string | null,
):
	| "expense"
	| "question"
	| "recurring"
	| "receipt"
	| "voice"
	| "edited"
	| "split-assigned"
	| "benefit"
	| "participant"
	| "recurring-created" => {
	const normalized = `${label} ${status ?? ""}`.toLowerCase();
	if (
		normalized.includes("split assigned") ||
		normalized.includes("split review")
	) {
		return "split-assigned";
	}
	if (normalized.includes("edited") || normalized.includes("updated")) {
		return "edited";
	}
	if (
		normalized.includes("recurring created") ||
		normalized.includes("schedule created")
	) {
		return "recurring-created";
	}
	if (
		normalized.includes("question") ||
		normalized.includes("query") ||
		normalized.includes("ask")
	) {
		return "question";
	}
	if (
		normalized.includes("subscription") ||
		normalized.includes("recurring") ||
		normalized.includes("monthly")
	) {
		return "recurring";
	}
	if (
		normalized.includes("receipt") ||
		normalized.includes("invoice") ||
		normalized.includes("bill") ||
		normalized.includes("кассовый чек") ||
		normalized.includes("фискальный") ||
		normalized.includes("фн ") ||
		normalized.includes("фд ")
	) {
		return "receipt";
	}
	if (
		normalized.includes("voice") ||
		normalized.includes("transcript") ||
		normalized.includes("audio")
	) {
		return "voice";
	}
	return "expense";
};

const detectDashboardOutcomeType = (
	action?: string | null,
	entity?: string | null,
): ReturnType<typeof detectActivityType> => {
	const key = `${action ?? ""} ${entity ?? ""}`.toLowerCase();
	if (key.includes("promo") || key.includes("benefit")) return "benefit";
	if (key.includes("participant")) return "participant";
	if (key.includes("split")) return "split-assigned";
	if (key.includes("recurring")) return "recurring-created";
	return "expense";
};

const dashboardOutcomeStatus = (action?: string | null): string => {
	switch (action) {
		case "promo_saved":
			return "Benefit record";
		case "participant_created":
			return "Participant record";
		case "expense_participant_splits_updated":
			return "Split records";
		case "recurring_created":
			return "Recurring rule";
		default:
			return "Record saved";
	}
};

const humanizeStatus = (
	value?: string | null,
	fallback = "Confirmed",
): string => {
	const raw = (value ?? "").trim();
	if (!raw) return fallback;
	const withSpaces = raw.replace(/_/g, " ");
	return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const normalizeSpaceName = (
	name: string | undefined | null,
	spaceId?: number | null,
): string => {
	const trimmed = name?.trim() ?? "";
	if (!trimmed) {
		return typeof spaceId === "number" && Number.isFinite(spaceId)
			? `Space #${spaceId}`
			: "Unknown space";
	}
	if (/^ws shared \d+$/i.test(trimmed)) {
		return typeof spaceId === "number" && Number.isFinite(spaceId)
			? `Space #${spaceId}`
			: "Shared space";
	}
	return trimmed;
};

const normalizeLabel = (
	value: string | undefined | null,
	fallback: string,
): string => {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return fallback;
	return trimmed;
};

const buildReviewHref = (
	spaceId: string | number,
	sourceDocumentId?: string | number | null,
): string => {
	const params = new URLSearchParams({ spaceId: String(spaceId) });
	if (sourceDocumentId != null) {
		const parsed = Number(sourceDocumentId);
		if (Number.isFinite(parsed) && parsed > 0) {
			params.set("sourceDocumentId", String(parsed));
		}
	}
	return `/console/review?${params.toString()}`;
};

const expenseLabelFallbacks = [
	"Grocery run",
	"Home Depot",
	"Whole Foods",
	"Summer camp deposit",
	"Internet bill",
];

type HeroChipTone = "food" | "recurring" | "uncategorized";

const getHeroChipTone = (tag: string): HeroChipTone => {
	const normalized = tag.trim().toLowerCase();
	if (
		normalized.includes("food") ||
		normalized.includes("grocery") ||
		normalized.includes("groceries")
	) {
		return "food";
	}
	if (
		normalized.includes("bill") ||
		normalized.includes("recurring") ||
		normalized.includes("subscription") ||
		normalized.includes("rent") ||
		normalized.includes("utilities")
	) {
		return "recurring";
	}
	return "uncategorized";
};

export const GlobalHomePage = () => {
	const { user } = useAuth();
	const { formatMoney } = useUserFormat();
	const { spaces, workspaceScope } = useWorkspaceSpaces();
	useConsoleHeaderTitle("Home", null);

	const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [promoPreviewItems, setPromoPreviewItems] = useState<
		HomePromoPreviewItem[]
	>([]);
	const [isPromoPreviewLoading, setIsPromoPreviewLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setLoadError(null);
		void (async () => {
			try {
				const res = await apiClient.dashboard.get({
					variant: "personal",
					period: "month",
				});
				if (!cancelled) {
					setDashboardData(res);
				}
			} catch (e) {
				if (!cancelled) {
					setLoadError(
						e instanceof Error ? e.message : "Failed to load home overview",
					);
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const chatWorkspace = useMemo((): ChatWorkspaceScope | null => {
		if (workspaceScope) return workspaceScope;
		if (dashboardData?.context?.tenant_id != null) {
			return {
				kind: "personal",
				tenantId: Number(dashboardData.context.tenant_id),
				label: "Personal",
			};
		}
		return null;
	}, [workspaceScope, dashboardData?.context?.tenant_id]);

	const monthly = dashboardData?.monthly_snapshot ?? null;
	const recentExpenses = dashboardData?.recent_expenses ?? [];
	const recurringUpcoming = dashboardData?.recurring_upcoming ?? [];
	const spendOverview = dashboardData?.spend_overview;
	const dashboardActivity = dashboardData?.recent_activity?.items ?? [];

	const monthlyTotal =
		monthly != null
			? typeof monthly.total_my_share === "number" &&
				!Number.isNaN(monthly.total_my_share)
				? monthly.total_my_share
				: monthly.total_spent
			: null;

	const reviewContextLine = useMemo(() => {
		const dueSoonCount = recurringUpcoming.filter((item) => {
			const nextDue = Date.parse(item.next_due);
			if (!Number.isFinite(nextDue)) return false;
			const daysUntil = (nextDue - Date.now()) / (1000 * 60 * 60 * 24);
			return daysUntil >= 0 && daysUntil <= 7;
		}).length;

		if (dueSoonCount > 0) {
			return "A bill is due soon";
		}
		return "Open Review to handle capture candidates";
	}, [recurringUpcoming]);

	const newExpenseRecordsContextLine = useMemo(() => {
		const todayCount = recentExpenses.filter((expense) => {
			const d = new Date(expense.occurred_at);
			return (
				Number.isFinite(d.getTime()) &&
				d.toDateString() === new Date().toDateString()
			);
		}).length;

		if (todayCount > 0) {
			return `+${todayCount} today`;
		}

		const fallback = recentExpenses[0]?.label
			? `Mostly ${normalizeLabel(recentExpenses[0].label, "groceries").toLowerCase()} this week`
			: "Mostly groceries this week";
		return fallback;
	}, [recentExpenses]);

	const expenseTopSpaces = useMemo(() => {
		const topSpaces = new Map<number, { name: string; count: number }>();
		for (const tx of recentExpenses) {
			if (typeof tx.space_id !== "number" || !Number.isFinite(tx.space_id)) {
				continue;
			}
			const spaceName = tx.space_name?.trim();
			if (!spaceName) continue;
			const existing = topSpaces.get(tx.space_id);
			topSpaces.set(tx.space_id, {
				name: spaceName,
				count: (existing?.count ?? 0) + 1,
			});
		}
		return [...topSpaces.entries()]
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 2)
			.map(([id, payload]) => ({ id, name: payload.name }));
	}, [recentExpenses]);

	const recentActiveSpaceId = useMemo(() => {
		if (recentExpenses.length === 0) return null;
		const latest = [...recentExpenses].sort(
			(a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
		)[0];
		return typeof latest?.space_id === "number" ? latest.space_id : null;
	}, [recentExpenses]);

	const promoPreviewSpaces = useMemo(() => {
		const byId = new Map<number, string>();
		const add = (
			spaceId: number | null | undefined,
			spaceName?: string | null,
		) => {
			if (typeof spaceId !== "number" || !Number.isFinite(spaceId)) return;
			if (byId.has(spaceId)) return;
			const fallback = spaces?.find(
				(space) => Number(space.id) === spaceId,
			)?.name;
			byId.set(
				spaceId,
				normalizeSpaceName(spaceName ?? fallback ?? "", spaceId),
			);
		};

		for (const space of expenseTopSpaces) add(space.id, space.name);
		if (recentActiveSpaceId != null) add(recentActiveSpaceId);
		for (const space of spaces ?? []) {
			add(Number(space.id), space.name);
			if (byId.size >= 3) break;
		}

		return [...byId.entries()].slice(0, 3).map(([id, name]) => ({ id, name }));
	}, [expenseTopSpaces, recentActiveSpaceId, spaces]);

	useEffect(() => {
		let cancelled = false;
		if (promoPreviewSpaces.length === 0) {
			setPromoPreviewItems([]);
			setIsPromoPreviewLoading(false);
			return;
		}

		setIsPromoPreviewLoading(true);
		void (async () => {
			try {
				const settled = await Promise.allSettled(
					promoPreviewSpaces.map(async (space) => {
						const response = await apiClient.spaces.listPromos(space.id);
						return {
							space,
							promos: response.promos ?? [],
						};
					}),
				);
				if (cancelled) return;
				const items = settled.flatMap((result): HomePromoPreviewItem[] => {
					if (result.status !== "fulfilled") return [];
					return result.value.promos
						.map((promo) => toPromoBenefit(promo))
						.filter(
							(promo) =>
								promo.status === "active" || promo.status === "expires_soon",
						)
						.map((promo) => ({
							promo,
							spaceId: result.value.space.id,
							spaceName: result.value.space.name,
						}));
				});
				items.sort((a, b) => {
					if (a.promo.status !== b.promo.status) {
						if (a.promo.status === "expires_soon") return -1;
						if (b.promo.status === "expires_soon") return 1;
					}
					const aTs = Date.parse(a.promo.raw.valid_until ?? "");
					const bTs = Date.parse(b.promo.raw.valid_until ?? "");
					const safeA = Number.isFinite(aTs) ? aTs : Number.MAX_SAFE_INTEGER;
					const safeB = Number.isFinite(bTs) ? bTs : Number.MAX_SAFE_INTEGER;
					return safeA - safeB;
				});
				setPromoPreviewItems(items.slice(0, 3));
			} finally {
				if (!cancelled) setIsPromoPreviewLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [promoPreviewSpaces]);

	const recentActivityItems = useMemo(() => {
		const outcomeItems = dashboardActivity
			.filter((item) => item.action || item.source_document_id != null)
			.map((item) => {
				const eventType = detectDashboardOutcomeType(item.action, item.entity);
				const statusLabel = dashboardOutcomeStatus(item.action);
				return {
					eventType,
					id: item.id ?? `activity-${item.space_id}-${item.timestamp}`,
					meaningLine:
						item.source_document_id != null
							? "Saved record with source capture provenance."
							: "Saved record in this space.",
					occurredAt: item.timestamp,
					spaceName: normalizeSpaceName(item.space_name, item.space_id),
					statusLabel,
					statusPillLabel: "Saved record",
					sourceCaptureTo:
						item.source_document_id != null
							? buildReviewHref(item.space_id, item.source_document_id)
							: null,
					sourceDocumentId: item.source_document_id ?? null,
					timeLabel: formatRelative(item.timestamp),
					title: normalizeLabel(item.caption, statusLabel),
					to:
						item.source_document_id != null
							? buildReviewHref(item.space_id, item.source_document_id)
							: `/console/spaces/${encodeURIComponent(String(item.space_id))}/overview`,
				};
			});

		const expenseItems = recentExpenses.map((expense) => ({
			amountLabel: formatMoney(expense.amount),
			eventType: detectActivityType(expense.label, expense.status),
			id: `expense-${expense.id}`,
			occurredAt: expense.occurred_at,
			spaceName: normalizeSpaceName(expense.space_name, expense.space_id),
			statusLabel: humanizeStatus(expense.status, "Confirmed"),
			statusPillLabel: ["pending", "question", "review"].some((token) =>
				(expense.status ?? "").toLowerCase().includes(token),
			)
				? humanizeStatus(expense.status)
				: undefined,
			sourceCaptureTo:
				expense.source_document_id != null
					? buildReviewHref(expense.space_id, expense.source_document_id)
					: null,
			sourceDocumentId: expense.source_document_id ?? null,
			timeLabel: formatRelative(expense.occurred_at),
			title: normalizeLabel(
				expense.label,
				expenseLabelFallbacks[expense.id % expenseLabelFallbacks.length] ??
					"Grocery run",
			),
			to: buildExpenseDetailHref(expense.space_id, expense.id),
		}));

		return [...outcomeItems, ...expenseItems]
			.sort(
				(a, b) =>
					Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""),
			)
			.slice(0, 6);
	}, [dashboardActivity, recentExpenses, formatMoney]);

	const breakdownItems = useMemo(() => {
		const tags =
			spendOverview?.by_tag
				?.filter((item) => Number.isFinite(item.amount))
				.slice(0, 3)
				.map((item) => {
					const amountLabel = formatMoney(item.amount);
					const tone = getHeroChipTone(item.tag);
					if (monthlyTotal == null || monthlyTotal <= 0) {
						return { label: item.tag, detail: amountLabel, tone };
					}
					const share = Math.round((item.amount / monthlyTotal) * 100);
					return { label: item.tag, detail: `${share}%`, tone };
				}) ?? [];

		if (tags.length > 0) return tags;
		return [
			{ label: "Groceries", detail: "Core", tone: "food" as const },
			{ label: "Home & Bills", detail: "Steady", tone: "recurring" as const },
			{
				label: "Family Trip",
				detail: "Upcoming",
				tone: "uncategorized" as const,
			},
		];
	}, [spendOverview?.by_tag, monthlyTotal, formatMoney]);

	const breakdownStripSegments = useMemo(() => {
		const weighted = breakdownItems.map((item, index) => {
			const fromPct = Number.parseInt(item.detail.replace(/%/g, ""), 10);
			const value = Number.isFinite(fromPct)
				? fromPct
				: breakdownItems.length === 0
					? 0
					: Math.round(100 / breakdownItems.length);
			return {
				key: `${item.label}-${index}`,
				tone: item.tone,
				value,
			};
		});
		const total = weighted.reduce((sum, item) => sum + item.value, 0);
		if (total <= 0) return [];
		return weighted.map((item) => ({
			...item,
			width: `${Math.max(8, (item.value / total) * 100)}%`,
		}));
	}, [breakdownItems]);

	const insightText = useMemo(() => {
		if (monthly?.previous_period_my_share != null && monthlyTotal != null) {
			if (monthlyTotal < monthly.previous_period_my_share) {
				return "You're spending less than last month.";
			}
			if (monthlyTotal > monthly.previous_period_my_share) {
				return "Your household spending is steady this month.";
			}
		}

		const topItem = breakdownItems[0];
		if (!topItem) return "Your household spending is steady this month.";
		if (topItem.tone === "food") {
			return "Most of your spending is groceries this month.";
		}
		if (topItem.tone === "recurring") {
			return "Recurring payments are your main expense.";
		}
		return "Your household spending is steady this month.";
	}, [monthly?.previous_period_my_share, monthlyTotal, breakdownItems]);

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			<div className="scrollbar-editorial min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
				<div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 lg:px-10 lg:py-10">
					<header className="flex flex-wrap items-end justify-between gap-4">
						<div className="min-w-0 max-w-full space-y-1.5">
							<p className={sectionEyebrow}>Household overview</p>
							<h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
								{user?.name?.trim()
									? `Welcome back, ${user.name.split(/\s+/)[0]}`
									: "Welcome back"}
							</h1>
							<p className="max-w-prose text-sm text-muted-foreground">
								Your shared spaces, bills, and spending in one place.
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Link className={ghostButton} to="/console/spaces">
								Manage spaces
							</Link>
						</div>
					</header>

					{loadError ? (
						<div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
							{loadError}
						</div>
					) : null}

					<section
						aria-label="Summary this month"
						className="grid grid-cols-1 gap-5 lg:grid-cols-3"
					>
						<div className="lg:col-span-2">
							<OverviewHeroCard
								amount={monthlyTotal != null ? formatMoney(monthlyTotal) : "—"}
								chips={breakdownItems}
								eyebrow="Your shared money this month"
								insight={insightText}
								loading={isLoading}
								stripSegments={breakdownStripSegments}
								subtitle="Across your active spaces"
							/>
						</div>

						<div className="grid grid-cols-1 gap-4">
							<InsightMetricCard
								contextLine={reviewContextLine}
								label="Needs your review"
								loading={isLoading}
								spaceLinks={[]}
								to="/console/review"
								tone="review"
								value="Open"
							/>
							<InsightMetricCard
								contextLine={newExpenseRecordsContextLine}
								label="New expenses"
								loading={isLoading}
								spaceLinks={expenseTopSpaces}
								to={
									recentActiveSpaceId != null
										? `/console/spaces/${encodeURIComponent(String(recentActiveSpaceId))}/expenses`
										: "/console/spaces"
								}
								tone="activity"
								value={String(recentExpenses.length)}
							/>
						</div>
					</section>

					<HomePromoModule
						isLoading={isPromoPreviewLoading}
						items={promoPreviewItems}
					/>

					<ActivityListCard
						ctaLabel="Review captures"
						ctaTo="/console/review"
						emptyText="No activity yet"
						items={recentActivityItems}
						linkState={chatWorkspace ? { chatWorkspace } : undefined}
						scope="global"
						title="Recent activity"
					/>

					{/* On smaller viewports the right rail content stacks here. */}
					<div className="xl:hidden">
						<OverviewRightRail
							chatWorkspace={chatWorkspace}
							dashboardData={dashboardData}
							formatMoney={formatMoney}
						/>
					</div>
				</div>
			</div>

			<aside
				aria-label="Household utility rail"
				className="hidden shrink-0 self-stretch flex-col border-l border-border/60 bg-muted/30 xl:flex xl:w-[20rem]"
			>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-8">
					<OverviewRightRail
						chatWorkspace={chatWorkspace}
						dashboardData={dashboardData}
						formatMoney={formatMoney}
					/>
				</div>
			</aside>
		</div>
	);
};
