import type { DashboardResponse, Space } from "@cofi/api";
import { motion } from "framer-motion";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

const MotionLink = motion(Link);
import { useConsoleHeaderTitle } from "../../app/layout/ConsoleHeaderCenterContext";
import { WorkspaceSpaceSubNav } from "../../app/layout/workspaceSpaces/WorkspaceSpaceSubNav";
import { useWorkspaceSpaces } from "../../app/layout/workspaceSpaces/WorkspaceSpacesContext";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../shared/lib/apiClient";
import {
	fadeUpVariants,
	staggerContainer,
	staggerItem,
} from "../../shared/lib/appMotion";
import { ceitsSpaceExpenseEditUrl } from "../../shared/lib/ceitsAppUrls";
import {
	type ChatWorkspaceScope,
	writeChatWorkspaceScope,
} from "../../shared/lib/chatWorkspaceScope";
import {
	clearOnboardingIntent,
	readOnboardingIntent,
} from "../../shared/lib/onboardingIntent";
import {
	orderSpacesByRecent,
	sortSpacesByLastActivity,
} from "../../shared/lib/recentSpaceIds";
import { notifyWorkspaceNavUpdated } from "../../shared/lib/workspaceNavEvents";
import {
	DashboardVariantProvider,
	useDashboardVariant,
} from "./DashboardVariantContext";
import { ReviewQueuePanel } from "./components/BusinessDashboardPanels";
import { ContinueDashboardPanel } from "./components/ContinueDashboardPanel";
import {
	DashboardWidget,
	type DashboardWidgetState,
} from "./components/DashboardWidget";
import { QuickCaptureWidget } from "./components/QuickCaptureWidget";
import { TenantPeoplePanel } from "./components/TenantPeoplePanel";
import { dashboardWidgetCopy } from "./dashboardWidgetCopy";
import type { DashboardWidgetId } from "./dashboardWidgetIds";

const sectionRhythm = "py-10 md:py-12";

const dashboardHeroCardClass =
	"overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm";

const formatCurrencyAmount = (amount: number, currency: string): string => {
	const code = (currency || "USD").trim().toUpperCase() || "USD";
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: code,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		return `${amount} ${code}`;
	}
};

const formatDateLabel = (iso: string): string => {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(undefined, { dateStyle: "medium" });
	} catch {
		return iso;
	}
};

const DashboardOverviewMetricsRow = ({
	monthly,
	pendingDrafts,
	recurring,
	reviewQ,
	currency,
	formatCurrencyAmount,
	pageLoading,
}: {
	monthly: DashboardResponse["monthly_snapshot"];
	pendingDrafts: DashboardResponse["pending_drafts"];
	recurring: DashboardResponse["recurring_upcoming"];
	reviewQ: DashboardResponse["review_queue"];
	currency: string;
	formatCurrencyAmount: (amount: number, currency: string) => string;
	pageLoading: boolean;
}): ReactNode => {
	const total =
		monthly != null
			? typeof monthly.total_my_share === "number" &&
				!Number.isNaN(monthly.total_my_share)
				? monthly.total_my_share
				: monthly.total_spent
			: null;
	const pendingCount = pendingDrafts?.length ?? 0;
	const reviewCount = reviewQ?.total_count ?? 0;
	const upcomingCount = recurring?.length ?? 0;

	const Metric = ({ label, value }: { label: string; value: string }) => (
		<div className="rounded-xl border border-black/5 bg-[hsl(var(--surface))]/80 px-4 py-3 shadow-sm">
			<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
				{label}
			</p>
			<p className="mt-1 font-display text-2xl font-normal tabular-nums text-[hsl(var(--text-primary))]">
				{value}
			</p>
		</div>
	);

	if (pageLoading) {
		return (
			<div
				aria-busy="true"
				className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
			>
				{[0, 1, 2, 3].map((i) => (
					<div
						className="h-[5.25rem] animate-pulse rounded-xl border border-black/5 bg-[hsl(var(--surface-muted))]/60"
						key={i}
					/>
				))}
			</div>
		);
	}

	return (
		<div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
			<Metric
				label="Total spend (period)"
				value={total != null ? formatCurrencyAmount(total, currency) : "—"}
			/>
			<Metric label="Pending drafts" value={String(pendingCount)} />
			<Metric label="Awaiting review" value={String(reviewCount)} />
			<Metric label="Upcoming recurring" value={String(upcomingCount)} />
		</div>
	);
};

type SpendPeriodKindUI = "day" | "month" | "year";

const normalizeSpendAnchor = (
	anchor: string,
	kind: SpendPeriodKindUI,
): string => {
	const p = anchor.split("-").map(Number);
	const y = p[0] ?? 1970;
	const m = p[1] ?? 1;
	const d = p[2] ?? 1;
	if (kind === "year") return `${y}-01-01`;
	if (kind === "month") return `${y}-${String(m).padStart(2, "0")}-01`;
	return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const bumpSpendAnchor = (
	anchor: string,
	kind: SpendPeriodKindUI,
	dir: -1 | 1,
): string => {
	const p = anchor.split("-").map(Number);
	const y = p[0] ?? 1970;
	const m = p[1] ?? 1;
	const d = p[2] ?? 1;
	if (kind === "day") {
		const t = Date.UTC(y, m - 1, d) + dir * 86400000;
		return new Date(t).toISOString().slice(0, 10);
	}
	if (kind === "month") {
		return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
	}
	return new Date(Date.UTC(y + dir, m - 1, 1)).toISOString().slice(0, 10);
};

const formatSpendPeriodLabel = (
	anchor: string,
	kind: SpendPeriodKindUI,
): string => {
	const p = anchor.split("-").map(Number);
	const y = p[0] ?? 1970;
	const m = p[1] ?? 1;
	const d = p[2] ?? 1;
	const dt = new Date(Date.UTC(y, m - 1, d));
	if (kind === "day") {
		return dt.toLocaleDateString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}
	if (kind === "month") {
		return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
	}
	return String(y);
};

const SpendCoverBand = ({
	monthly,
	currency,
	scopeHint,
	spendPeriodKind,
	spendAnchor,
	onPeriodKind,
	onNav,
	onToday,
	tone = "dark",
	standaloneCard = false,
}: {
	monthly: NonNullable<DashboardResponse["monthly_snapshot"]>;
	currency: string;
	scopeHint: string;
	spendPeriodKind: SpendPeriodKindUI;
	spendAnchor: string;
	onPeriodKind: (k: SpendPeriodKindUI) => void;
	onNav: (dir: -1 | 1) => void;
	onToday: () => void;
	/** `light` matches the main dashboard card surface; `dark` is the legacy zinc hero. */
	tone?: "dark" | "light";
	/** When true, omit bottom border (use inside its own rounded card). */
	standaloneCard?: boolean;
}): ReactNode => {
	const light = tone === "light";
	const share =
		typeof monthly.total_my_share === "number" &&
		!Number.isNaN(monthly.total_my_share)
			? monthly.total_my_share
			: monthly.total_spent;
	const inSpace =
		typeof monthly.selected_space_my_share === "number"
			? monthly.selected_space_my_share
			: 0;
	const spaceTitle =
		(monthly.selected_space_name ?? "").trim() || "Selected space";
	const lightSurface = standaloneCard
		? "relative overflow-hidden bg-muted/30 px-4 py-5 sm:px-5"
		: "relative overflow-hidden border-b border-border bg-muted/30 px-4 py-5 sm:px-5";

	return (
		<div
			className={
				light
					? lightSurface
					: "relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-amber-500/15 via-zinc-900/80 to-zinc-950 px-4 py-5 sm:px-5"
			}
		>
			{light ? null : (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.12),_transparent_55%)]"
				/>
			)}
			<div className="relative space-y-4">
				<div className="space-y-1">
					<p
						className={
							light
								? "text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]"
								: "text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90"
						}
					>
						Your expenses · your share
					</p>
					<p
						className={
							light ? "text-xs text-muted-foreground" : "text-xs text-zinc-400"
						}
					>
						{scopeHint}
					</p>
				</div>
				<div
					className="flex flex-wrap items-center gap-2"
					role="group"
					aria-label="Spend period"
				>
					{(
						[
							["year", "Year"],
							["month", "Month"],
							["day", "Day"],
						] as const
					).map(([k, label]) => (
						<button
							aria-pressed={spendPeriodKind === k}
							className={[
								"rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2",
								light
									? "focus-visible:ring-[hsl(var(--focus-ring))]"
									: "focus-visible:ring-amber-400/50",
								spendPeriodKind === k
									? light
										? "bg-primary/15 text-foreground shadow-sm"
										: "bg-white/15 text-zinc-50 shadow-sm"
									: light
										? "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
										: "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
							].join(" ")}
							key={k}
							onClick={() => onPeriodKind(k)}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-1">
						<button
							aria-label="Previous period"
							className={
								light
									? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
									: "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
							}
							onClick={() => onNav(-1)}
							type="button"
						>
							‹
						</button>
						<button
							aria-label="Next period"
							className={
								light
									? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
									: "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
							}
							onClick={() => onNav(1)}
							type="button"
						>
							›
						</button>
						<button
							className={
								light
									? "ml-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
									: "ml-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-amber-200/90 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
							}
							onClick={onToday}
							type="button"
						>
							Today
						</button>
					</div>
					<p
						className={
							light
								? "min-w-0 text-right text-sm font-medium text-foreground"
								: "min-w-0 text-right text-sm font-medium text-zinc-300"
						}
					>
						{formatSpendPeriodLabel(
							(monthly.anchor_date ?? spendAnchor).trim() || spendAnchor,
							spendPeriodKind,
						)}
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div
						className={
							light
								? "rounded-xl border border-border bg-card px-4 py-3"
								: "rounded-xl border border-white/10 bg-black/20 px-4 py-3"
						}
					>
						<p
							className={
								light
									? "text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
									: "text-[10px] font-medium uppercase tracking-wide text-zinc-500"
							}
						>
							Total (
							{spendPeriodKind === "day"
								? "day"
								: spendPeriodKind === "month"
									? "month"
									: "year"}
							)
						</p>
						<p
							className={
								light
									? "mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground"
									: "mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50"
							}
						>
							{formatCurrencyAmount(share, currency)}
						</p>
						<p
							className={
								light
									? "mt-1 text-[11px] text-muted-foreground"
									: "mt-1 text-[11px] text-zinc-500"
							}
						>
							{formatDateLabel(monthly.period.start)} –{" "}
							{formatDateLabel(monthly.period.end)}
						</p>
					</div>
					<div
						className={
							light
								? "rounded-xl border border-primary/25 bg-primary/5 px-4 py-3"
								: "rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3"
						}
					>
						<p
							className={
								light
									? "text-[10px] font-medium uppercase tracking-wide text-primary"
									: "text-[10px] font-medium uppercase tracking-wide text-amber-200/80"
							}
						>
							In {spaceTitle}
						</p>
						<p
							className={
								light
									? "mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground"
									: "mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50"
							}
						>
							{formatCurrencyAmount(inSpace, currency)}
						</p>
						<p
							className={
								light
									? "mt-1 text-[11px] text-muted-foreground"
									: "mt-1 text-[11px] text-zinc-500"
							}
						>
							Same period · selected space
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

const MONTHLY_LINE_COLORS = [
	"hsl(221 83% 53%)",
	"hsl(160 84% 39%)",
	"hsl(35 92% 52%)",
] as const;

const MonthlySnapshotChart = ({
	monthly,
	pendingDrafts,
	currency,
}: {
	monthly: NonNullable<DashboardResponse["monthly_snapshot"]>;
	pendingDrafts: NonNullable<DashboardResponse["pending_drafts"]> | null;
	currency: string;
}): ReactNode => {
	const shareTotal =
		typeof monthly.total_my_share === "number" &&
		!Number.isNaN(monthly.total_my_share)
			? monthly.total_my_share
			: monthly.total_spent;
	const top3 = monthly.top_spaces.slice(0, 3);
	const rows = top3.map((s, idx) => {
		const addedAmount = (pendingDrafts ?? [])
			.filter((d) => Number(d.space_id) === Number(s.space_id))
			.reduce(
				(acc, d) =>
					acc +
					Number(typeof d.my_share === "number" ? d.my_share : d.total || 0),
				0,
			);
		return {
			...s,
			color: MONTHLY_LINE_COLORS[idx % MONTHLY_LINE_COLORS.length],
			addedAmount,
			confirmedAmount: Number(s.amount || 0),
		};
	});

	const maxY = Math.max(
		1,
		...rows.flatMap((r) => [r.addedAmount, r.confirmedAmount]),
	);
	const leftX = 16;
	const rightX = 184;

	return (
		<div className="space-y-3">
			<p className="text-lg font-semibold tabular-nums">
				{formatCurrencyAmount(shareTotal, currency)}
			</p>
			<p className="text-xs text-[hsl(var(--text-secondary))]">
				Your share (splits applied) · {formatDateLabel(monthly.period.start)} –{" "}
				{formatDateLabel(monthly.period.end)}
			</p>
			{monthly.previous_period_my_share != null ? (
				<p className="text-xs text-[hsl(var(--text-secondary))]">
					Prior period (your share) ·{" "}
					{formatCurrencyAmount(monthly.previous_period_my_share, currency)}
					{monthly.delta_ratio_my_share != null
						? ` (${(monthly.delta_ratio_my_share * 100).toFixed(0)}% delta)`
						: ""}
				</p>
			) : monthly.previous_period_total != null ? (
				<p className="text-xs text-[hsl(var(--text-secondary))]">
					Prior period ·{" "}
					{formatCurrencyAmount(monthly.previous_period_total, currency)}
					{monthly.delta_ratio != null
						? ` (${(monthly.delta_ratio * 100).toFixed(0)}% delta)`
						: ""}
				</p>
			) : null}
			{rows.length > 0 ? (
				<div className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/35 p-2.5">
					<div className="mb-2 flex items-center justify-between text-[10px] font-medium text-[hsl(var(--text-secondary))]">
						<span>Drafts (your share)</span>
						<span>Confirmed (your share)</span>
					</div>
					<svg
						aria-label="Added and confirmed spend by top spaces"
						className="h-28 w-full"
						role="img"
						viewBox="0 0 200 110"
					>
						<title>Top 3 spaces: added vs confirmed spend</title>
						<line
							stroke="hsl(var(--border-subtle))"
							strokeDasharray="2 3"
							strokeWidth="1"
							x1={leftX}
							x2={rightX}
							y1="96"
							y2="96"
						/>
						<line
							stroke="hsl(var(--border-subtle))"
							strokeWidth="1"
							x1={leftX}
							x2={rightX}
							y1="96"
							y2="96"
						/>
						{rows.map((r) => {
							const yAdded = 96 - (r.addedAmount / maxY) * 78;
							const yConfirmed = 96 - (r.confirmedAmount / maxY) * 78;
							return (
								<g key={r.space_id}>
									<line
										opacity="0.9"
										stroke={r.color}
										strokeWidth="2.25"
										x1={leftX}
										x2={rightX}
										y1={yAdded}
										y2={yConfirmed}
									/>
									<circle
										cx={leftX}
										cy={yAdded}
										fill={r.color}
										r="3.2"
										stroke="hsl(var(--surface))"
										strokeWidth="1.2"
									/>
									<circle
										cx={rightX}
										cy={yConfirmed}
										fill={r.color}
										r="3.2"
										stroke="hsl(var(--surface))"
										strokeWidth="1.2"
									/>
								</g>
							);
						})}
					</svg>
					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
						{rows.map((r) => (
							<div
								className="inline-flex items-center gap-1.5 text-[10px]"
								key={r.space_id}
							>
								<span
									aria-hidden
									className="h-2.5 w-2.5 rounded-full"
									style={{ backgroundColor: r.color }}
								/>
								<span className="max-w-[9rem] truncate text-[hsl(var(--text-secondary))]">
									{r.name}
								</span>
							</div>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
};

type HeroContextSpace = {
	id: number;
	name: string;
	description?: string;
	tenantName?: string;
	ownerUserId?: number;
	ownerDisplayName?: string;
};

/** Unified row for dashboard space cards (API list or tenant-scoped dashboard fallback). */
type SpaceGridItem = {
	id: number;
	name: string;
	tenant_id: number;
	last_activity_at?: string | null;
	member_count?: number | null;
	period_spent_preview?: number | null;
	draft_my_share_preview?: number | null;
	owner_user_id?: number;
	tenant_name?: string;
	owner_display_name?: string;
};

const deriveWidgetState = (
	pageLoading: boolean,
	pageError: string | null,
	hasReadyContent: boolean,
): DashboardWidgetState => {
	if (pageLoading) return "loading";
	if (pageError) return "error";
	if (!hasReadyContent) return "empty";
	return "ready";
};

const PendingDraftsList = ({
	items,
	currency,
	resolveChatWorkspace,
	tone = "default",
}: {
	items: NonNullable<DashboardResponse["pending_drafts"]>;
	currency: string;
	resolveChatWorkspace: (draft: (typeof items)[number]) => ChatWorkspaceScope;
	tone?: "default" | "onDark";
}): ReactNode => {
	const linkClass =
		tone === "onDark"
			? "flex flex-col rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:border-amber-400/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
			: "flex flex-col rounded-md border border-[hsl(var(--border-subtle))] px-3 py-2 transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]";
	const titleClass =
		tone === "onDark"
			? "font-medium text-zinc-100"
			: "font-medium text-[hsl(var(--text-primary))]";
	const metaClass =
		tone === "onDark" ? "text-zinc-400" : "text-[hsl(var(--text-secondary))]";
	return (
		<ul className="space-y-2">
			{items.map((d) => {
				const threadHref =
					d.space_id != null && Number(d.space_id) > 0
						? `/console/chat/thread?spaceId=${encodeURIComponent(String(d.space_id))}&expenseId=${encodeURIComponent(String(d.id))}`
						: "/console/drafts";
				const ceitsEditUrl =
					d.space_id != null && Number(d.space_id) > 0 && d.id != null
						? ceitsSpaceExpenseEditUrl(d.space_id, d.id)
						: null;
				const cw = resolveChatWorkspace(d);
				return (
					<li className="text-xs" key={d.id}>
						<div className="space-y-1">
							<Link
								className={linkClass}
								state={{ chatWorkspace: cw }}
								to={threadHref}
							>
								<span className={titleClass}>{d.label}</span>
								<span className={metaClass}>
									{(() => {
										const share =
											typeof d.my_share === "number" ? d.my_share : d.total;
										const diff = Math.abs(share - d.total);
										return (
											<>
												{formatCurrencyAmount(share, d.currency || currency)}
												{diff > 0.005 ? (
													<>
														{" "}
														(your share; total{" "}
														{formatCurrencyAmount(
															d.total,
															d.currency || currency,
														)}
														)
													</>
												) : null}
												{d.space_name ? ` · ${d.space_name}` : ""} · updated{" "}
												{formatDateLabel(d.updated_at)}
											</>
										);
									})()}
								</span>
							</Link>
							{ceitsEditUrl ? (
								<a
									className="inline-flex px-3 text-[10px] font-medium text-primary underline-offset-2 hover:underline"
									href={ceitsEditUrl}
									rel="noopener noreferrer"
									target="_blank"
								>
									Open in Ceits app
								</a>
							) : null}
						</div>
					</li>
				);
			})}
		</ul>
	);
};

const WidgetShell = ({
	widgetKey,
	className = "",
	titleOverride,
	descriptionOverride,
	emptyCopyOverride,
	state,
	errorCopy,
	loadingLabel,
	contentClassName,
	shellVariant = "default",
	children,
}: {
	widgetKey: DashboardWidgetId;
	className?: string;
	titleOverride?: string;
	descriptionOverride?: string;
	emptyCopyOverride?: string;
	state: DashboardWidgetState;
	errorCopy?: string;
	loadingLabel?: string;
	contentClassName?: string;
	shellVariant?: "default" | "darkMuted";
	children?: ReactNode;
}) => {
	const { variant: dashboardVariant } = useDashboardVariant();
	const base =
		dashboardVariant === "personal" && widgetKey === "tenant_people"
			? {
					...dashboardWidgetCopy.tenant_people,
					title: "People in your workspace",
					description:
						"You and anyone sharing this personal tenant (for example family you invited).",
				}
			: dashboardWidgetCopy[widgetKey];
	const title = titleOverride ?? base.title;
	const description = descriptionOverride ?? base.description;
	const emptyCopy = emptyCopyOverride ?? base.emptyCopy;

	const isQuickCapture = widgetKey === "quick_capture";
	const widgetClassName = [
		className,
		isQuickCapture
			? "!rounded-[0.875rem] !border-0 !bg-transparent !p-4 !shadow-none !gap-2 [&_header]:space-y-0 [&_h2]:text-[13px] [&_h2]:leading-snug"
			: "",
	]
		.join(" ")
		.trim();
	const resolvedContentClassName =
		contentClassName ?? (isQuickCapture ? "min-h-0 flex-1 text-sm" : undefined);

	return (
		<DashboardWidget
			className={widgetClassName}
			contentClassName={resolvedContentClassName}
			description={description}
			emptyCopy={emptyCopy}
			errorCopy={errorCopy}
			loadingLabel={loadingLabel}
			state={state}
			title={title}
			variant={shellVariant}
			widgetId={widgetKey}
		>
			{children}
		</DashboardWidget>
	);
};

const DashboardBody = ({
	intentBanner,
	onDismissIntent,
}: {
	intentBanner: string | null;
	onDismissIntent: () => void;
}) => {
	const { user } = useAuth();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();
	const dashboardSpaceUrlBootstrappedRef = useRef(false);
	const {
		spaces: workspaceSpaces,
		selectedSpaceId: workspaceSelectedSpaceId,
		setSelectedSpaceId,
		loadError: workspaceLoadError,
	} = useWorkspaceSpaces();

	const workspaceSpaceIdNumeric = useMemo((): number | null => {
		if (workspaceSelectedSpaceId == null) return null;
		const n = Number(workspaceSelectedSpaceId);
		return Number.isFinite(n) ? n : null;
	}, [workspaceSelectedSpaceId]);

	/** Personal-tenant spaces only (aligned with Chat) — shared with workspace sidebar. */
	const accessibleSpaces = workspaceSpaces;

	const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(
		null,
	);
	const [dashboardLoading, setDashboardLoading] = useState(false);
	const [dashboardError, setDashboardError] = useState<string | null>(null);

	const utcTodayIso = useCallback(() => {
		const n = new Date();
		return new Date(
			Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
		)
			.toISOString()
			.slice(0, 10);
	}, []);

	const [spendPeriodKind, setSpendPeriodKind] = useState<
		"day" | "month" | "year"
	>("month");
	const [spendAnchor, setSpendAnchor] = useState<string>(() => {
		const n = new Date();
		return new Date(
			Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()),
		)
			.toISOString()
			.slice(0, 10);
	});

	const [heroSelectedSpaceId, setHeroSelectedSpaceId] = useState<number | null>(
		null,
	);

	/** Keep Chat scope aligned with personal dashboard context. */
	useEffect(() => {
		if (dashboardData?.context?.variant !== "personal") return;
		const tid = dashboardData.context.tenant_id;
		if (tid == null || !Number.isFinite(Number(tid))) return;
		writeChatWorkspaceScope({
			kind: "personal",
			tenantId: Number(tid),
			label: "Personal",
		});
		notifyWorkspaceNavUpdated();
	}, [dashboardData?.context?.variant, dashboardData?.context?.tenant_id]);

	const pageLoading =
		dashboardLoading ||
		(Boolean(dashboardData?.context?.tenant_id) &&
			accessibleSpaces === null &&
			!workspaceLoadError);

	const pageError = workspaceLoadError ?? dashboardError ?? null;

	const currency = dashboardData?.context?.currency ?? "USD";

	useEffect(() => {
		let cancelled = false;
		setDashboardLoading(true);
		setDashboardError(null);
		void (async () => {
			try {
				const res = await apiClient.dashboard.get({
					variant: "personal",
					period: spendPeriodKind,
					on: spendAnchor,
					...(heroSelectedSpaceId != null
						? { space_id: heroSelectedSpaceId }
						: {}),
				});
				if (!cancelled) {
					setDashboardData(res);
					setDashboardError(null);
				}
			} catch (e) {
				if (!cancelled) {
					setDashboardData(null);
					setDashboardError(
						e instanceof Error ? e.message : "Failed to load dashboard",
					);
				}
			} finally {
				if (!cancelled) setDashboardLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [spendPeriodKind, spendAnchor, heroSelectedSpaceId]);

	const qc = dashboardData?.quick_capture;
	const cont = dashboardData?.continue;
	const spacesRows = dashboardData?.spaces ?? null;
	const monthly = dashboardData?.monthly_snapshot ?? null;
	const recurring = dashboardData?.recurring_upcoming ?? null;
	const pendingDrafts = dashboardData?.pending_drafts ?? null;
	const recentTx = dashboardData?.recent_transactions ?? null;
	const reviewQ = dashboardData?.review_queue ?? null;

	/** Spaces in the personal tenant only. */
	const dashboardScopedSpaces = useMemo((): Space[] | null => {
		if (accessibleSpaces === null) return null;
		const tid = dashboardData?.context?.tenant_id;
		if (tid == null || !Number.isFinite(Number(tid))) return null;
		const pt = Number(tid);
		return accessibleSpaces.filter((s) => Number(s.tenant_id) === pt);
	}, [accessibleSpaces, dashboardData?.context?.tenant_id]);

	const handleSpendPeriodKind = useCallback((k: SpendPeriodKindUI) => {
		setSpendPeriodKind(k);
		setSpendAnchor((prev) => normalizeSpendAnchor(prev, k));
	}, []);

	const handleSpendNav = useCallback(
		(dir: -1 | 1) => {
			setSpendAnchor((prev) => bumpSpendAnchor(prev, spendPeriodKind, dir));
		},
		[spendPeriodKind],
	);

	const handleSpendToday = useCallback(() => {
		setSpendAnchor(utcTodayIso());
	}, [utcTodayIso]);

	const chatWorkspaceForNav = useMemo((): ChatWorkspaceScope | null => {
		if (!dashboardData?.context) return null;
		return {
			kind: "personal",
			tenantId: dashboardData.context.tenant_id,
			label: "Personal",
		};
	}, [dashboardData?.context]);

	const chatWorkspaceForSpace = useCallback(
		(_spaceTenantId: number, _spaceTenantName?: string): ChatWorkspaceScope => {
			const personalTid = dashboardData?.context?.tenant_id;
			return {
				kind: "personal",
				tenantId: Number(personalTid ?? 0),
				label: "Personal",
			};
		},
		[dashboardData?.context?.tenant_id],
	);

	const continueNavigableSpaces = useMemo((): {
		id: number;
		name: string;
	}[] => {
		if (dashboardScopedSpaces != null && dashboardScopedSpaces.length > 0) {
			return orderSpacesByRecent(
				dashboardScopedSpaces.map((s) => ({
					id: Number(s.id),
					name: String(s.name ?? ""),
				})),
			);
		}
		if (!cont) return [];
		const tenantId =
			chatWorkspaceForNav?.tenantId ??
			dashboardData?.context?.tenant_id ??
			null;
		const byId = new Map<number, { id: number; name: string }>();
		byId.set(cont.space_id, { id: cont.space_id, name: cont.space_name });
		if (tenantId != null && Number.isFinite(Number(tenantId))) {
			const tid = Number(tenantId);
			for (const s of spacesRows ?? []) {
				if (Number(s.tenant_id) === tid) {
					byId.set(s.id, { id: s.id, name: s.name });
				}
			}
			for (const s of qc?.spaces ?? []) {
				if (Number(s.tenant_id) === tid && !byId.has(s.id)) {
					byId.set(s.id, { id: s.id, name: s.name });
				}
			}
		}
		return orderSpacesByRecent([...byId.values()]);
	}, [
		dashboardScopedSpaces,
		cont,
		dashboardData?.context?.tenant_id,
		chatWorkspaceForNav?.tenantId,
		qc?.spaces,
		spacesRows,
	]);

	const heroQuickCapture = useMemo(():
		| DashboardResponse["quick_capture"]
		| null => {
		if (!qc) return null;
		if (dashboardScopedSpaces != null && dashboardScopedSpaces.length > 0) {
			const defaultId = Number(qc.default_space_id);
			const stillThere = dashboardScopedSpaces.some(
				(s) => Number(s.id) === defaultId,
			);
			const def = stillThere ? defaultId : Number(dashboardScopedSpaces[0].id);
			return {
				default_space_id: def,
				spaces: dashboardScopedSpaces.map((s) => ({
					id: Number(s.id),
					name: String(s.name ?? ""),
					tenant_id: Number(s.tenant_id),
					description: (s.description ?? "").trim() || undefined,
				})),
			};
		}
		return qc;
	}, [qc, dashboardScopedSpaces]);

	const heroContextSpaces = useMemo((): HeroContextSpace[] => {
		if (dashboardScopedSpaces != null && dashboardScopedSpaces.length > 0) {
			const sorted = sortSpacesByLastActivity(dashboardScopedSpaces);
			return sorted.map((s) => ({
				id: Number(s.id),
				name: String(s.name ?? ""),
				description: (s.description ?? "").trim() || undefined,
				tenantName: s.tenant_name?.trim() || undefined,
				ownerUserId:
					s.owner_user_id != null ? Number(s.owner_user_id) : undefined,
				ownerDisplayName: s.owner_display_name?.trim() || undefined,
			}));
		}
		if (!qc?.spaces?.length) {
			return continueNavigableSpaces.map((s) => ({ ...s }));
		}
		const byActivity = new Map<number, number>();
		for (const row of spacesRows ?? []) {
			const ts = row.last_activity_at
				? Date.parse(row.last_activity_at)
				: Number.NaN;
			if (Number.isFinite(ts)) byActivity.set(row.id, ts);
		}
		const base = qc.spaces.map((s) => ({
			id: s.id,
			name: s.name,
			description: (s.description ?? "").trim() || undefined,
		}));
		const sorted = [...base].sort((a, b) => {
			const ta = byActivity.get(a.id) ?? -1;
			const tb = byActivity.get(b.id) ?? -1;
			return tb - ta;
		});
		return sorted;
	}, [dashboardScopedSpaces, continueNavigableSpaces, qc?.spaces, spacesRows]);

	/** Reset deep-link bootstrap when leaving the dashboard route. */
	useEffect(() => {
		if (!location.pathname.startsWith("/console/dashboard")) {
			dashboardSpaceUrlBootstrappedRef.current = false;
		}
	}, [location.pathname]);

	useEffect(() => {
		if (!heroContextSpaces.length) {
			setHeroSelectedSpaceId(null);
			return;
		}

		const inList = (id: number | null) =>
			id != null && heroContextSpaces.some((s) => Number(s.id) === Number(id));

		const raw = searchParams.get("spaceId");
		const urlN = raw != null && raw !== "" ? Number(raw) : Number.NaN;
		const urlValid = Number.isFinite(urlN) && inList(urlN);

		const wsN =
			workspaceSpaceIdNumeric != null &&
			Number.isFinite(Number(workspaceSpaceIdNumeric))
				? Number(workspaceSpaceIdNumeric)
				: null;
		const wsValid = wsN != null && inList(wsN);

		/** Apply `?spaceId=` once per dashboard visit so deep links win before workspace defaults. */
		if (urlValid && !dashboardSpaceUrlBootstrappedRef.current) {
			dashboardSpaceUrlBootstrappedRef.current = true;
			setHeroSelectedSpaceId(urlN);
			if (wsN !== urlN) {
				setSelectedSpaceId(urlN);
			}
			return;
		}

		/** Sidebar / workspace context is authoritative after bootstrap (avoids stale URL fighting clicks). */
		if (wsValid) {
			setHeroSelectedSpaceId(wsN);
			return;
		}

		if (urlValid) {
			setHeroSelectedSpaceId(urlN);
			setSelectedSpaceId(urlN);
			return;
		}

		setHeroSelectedSpaceId((prev) => {
			const p = prev != null ? Number(prev) : null;
			if (p != null && inList(p)) return p;
			return Number(heroContextSpaces[0].id);
		});
	}, [
		heroContextSpaces,
		searchParams,
		setSelectedSpaceId,
		workspaceSpaceIdNumeric,
	]);

	/** Keep ?spaceId= aligned with the hero space (functional update avoids churn with `searchParams` identity). */
	useEffect(() => {
		if (heroSelectedSpaceId == null) return;
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (next.get("spaceId") === String(heroSelectedSpaceId)) {
					return prev;
				}
				next.set("spaceId", String(heroSelectedSpaceId));
				return next;
			},
			{ replace: true },
		);
	}, [heroSelectedSpaceId, setSearchParams]);

	const heroSpaceTitle = useMemo(() => {
		if (heroSelectedSpaceId == null) return null;
		const row = heroContextSpaces.find((s) => s.id === heroSelectedSpaceId);
		return row?.name?.trim() ?? null;
	}, [heroContextSpaces, heroSelectedSpaceId]);

	useConsoleHeaderTitle("Overview", heroSpaceTitle);

	const spendScopeHint = useMemo(() => {
		if (heroSelectedSpaceId != null && heroSpaceTitle) {
			return `Totals and capture follow “${heroSpaceTitle}”. Matches the space selected in the sidebar.`;
		}
		return "Choose a space to focus spend, recurring items, and capture — sidebar selection stays in sync.";
	}, [heroSelectedSpaceId, heroSpaceTitle]);

	const recurringForHero = useMemo(() => {
		const list = recurring ?? [];
		if (heroSelectedSpaceId == null) return list.slice(0, 5);
		return list
			.filter(
				(r) =>
					r.space_id == null ||
					Number(r.space_id) === Number(heroSelectedSpaceId),
			)
			.slice(0, 5);
	}, [recurring, heroSelectedSpaceId]);

	const recurringFilteredForSpace = useMemo(() => {
		const list = recurring ?? [];
		if (heroSelectedSpaceId == null) return list;
		return list.filter(
			(r) =>
				r.space_id == null ||
				Number(r.space_id) === Number(heroSelectedSpaceId),
		);
	}, [recurring, heroSelectedSpaceId]);

	/** Hero drafts column: only drafts for the shared space context. */
	const pendingDraftsForHeroSpace = useMemo(() => {
		if (!pendingDrafts?.length) return [];
		if (heroSelectedSpaceId == null) return [];
		return pendingDrafts.filter(
			(d) => Number(d.space_id) === Number(heroSelectedSpaceId),
		);
	}, [pendingDrafts, heroSelectedSpaceId]);

	const draftsHeroDescription = useMemo(() => {
		if (heroSelectedSpaceId == null) {
			return "Choose a space in the bar above to filter drafts.";
		}
		const name = heroContextSpaces.find(
			(s) => s.id === heroSelectedSpaceId,
		)?.name;
		return name
			? `Showing drafts in ${name} only. Tap to open the thread.`
			: "Drafts for the selected space. Tap to open the thread.";
	}, [heroContextSpaces, heroSelectedSpaceId]);

	const draftsHeroEmptyCopy = useMemo(() => {
		if (heroSelectedSpaceId == null) {
			return "Select a space above to see its drafts.";
		}
		return "No drafts in this space. Capture from chat or switch space.";
	}, [heroSelectedSpaceId]);

	const reviewQForSpace = useMemo(() => {
		if (!reviewQ) return null;
		if (heroSelectedSpaceId == null) return reviewQ;
		const items = reviewQ.items.filter((it) => {
			if (it && typeof it === "object" && "space_id" in it) {
				return (
					Number((it as { space_id: number }).space_id) ===
					Number(heroSelectedSpaceId)
				);
			}
			return false;
		});
		return { ...reviewQ, items, total_count: items.length };
	}, [reviewQ, heroSelectedSpaceId]);

	const recentTxForSpace = useMemo(() => {
		if (!recentTx?.length) return recentTx;
		if (heroSelectedSpaceId == null) return recentTx;
		return recentTx.filter(
			(t) => Number(t.space_id) === Number(heroSelectedSpaceId),
		);
	}, [recentTx, heroSelectedSpaceId]);

	const resolvePendingDraftChatWorkspace = useCallback(
		(d: { tenant_id: number }): ChatWorkspaceScope => ({
			kind: "personal",
			tenantId: d.tenant_id,
			label: "Personal",
		}),
		[],
	);

	const chatNavState = useCallback(
		(extra: Record<string, unknown>) =>
			chatWorkspaceForNav
				? { chatWorkspace: chatWorkspaceForNav, ...extra }
				: extra,
		[chatWorkspaceForNav],
	);

	const sharedErrorCopy =
		pageError ?? "Something went wrong loading this section.";

	const spacesForGrid = useMemo((): SpaceGridItem[] => {
		if (dashboardScopedSpaces != null && dashboardScopedSpaces.length > 0) {
			return dashboardScopedSpaces.map((s) => ({
				id: Number(s.id),
				name: String(s.name ?? ""),
				tenant_id: Number(s.tenant_id),
				last_activity_at: s.last_activity_at,
				member_count: undefined,
				period_spent_preview: undefined,
				owner_user_id:
					s.owner_user_id != null ? Number(s.owner_user_id) : undefined,
				tenant_name: s.tenant_name,
				owner_display_name: s.owner_display_name,
			}));
		}
		return (spacesRows ?? []).map((row) => ({
			id: row.id,
			name: row.name,
			tenant_id: row.tenant_id,
			last_activity_at: row.last_activity_at,
			member_count: row.member_count,
			period_spent_preview: row.period_spent_preview,
			draft_my_share_preview: row.draft_my_share_preview,
			owner_user_id: undefined,
			tenant_name: undefined,
			owner_display_name: undefined,
		}));
	}, [dashboardScopedSpaces, spacesRows]);

	const spacesForGridScoped = useMemo(() => {
		if (heroSelectedSpaceId == null) return spacesForGrid;
		const match = spacesForGrid.filter((s) => s.id === heroSelectedSpaceId);
		return match.length > 0 ? match : spacesForGrid;
	}, [spacesForGrid, heroSelectedSpaceId]);

	const spaceGridOwnershipLine = (
		s: Pick<SpaceGridItem, "owner_user_id" | "owner_display_name">,
		uid: number | undefined,
	): string => {
		if (uid != null && s.owner_user_id === uid) return "Yours";
		if (s.owner_display_name?.trim()) {
			return `Owner: ${s.owner_display_name.trim()}`;
		}
		return "Shared space";
	};

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<WorkspaceSpaceSubNav />
				<p className="mt-3 text-sm text-[hsl(var(--text-secondary))]">
					Personal Ceits workspace.{" "}
					<Link
						className="font-medium text-[hsl(var(--accent))] underline underline-offset-2"
						to="/console/account"
					>
						Account
					</Link>
					.
				</p>
			</header>

			<div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
				{intentBanner ? (
					<output
						aria-live="polite"
						className="mx-4 mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))] p-4 text-sm lg:mx-8"
					>
						<p className="min-w-0 flex-1 text-[hsl(var(--text-secondary))]">
							{intentBanner}
						</p>
						<button
							className="shrink-0 rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] px-3 py-1 text-xs font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							onClick={onDismissIntent}
							type="button"
						>
							Dismiss
						</button>
					</output>
				) : null}

				<div className="px-4 pt-4 lg:px-8">
					<DashboardOverviewMetricsRow
						currency={currency}
						formatCurrencyAmount={formatCurrencyAmount}
						monthly={monthly}
						pageLoading={pageLoading}
						pendingDrafts={
							heroSelectedSpaceId != null
								? pendingDraftsForHeroSpace
								: (pendingDrafts ?? [])
						}
						recurring={
							heroSelectedSpaceId != null
								? recurringFilteredForSpace
								: (recurring ?? [])
						}
						reviewQ={reviewQForSpace}
					/>
				</div>

				<div className={sectionRhythm}>
					<motion.div
						animate="visible"
						className=""
						initial="hidden"
						variants={fadeUpVariants}
					>
						<div className="px-4 lg:px-8">
							<div className="space-y-5">
								<div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch">
									<div
										className={`${dashboardHeroCardClass} min-h-0`}
										id="dashboard-capture"
									>
										<div className="p-3 sm:p-4">
											<WidgetShell
												className="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none [&_header]:mb-1.5"
												contentClassName="min-h-0 flex-1 text-sm"
												errorCopy={sharedErrorCopy}
												state={deriveWidgetState(
													pageLoading,
													pageError,
													Boolean(
														heroQuickCapture &&
															heroQuickCapture.spaces.length > 0,
													),
												)}
												widgetKey="quick_capture"
											>
												{heroQuickCapture &&
												heroQuickCapture.spaces.length > 0 ? (
													<QuickCaptureWidget
														chatWorkspace={chatWorkspaceForNav}
														qc={heroQuickCapture}
														selectedSpaceId={heroSelectedSpaceId}
														showSpacePicker={false}
														visualVariant="heroCard"
													/>
												) : null}
											</WidgetShell>
										</div>
									</div>
									<div
										className={`${dashboardHeroCardClass} flex min-h-[12rem] flex-col lg:h-full lg:min-h-0 lg:max-h-[min(32rem,78vh)]`}
									>
										<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
											<WidgetShell
												className="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none"
												contentClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1"
												descriptionOverride={draftsHeroDescription}
												emptyCopyOverride={draftsHeroEmptyCopy}
												errorCopy={sharedErrorCopy}
												state={deriveWidgetState(
													pageLoading,
													pageError,
													pendingDraftsForHeroSpace.length > 0,
												)}
												titleOverride="Drafts awaiting review"
												shellVariant="default"
												widgetKey="pending_drafts"
											>
												{pendingDraftsForHeroSpace.length > 0 ? (
													<PendingDraftsList
														currency={currency}
														items={pendingDraftsForHeroSpace}
														resolveChatWorkspace={
															resolvePendingDraftChatWorkspace
														}
													/>
												) : null}
											</WidgetShell>
										</div>
									</div>
								</div>

								{heroSelectedSpaceId != null && chatWorkspaceForNav ? (
									<div className={dashboardHeroCardClass}>
										<motion.div
											animate="visible"
											className="flex flex-wrap gap-2 bg-muted/30 px-4 py-3 sm:px-5"
											initial="hidden"
											variants={staggerContainer}
										>
											<motion.div variants={staggerItem}>
												<MotionLink
													className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
													onClick={() =>
														setSelectedSpaceId(heroSelectedSpaceId)
													}
													state={chatNavState({
														selectSpaceId: heroSelectedSpaceId,
													})}
													to="/console/chat"
												>
													Open chat
												</MotionLink>
											</motion.div>
											<motion.div variants={staggerItem}>
												<a
													className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
													href="#dashboard-capture"
												>
													Voice & photo
												</a>
											</motion.div>
											<motion.div variants={staggerItem}>
												<MotionLink
													className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
													onClick={() =>
														setSelectedSpaceId(heroSelectedSpaceId)
													}
													to="/console/drafts"
												>
													Drafts
												</MotionLink>
											</motion.div>
											<motion.div variants={staggerItem}>
												<MotionLink
													className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
													onClick={() =>
														setSelectedSpaceId(heroSelectedSpaceId)
													}
													to="/console/recurring"
												>
													Recurring
												</MotionLink>
											</motion.div>
											<motion.div variants={staggerItem}>
												<MotionLink
													className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]"
													onClick={() =>
														setSelectedSpaceId(heroSelectedSpaceId)
													}
													to="/console/transactions"
												>
													Transactions
												</MotionLink>
											</motion.div>
										</motion.div>
									</div>
								) : null}
								{monthly ? (
									<div className={dashboardHeroCardClass}>
										<SpendCoverBand
											currency={currency}
											monthly={monthly}
											onNav={handleSpendNav}
											onPeriodKind={handleSpendPeriodKind}
											onToday={handleSpendToday}
											scopeHint={spendScopeHint}
											spendAnchor={spendAnchor}
											spendPeriodKind={spendPeriodKind}
											standaloneCard
											tone="light"
										/>
									</div>
								) : null}
								{recurringForHero.length > 0 ? (
									<div className={dashboardHeroCardClass}>
										<div className="bg-muted/15 px-4 py-4 sm:px-5">
											<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
												Upcoming recurring
												{heroSpaceTitle ? ` · ${heroSpaceTitle}` : ""}
											</p>
											<ul className="mt-2 space-y-2">
												{recurringForHero.map((r) => (
													<li
														className="flex flex-col gap-0.5 rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-xs"
														key={`${r.id}-${r.next_due}`}
													>
														<span className="font-medium text-foreground">
															{r.name}
														</span>
														<span className="text-muted-foreground">
															{formatCurrencyAmount(r.amount, currency)} · due{" "}
															{formatDateLabel(r.next_due)}
															{r.space_name ? ` · ${r.space_name}` : ""}
														</span>
													</li>
												))}
											</ul>
										</div>
									</div>
								) : null}

								<div className={dashboardHeroCardClass}>
									<div className="p-4 sm:p-5">
										<WidgetShell
											className="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none"
											contentClassName="min-h-0"
											errorCopy={sharedErrorCopy}
											state={deriveWidgetState(
												pageLoading,
												pageError,
												Boolean(cont),
											)}
											widgetKey="continue"
										>
											{cont ? (
												<ContinueDashboardPanel
													chatNavState={chatNavState}
													chatWorkspace={chatWorkspaceForNav}
													cont={cont}
													navigableSpaces={continueNavigableSpaces}
													selectedSpaceId={heroSelectedSpaceId}
													showDraftsButton={false}
													showFooterActions={false}
													showInlineSpaceNav={false}
													visualVariant="default"
												/>
											) : null}
										</WidgetShell>
									</div>
								</div>
							</div>
						</div>
					</motion.div>

					<div className="mt-2 grid grid-cols-1 gap-5 px-4 lg:grid-cols-12 lg:items-stretch lg:px-8">
						<WidgetShell
							className="lg:col-span-6 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(
									monthly &&
										((typeof monthly.total_my_share === "number" &&
											monthly.total_my_share > 0) ||
											monthly.total_spent > 0 ||
											(monthly.top_spaces && monthly.top_spaces.length > 0)),
								),
							)}
							widgetKey="monthly_snapshot"
						>
							{monthly ? (
								<MonthlySnapshotChart
									currency={currency}
									monthly={monthly}
									pendingDrafts={
										heroSelectedSpaceId != null
											? pendingDraftsForHeroSpace
											: pendingDrafts
									}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-6 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(
									recurringFilteredForSpace &&
										recurringFilteredForSpace.length > 0,
								),
							)}
							widgetKey="recurring_upcoming"
						>
							<ul className="space-y-2">
								{recurringFilteredForSpace?.map((r) => (
									<li
										className="flex flex-col gap-0.5 rounded-lg border border-[hsl(var(--border-subtle))]/90 bg-[hsl(var(--surface-muted))]/45 px-3 py-2.5 text-xs shadow-sm"
										key={r.id}
									>
										<span className="font-medium">{r.name}</span>
										<span className="text-[hsl(var(--text-secondary))]">
											{formatCurrencyAmount(r.amount, currency)} · due{" "}
											{formatDateLabel(r.next_due)} · {r.space_name}
										</span>
									</li>
								))}
							</ul>
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-12 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(dashboardData?.context?.tenant_id),
							)}
							widgetKey="tenant_people"
						>
							<TenantPeoplePanel
								currentUserId={user?.id}
								tenantId={
									dashboardData?.context?.tenant_id != null
										? Number(dashboardData.context.tenant_id)
										: null
								}
							/>
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-12 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(
									reviewQForSpace &&
										(reviewQForSpace.items.length > 0 ||
											reviewQForSpace.total_count > 0),
								),
							)}
							widgetKey="review_queue"
						>
							{reviewQForSpace ? (
								<ReviewQueuePanel
									chatNavState={chatNavState}
									currency={currency}
									formatCurrencyAmount={formatCurrencyAmount}
									formatDateLabel={formatDateLabel}
									queue={reviewQForSpace}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-12 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								spacesForGridScoped.length > 0,
							)}
							widgetKey="spaces"
						>
							<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{spacesForGridScoped.map((s) => (
									<li key={s.id}>
										<Link
											className="flex h-full min-h-[5rem] flex-col rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/60 p-3 text-left transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
											state={{
												chatWorkspace: chatWorkspaceForSpace(
													s.tenant_id,
													s.tenant_name,
												),
												selectSpaceId: s.id,
											}}
											to="/console/chat"
										>
											<span className="font-medium">{s.name}</span>
											<div className="mt-1.5 flex flex-wrap gap-1">
												{s.tenant_name?.trim() ? (
													<span className="inline-flex max-w-full truncate rounded-md bg-[hsl(var(--surface))]/80 px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--text-secondary))]">
														{s.tenant_name.trim()}
													</span>
												) : null}
												<span className="inline-flex rounded-md border border-[hsl(var(--border-subtle))] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--text-secondary))]">
													{spaceGridOwnershipLine(s, user?.id)}
												</span>
											</div>
											{s.last_activity_at ? (
												<span className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
													Activity {formatDateLabel(s.last_activity_at)}
												</span>
											) : null}
											{s.member_count != null ? (
												<span className="text-xs text-[hsl(var(--text-secondary))]">
													{s.member_count} members
												</span>
											) : null}
											{(s.period_spent_preview ?? 0) > 0.005 ||
											(s.draft_my_share_preview ?? 0) > 0.005 ? (
												<span className="mt-1 flex flex-col gap-0.5 text-xs text-[hsl(var(--text-secondary))]">
													{(s.period_spent_preview ?? 0) > 0.005 ? (
														<span>
															{formatCurrencyAmount(
																s.period_spent_preview ?? 0,
																currency,
															)}{" "}
															confirmed (your share, this month)
														</span>
													) : null}
													{(s.draft_my_share_preview ?? 0) > 0.005 ? (
														<span>
															{formatCurrencyAmount(
																s.draft_my_share_preview ?? 0,
																currency,
															)}{" "}
															in drafts (your share)
														</span>
													) : null}
												</span>
											) : null}
										</Link>
									</li>
								))}
							</ul>
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-12 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(recentTxForSpace && recentTxForSpace.length > 0),
							)}
							widgetKey="recent_transactions"
						>
							<ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
								{recentTxForSpace?.map((t) => (
									<li className="text-xs" key={t.id}>
										<Link
											className="flex flex-col rounded-lg border border-[hsl(var(--border-subtle))]/90 bg-[hsl(var(--surface-muted))]/35 px-3 py-2 transition hover:bg-[hsl(var(--surface-muted))]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
											state={
												chatWorkspaceForNav
													? { chatWorkspace: chatWorkspaceForNav }
													: undefined
											}
											to={`/console/chat/thread?spaceId=${encodeURIComponent(String(t.space_id))}&expenseId=${encodeURIComponent(String(t.id))}`}
										>
											<span className="font-medium text-[hsl(var(--text-primary))]">
												{t.label} ·{" "}
												{formatCurrencyAmount(t.amount, t.currency || currency)}
											</span>
											<span className="text-[hsl(var(--text-secondary))]">
												{t.space_name} · {formatDateLabel(t.occurred_at)} ·{" "}
												{t.status}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</WidgetShell>
					</div>
				</div>
				<div className="mt-10 grid grid-cols-1 gap-6 px-4 lg:px-8">
					<WidgetShell state="empty" widgetKey="ai_teaser" />
				</div>
			</div>
		</div>
	);
};

export const DashboardPage = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [intentBanner, setIntentBanner] = useState<string | null>(null);

	useEffect(() => {
		const welcome = searchParams.get("welcome");
		if (welcome !== "1") return;

		const next = new URLSearchParams(searchParams);
		next.delete("welcome");
		setSearchParams(next, { replace: true });

		const intent = readOnboardingIntent();
		if (!intent) return;

		setIntentBanner(
			intent === "business"
				? "You started from the business and teams path — Quota and Spaces are available from this overview when you are ready."
				: "You started from the personal and family path — shared spaces and splits work great from Spaces and Chat.",
		);
	}, [searchParams, setSearchParams]);

	const handleDismissIntent = () => {
		setIntentBanner(null);
		clearOnboardingIntent();
	};

	return (
		<DashboardVariantProvider variant="personal">
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<DashboardBody
						intentBanner={intentBanner}
						onDismissIntent={handleDismissIntent}
					/>
				</div>
			</div>
		</DashboardVariantProvider>
	);
};
