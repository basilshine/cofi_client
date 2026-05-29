import type { DashboardResponse } from "@cofi/api";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { useUserFormat } from "../../shared/hooks/useUserFormat";
import { apiClient } from "../../shared/lib/apiClient";
import type { ChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { OverviewRightRail } from "../../widgets/overview-right-rail";
import { ActivityListCard } from "./components/ActivityListCard";
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
		normalized.includes("bill")
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

const humanizeStatus = (
	value?: string | null,
	fallback = "Confirmed",
): string => {
	const raw = (value ?? "").trim();
	if (!raw) return fallback;
	const withSpaces = raw.replace(/_/g, " ");
	return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const friendlySpaceNameByIndex = [
	"Family Budget",
	"Home & Bills",
	"Weekend Trip",
	"Personal",
];

const normalizeSpaceName = (name: string, index: number): string => {
	const trimmed = name.trim();
	if (!trimmed) return friendlySpaceNameByIndex[index] ?? `Space ${index + 1}`;
	if (/^ws shared \d+$/i.test(trimmed)) {
		return friendlySpaceNameByIndex[index] ?? "Shared Space";
	}
	return trimmed;
};

const normalizeLabel = (
	value: string | undefined | null,
	fallback: string,
): string => {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return fallback;
	if (/\(dummy\)/i.test(trimmed)) return fallback;
	return trimmed;
};

const transactionLabelFallbacks = [
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
	const { workspaceScope } = useWorkspaceSpaces();
	useConsoleHeaderTitle("Home", null);

	const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

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
	const pendingDrafts = dashboardData?.pending_drafts ?? [];
	const recentTx = dashboardData?.recent_transactions ?? [];
	const reviewQ = dashboardData?.review_queue ?? null;
	const recurringUpcoming = dashboardData?.recurring_upcoming ?? [];
	const spendOverview = dashboardData?.spend_overview;

	const monthlyTotal =
		monthly != null
			? typeof monthly.total_my_share === "number" &&
				!Number.isNaN(monthly.total_my_share)
				? monthly.total_my_share
				: monthly.total_spent
			: null;

	const reviewContextLine = useMemo(() => {
		const pendingSplits =
			reviewQ?.items?.filter(
				(item) =>
					typeof item === "object" &&
					item != null &&
					(item as { kind?: string }).kind === "expense_thread_approval",
			).length ?? 0;
		const dueSoonCount = recurringUpcoming.filter((item) => {
			const nextDue = Date.parse(item.next_due);
			if (!Number.isFinite(nextDue)) return false;
			const daysUntil = (nextDue - Date.now()) / (1000 * 60 * 60 * 24);
			return daysUntil >= 0 && daysUntil <= 7;
		}).length;

		if (pendingSplits > 0 && dueSoonCount > 0) {
			return `${pendingSplits} split${pendingSplits === 1 ? "" : "s"} and a bill need attention`;
		}
		if (pendingSplits > 0) {
			return "Splits need your attention";
		}
		if (dueSoonCount > 0) {
			return "A bill is due soon";
		}
		return "Splits and bills need attention";
	}, [reviewQ?.items, recurringUpcoming]);

	const newTransactionsContextLine = useMemo(() => {
		const todayCount = recentTx.filter((t) => {
			const d = new Date(t.occurred_at);
			return (
				Number.isFinite(d.getTime()) &&
				d.toDateString() === new Date().toDateString()
			);
		}).length;

		if (todayCount > 0) {
			return `+${todayCount} today`;
		}

		const fallback = recentTx[0]?.label
			? `Mostly ${normalizeLabel(recentTx[0].label, "groceries").toLowerCase()} this week`
			: "Mostly groceries this week";
		return fallback;
	}, [recentTx]);

	const reviewTopSpaces = useMemo(() => {
		const topSpaces = new Map<number, { name: string; count: number }>();
		for (const item of reviewQ?.items ?? []) {
			if (typeof item !== "object" || item == null) continue;
			const spaceId = (item as { space_id?: number }).space_id;
			const spaceName = (item as { space_name?: string }).space_name;
			if (
				typeof spaceId !== "number" ||
				!Number.isFinite(spaceId) ||
				!spaceName ||
				!spaceName.trim()
			) {
				continue;
			}
			const existing = topSpaces.get(spaceId);
			topSpaces.set(spaceId, {
				name: spaceName,
				count: (existing?.count ?? 0) + 1,
			});
		}
		for (const draft of pendingDrafts) {
			const spaceId = draft.space_id;
			const spaceName = draft.space_name?.trim();
			if (
				typeof spaceId !== "number" ||
				!Number.isFinite(spaceId) ||
				!spaceName
			) {
				continue;
			}
			const existing = topSpaces.get(spaceId);
			topSpaces.set(spaceId, {
				name: spaceName,
				count: (existing?.count ?? 0) + 1,
			});
		}
		return [...topSpaces.entries()]
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 2)
			.map(([id, payload]) => ({ id, name: payload.name }));
	}, [reviewQ?.items, pendingDrafts]);

	const reviewPrimarySpaceId = useMemo(() => {
		return reviewTopSpaces[0]?.id ?? null;
	}, [reviewTopSpaces]);

	const transactionTopSpaces = useMemo(() => {
		const topSpaces = new Map<number, { name: string; count: number }>();
		for (const tx of recentTx) {
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
	}, [recentTx]);

	const recentActiveSpaceId = useMemo(() => {
		if (recentTx.length === 0) return null;
		const latest = [...recentTx].sort(
			(a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
		)[0];
		return typeof latest?.space_id === "number" ? latest.space_id : null;
	}, [recentTx]);

	const recentActivityItems = useMemo(() => {
		const txItems = recentTx.map((t) => ({
			amountLabel: formatMoney(t.amount),
			eventType: detectActivityType(t.label, t.status),
			id: `tx-${t.id}`,
			occurredAt: t.occurred_at,
			spaceName: normalizeSpaceName(
				t.space_name,
				t.space_id % friendlySpaceNameByIndex.length,
			),
			statusLabel: humanizeStatus(t.status, "Confirmed"),
			statusPillLabel: ["draft", "pending", "question", "review"].some(
				(token) => (t.status ?? "").toLowerCase().includes(token),
			)
				? humanizeStatus(t.status)
				: undefined,
			timeLabel: formatRelative(t.occurred_at),
			title: normalizeLabel(
				t.label,
				transactionLabelFallbacks[t.id % transactionLabelFallbacks.length] ??
					"Grocery run",
			),
			to: `/console/chat/thread?spaceId=${encodeURIComponent(String(t.space_id))}&expenseId=${encodeURIComponent(String(t.id))}`,
		}));

		const draftItems = pendingDrafts.map((draft) => {
			const detectedEventType = detectActivityType(draft.label, "draft");
			const draftEventType =
				detectedEventType === "receipt" ? "receipt" : "draft";
			const humanDraftStatus =
				draftEventType === "receipt" ? "Needs review" : "Not saved yet";
			return {
				amountLabel: formatMoney(
					typeof draft.my_share === "number" ? draft.my_share : draft.total,
				),
				eventType: draftEventType as "draft" | "receipt",
				id: `draft-${draft.id}`,
				occurredAt: draft.updated_at,
				spaceName: normalizeSpaceName(
					draft.space_name,
					draft.space_id % friendlySpaceNameByIndex.length,
				),
				statusLabel: humanDraftStatus,
				statusPillLabel: humanDraftStatus,
				timeLabel: formatRelative(draft.updated_at),
				title: normalizeLabel(draft.label, "Expense draft"),
				to: `/console/chat?spaceId=${encodeURIComponent(String(draft.space_id))}&view=activity`,
			};
		});

		const reviewItems = (reviewQ?.items ?? []).flatMap((item) => {
			if (
				typeof item !== "object" ||
				item == null ||
				(item as { kind?: string }).kind !== "expense_thread_approval"
			) {
				return [];
			}
			const approval = item as {
				expense_id: number;
				space_id: number;
				space_name: string;
				label: string;
				my_share: number;
				updated_at: string;
			};
			return [
				{
					amountLabel: formatMoney(approval.my_share),
					eventType: "split-assigned" as const,
					id: `review-${approval.expense_id}`,
					occurredAt: approval.updated_at,
					spaceName: normalizeSpaceName(
						approval.space_name,
						approval.space_id % friendlySpaceNameByIndex.length,
					),
					statusLabel: "Split review",
					statusPillLabel: "Review",
					timeLabel: formatRelative(approval.updated_at),
					title: normalizeLabel(approval.label, "Split approval"),
					to: `/console/chat/thread?spaceId=${encodeURIComponent(String(approval.space_id))}&expenseId=${encodeURIComponent(String(approval.expense_id))}`,
				},
			];
		});

		return [...txItems, ...draftItems, ...reviewItems]
			.sort(
				(a, b) =>
					Date.parse(b.occurredAt ?? "") - Date.parse(a.occurredAt ?? ""),
			)
			.slice(0, 6);
	}, [recentTx, pendingDrafts, reviewQ?.items, formatMoney]);

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
								spaceLinks={reviewTopSpaces}
								to={
									reviewPrimarySpaceId != null
										? `/console/review?spaceId=${encodeURIComponent(String(reviewPrimarySpaceId))}`
										: "/console/spaces"
								}
								tone="review"
								value={String(
									(reviewQ?.total_count ?? 0) + pendingDrafts.length,
								)}
							/>
							<InsightMetricCard
								contextLine={newTransactionsContextLine}
								label="New transactions"
								loading={isLoading}
								spaceLinks={transactionTopSpaces}
								to={
									recentActiveSpaceId != null
										? `/console/chat?spaceId=${encodeURIComponent(String(recentActiveSpaceId))}&view=activity`
										: "/console/spaces"
								}
								tone="activity"
								value={String(recentTx.length)}
							/>
						</div>
					</section>

					<ActivityListCard
						ctaLabel="View history"
						ctaTo="/console/chat/expenses"
						emptyText="No activity yet"
						items={recentActivityItems}
						linkState={chatWorkspace ? { chatWorkspace } : undefined}
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
