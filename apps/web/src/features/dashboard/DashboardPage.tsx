import type { DashboardResponse, Space, Tenant } from "@cofi/api";
import { isDashboardVariant } from "@cofi/api";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
	apiClient,
	readActiveOrgTenantId,
	writeActiveOrgTenantId,
} from "../../shared/lib/apiClient";
import { ceitsSpaceExpenseEditUrl } from "../../shared/lib/ceitsAppUrls";
import {
	type ChatWorkspaceScope,
	readChatWorkspaceScope,
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
import { isNonPersonalTenantType } from "../../shared/lib/tenantTypes";
import { WORKSPACE_NAV_UPDATED_EVENT } from "../../shared/lib/workspaceNavEvents";
import {
	DashboardVariantProvider,
	useDashboardVariant,
} from "./DashboardVariantContext";
import {
	OrgSnapshotPanel,
	RecentActivityPanel,
	ReviewQueuePanel,
	SpendByTagPanel,
	normalizeActivityItems,
} from "./components/BusinessDashboardPanels";
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

/** Full-bleed band so quick capture + continue align to max width but sit off the default grid. */
const dashboardCaptureHeroBandClass =
	"relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen max-w-[100vw] border-b border-[hsl(var(--border-subtle))]/50 bg-gradient-to-b from-[hsl(var(--surface-muted))]/35 to-transparent py-6";

const dashboardCaptureHeroInnerClass =
	"mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 lg:grid-cols-12 lg:items-stretch";

const uniqueTenantIds = (spaces: Space[]): number[] => {
	const seen = new Set<number>();
	for (const s of spaces) {
		const tid = Number(s.tenant_id);
		if (Number.isFinite(tid)) seen.add(tid);
	}
	return [...seen].sort((a, b) => a - b);
};

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
}: {
	monthly: NonNullable<DashboardResponse["monthly_snapshot"]>;
	currency: string;
	scopeHint: string;
	spendPeriodKind: SpendPeriodKindUI;
	spendAnchor: string;
	onPeriodKind: (k: SpendPeriodKindUI) => void;
	onNav: (dir: -1 | 1) => void;
	onToday: () => void;
}): ReactNode => {
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
	return (
		<div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-amber-500/15 via-zinc-900/80 to-zinc-950 px-4 py-5 sm:px-5">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.12),_transparent_55%)]"
			/>
			<div className="relative space-y-4">
				<div className="space-y-1">
					<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
						Your expenses · your share
					</p>
					<p className="text-xs text-zinc-400">{scopeHint}</p>
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
								"rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50",
								spendPeriodKind === k
									? "bg-white/15 text-zinc-50 shadow-sm"
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
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
							onClick={() => onNav(-1)}
							type="button"
						>
							‹
						</button>
						<button
							aria-label="Next period"
							className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
							onClick={() => onNav(1)}
							type="button"
						>
							›
						</button>
						<button
							className="ml-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-amber-200/90 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
							onClick={onToday}
							type="button"
						>
							Today
						</button>
					</div>
					<p className="min-w-0 text-right text-sm font-medium text-zinc-300">
						{formatSpendPeriodLabel(
							(monthly.anchor_date ?? spendAnchor).trim() || spendAnchor,
							spendPeriodKind,
						)}
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
						<p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
							Total (
							{spendPeriodKind === "day"
								? "day"
								: spendPeriodKind === "month"
									? "month"
									: "year"}
							)
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">
							{formatCurrencyAmount(share, currency)}
						</p>
						<p className="mt-1 text-[11px] text-zinc-500">
							{formatDateLabel(monthly.period.start)} –{" "}
							{formatDateLabel(monthly.period.end)}
						</p>
					</div>
					<div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3">
						<p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/80">
							In {spaceTitle}
						</p>
						<p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-50">
							{formatCurrencyAmount(inSpace, currency)}
						</p>
						<p className="mt-1 text-[11px] text-zinc-500">
							Same period · space below
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

const BURGUNDY_MUTED = "text-[#7c2d3a] dark:text-[#c97b88]";

const spaceOwnershipLine = (
	s: Pick<HeroContextSpace, "ownerUserId" | "ownerDisplayName">,
	currentUserId: number | undefined,
): string => {
	if (currentUserId != null && s.ownerUserId === currentUserId) {
		return "Yours";
	}
	if (s.ownerDisplayName?.trim()) {
		return `Owner: ${s.ownerDisplayName.trim()}`;
	}
	return "Shared space";
};

const HeroSpaceContextBar = ({
	spaces,
	selectedSpaceId,
	onSelectSpaceId,
	currentUserId,
}: {
	spaces: HeroContextSpace[];
	selectedSpaceId: number | null;
	onSelectSpaceId: (spaceId: number) => void;
	currentUserId: number | undefined;
}): ReactNode => {
	if (spaces.length === 0 || selectedSpaceId == null) return null;
	const idx = Math.max(
		0,
		spaces.findIndex((s) => s.id === selectedSpaceId),
	);
	const canCycle = spaces.length > 1;
	const prevIdx = (idx - 1 + spaces.length) % spaces.length;
	const nextIdx = (idx + 1) % spaces.length;
	const prevName = spaces[prevIdx]?.name ?? "";
	const nextName = spaces[nextIdx]?.name ?? "";
	const current = spaces[idx];
	const desc = (current?.description ?? "").trim();

	return (
		<div className="relative z-[2] border-b border-white/10 px-4 py-4 sm:px-5 sm:py-5">
			<div className="flex items-start gap-3 sm:gap-5">
				<div className="flex shrink-0 flex-col items-center gap-1">
					<span className="hidden text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:block">
						Previous
					</span>
					<button
						aria-label={`Previous space: ${prevName}`}
						className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-lg text-zinc-100 shadow-sm transition hover:border-amber-400/30 hover:bg-white/10 disabled:opacity-35"
						disabled={!canCycle}
						onClick={() => {
							if (!canCycle) return;
							onSelectSpaceId(spaces[prevIdx].id);
						}}
						type="button"
					>
						←
					</button>
					<span
						className="max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-zinc-500"
						title={prevName}
					>
						{prevName}
					</span>
				</div>

				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
						Space context
					</p>
					<h2
						className="mt-1 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl"
						title={current?.name}
					>
						{current?.name}
					</h2>
					{desc ? (
						<p
							className={`mt-2 line-clamp-2 text-sm leading-snug ${BURGUNDY_MUTED}`}
						>
							{desc}
						</p>
					) : (
						<p className="mt-2 text-xs leading-relaxed text-zinc-500">
							Add a short description in space settings so everyone remembers
							why this space exists.
						</p>
					)}
					<div className="mt-2 flex flex-wrap gap-1.5">
						{current?.tenantName?.trim() ? (
							<span className="inline-flex max-w-full truncate rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
								{current.tenantName.trim()}
							</span>
						) : null}
						<span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200/95">
							{spaceOwnershipLine(
								{
									ownerUserId: current?.ownerUserId,
									ownerDisplayName: current?.ownerDisplayName,
								},
								currentUserId,
							)}
						</span>
					</div>
				</div>

				<div className="flex shrink-0 flex-col items-center gap-1">
					<span className="hidden text-[9px] font-medium uppercase tracking-wide text-zinc-500 sm:block">
						Next
					</span>
					<button
						aria-label={`Next space: ${nextName}`}
						className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-lg text-zinc-100 shadow-sm transition hover:border-amber-400/30 hover:bg-white/10 disabled:opacity-35"
						disabled={!canCycle}
						onClick={() => {
							if (!canCycle) return;
							onSelectSpaceId(spaces[nextIdx].id);
						}}
						type="button"
					>
						→
					</button>
					<span
						className="max-w-[4.5rem] truncate text-center text-[9px] leading-tight text-zinc-500"
						title={nextName}
					>
						{nextName}
					</span>
				</div>
			</div>
		</div>
	);
};

const nonPersonalTenantIdsSorted = (
	sortedIds: number[],
	meta: Record<number, Tenant | null>,
): number[] =>
	sortedIds.filter((id) => {
		const t = meta[id];
		return t != null && isNonPersonalTenantType(t.type);
	});

const tenantLabel = (
	id: number,
	meta: Record<number, Tenant | null>,
): string => {
	const t = meta[id];
	if (t?.name?.trim()) return t.name.trim();
	return `Tenant ${id}`;
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
		dashboardVariant === "business" && widgetKey === "spaces"
			? {
					...dashboardWidgetCopy.spaces,
					title: "Active spaces",
					description:
						"All spaces you can access in this account — including shared org spaces. Tags show workspace and owner.",
					emptyCopy:
						"No spaces to show yet. Create or join from Chat or Organization.",
				}
			: dashboardVariant === "business" && widgetKey === "tenant_people"
				? {
						...dashboardWidgetCopy.tenant_people,
						title: "Organization directory",
						description:
							"Members of this organization — roles and whether their email identity is verified.",
					}
				: dashboardVariant === "personal" && widgetKey === "tenant_people"
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

const DashboardMergedCaptureBlock = ({
	className = "",
	errorCopy,
	pageLoading,
	pageError,
	qc,
	cont,
	selectedSpaceId,
	navigableSpaces,
	chatNavState,
	chatWorkspace,
}: {
	className?: string;
	errorCopy: string;
	pageLoading: boolean;
	pageError: string | null;
	qc: DashboardResponse["quick_capture"];
	cont: DashboardResponse["continue"];
	selectedSpaceId: number | null;
	navigableSpaces: { id: number; name: string }[];
	chatNavState: (extra: Record<string, unknown>) => Record<string, unknown>;
	chatWorkspace: ChatWorkspaceScope | null;
}) => {
	const mergedState = deriveWidgetState(
		pageLoading,
		pageError,
		Boolean((qc && qc.spaces.length > 0) || cont),
	);
	const titleId = "dashboard-hero-pickup-title";
	return (
		<section
			aria-labelledby={titleId}
			className={["flex min-h-0 flex-col gap-4", className].join(" ")}
		>
			<header className="space-y-1">
				<h2
					className="text-lg font-semibold tracking-tight text-zinc-50"
					id={titleId}
				>
					Pick up in chat
				</h2>
				<p className="text-xs text-zinc-400">
					Capture first, then read the latest thread — all in this space.
				</p>
			</header>

			<div className="min-h-[6rem] flex-1 text-sm">
				{mergedState === "loading" ? (
					<p aria-busy="true" className="text-zinc-400">
						Loading…
					</p>
				) : null}
				{mergedState === "empty" ? (
					<p className="text-zinc-400">
						No spaces yet. Create one from Chat when you are ready.
					</p>
				) : null}
				{mergedState === "error" ? (
					<p className="text-red-400">{errorCopy}</p>
				) : null}
				{mergedState === "ready" ? (
					<div className="space-y-4 text-zinc-50">
						{qc && qc.spaces.length > 0 ? (
							<QuickCaptureWidget
								chatWorkspace={chatWorkspace}
								qc={qc}
								selectedSpaceId={selectedSpaceId}
								showSpacePicker={false}
								visualVariant="heroDark"
							/>
						) : null}
						{cont ? (
							<ContinueDashboardPanel
								chatNavState={chatNavState}
								chatWorkspace={chatWorkspace}
								cont={cont}
								navigableSpaces={navigableSpaces}
								selectedSpaceId={selectedSpaceId}
								showDraftsButton={false}
								showFooterActions={false}
								showInlineSpaceNav={false}
								visualVariant="heroLightChat"
							/>
						) : null}
					</div>
				) : null}
			</div>
		</section>
	);
};

const DashboardBody = ({
	intentBanner,
	onDismissIntent,
}: {
	intentBanner: string | null;
	onDismissIntent: () => void;
}) => {
	const { variant } = useDashboardVariant();
	const { user } = useAuth();

	/** All spaces the user can access (any tenant); same source as Chat scope list. */
	const [accessibleSpaces, setAccessibleSpaces] = useState<Space[] | null>(
		null,
	);
	const [spacesListError, setSpacesListError] = useState<string | null>(null);
	const [tenantMetaById, setTenantMetaById] = useState<
		Record<number, Tenant | null>
	>({});
	const [selectedBusinessTenantId, setSelectedBusinessTenantId] = useState<
		number | null
	>(null);
	const [workspaceNavRev, setWorkspaceNavRev] = useState(0);

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

	const businessSortedTenantIds = useMemo(
		() => (accessibleSpaces ? uniqueTenantIds(accessibleSpaces) : []),
		[accessibleSpaces],
	);

	/** Load every space the user belongs to (cross-tenant) for pickers, grids, and org resolution. */
	useEffect(() => {
		let cancelled = false;
		setSpacesListError(null);
		void (async () => {
			try {
				const list = await apiClient.spaces.list({ tenantId: null });
				if (!cancelled) setAccessibleSpaces(list ?? []);
			} catch (e) {
				if (!cancelled) {
					setAccessibleSpaces([]);
					setSpacesListError(
						e instanceof Error ? e.message : "Failed to load spaces",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const selectableNonPersonalTenants = useMemo(
		() => nonPersonalTenantIdsSorted(businessSortedTenantIds, tenantMetaById),
		[businessSortedTenantIds, tenantMetaById],
	);

	useEffect(() => {
		if (variant === "business") return;
		setTenantMetaById({});
		setSelectedBusinessTenantId(null);
	}, [variant]);

	useEffect(() => {
		const bump = () => setWorkspaceNavRev((n) => n + 1);
		window.addEventListener(WORKSPACE_NAV_UPDATED_EVENT, bump);
		return () => {
			window.removeEventListener(WORKSPACE_NAV_UPDATED_EVENT, bump);
		};
	}, []);

	/** Business: fetch tenant metadata (type/name) for selector + default tenant */
	useEffect(() => {
		if (variant !== "business" || accessibleSpaces === null) return;
		const ids = uniqueTenantIds(accessibleSpaces);
		if (ids.length === 0) {
			setTenantMetaById({});
			setSelectedBusinessTenantId(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			const pairs = await Promise.all(
				ids.map(async (id) => {
					try {
						const t = await apiClient.tenants.get(id, {
							tenantIdHeader: id,
						});
						return [id, t] as const;
					} catch {
						return [id, null] as const;
					}
				}),
			);
			if (cancelled) return;
			const nextMeta: Record<number, Tenant | null> = {};
			for (const [id, t] of pairs) nextMeta[id] = t;
			setTenantMetaById(nextMeta);

			const orgIds = nonPersonalTenantIdsSorted(ids, nextMeta);
			setSelectedBusinessTenantId((prev) => {
				if (orgIds.length === 0) return null;
				const stored = readActiveOrgTenantId();
				if (stored != null && orgIds.includes(stored)) return stored;
				if (prev != null && orgIds.includes(prev)) return prev;
				return orgIds[0];
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [variant, accessibleSpaces]);

	/** Optional `X-Tenant-Id` default for API client helpers (cleared on personal dashboard). */
	useEffect(() => {
		if (variant === "business" && selectedBusinessTenantId != null) {
			writeActiveOrgTenantId(selectedBusinessTenantId);
		} else {
			writeActiveOrgTenantId(null);
		}
	}, [variant, selectedBusinessTenantId]);

	/** When org is switched from the shell dialog, align dashboard tenant selection. */
	useEffect(() => {
		if (variant !== "business") return;
		if (selectableNonPersonalTenants.length === 0) return;
		const stored = readActiveOrgTenantId();
		if (stored == null || !selectableNonPersonalTenants.includes(stored)) {
			return;
		}
		setSelectedBusinessTenantId((prev) => (prev === stored ? prev : stored));
	}, [variant, selectableNonPersonalTenants, workspaceNavRev]);

	/** Keep Chat / shell workspace scope aligned with this dashboard (API + sessionStorage). */
	useEffect(() => {
		if (variant === "personal") {
			if (dashboardData?.context?.variant !== "personal") return;
			const tid = dashboardData.context.tenant_id;
			if (tid == null || !Number.isFinite(Number(tid))) return;
			writeChatWorkspaceScope({
				kind: "personal",
				tenantId: Number(tid),
				label: "Personal",
			});
			return;
		}
		if (selectedBusinessTenantId == null) return;
		if (!selectableNonPersonalTenants.includes(selectedBusinessTenantId))
			return;
		const label = tenantLabel(selectedBusinessTenantId, tenantMetaById);
		writeChatWorkspaceScope({
			kind: "organization",
			tenantId: selectedBusinessTenantId,
			label,
		});
	}, [
		variant,
		dashboardData?.context?.variant,
		dashboardData?.context?.tenant_id,
		selectedBusinessTenantId,
		selectableNonPersonalTenants,
		tenantMetaById,
	]);

	const businessTenantMetaReady = useMemo(() => {
		if (variant !== "business") return true;
		if (accessibleSpaces === null) return false;
		const ids = uniqueTenantIds(accessibleSpaces);
		if (ids.length === 0) return true;
		return ids.every((id) =>
			Object.prototype.hasOwnProperty.call(tenantMetaById, id),
		);
	}, [variant, accessibleSpaces, tenantMetaById]);

	const noBusinessContext =
		variant === "business" &&
		accessibleSpaces !== null &&
		businessSortedTenantIds.length === 0;

	const noOrgTenantForBusiness =
		variant === "business" &&
		accessibleSpaces !== null &&
		businessTenantMetaReady &&
		selectableNonPersonalTenants.length === 0 &&
		businessSortedTenantIds.length > 0;

	const pageLoading =
		dashboardLoading ||
		(variant === "business" && accessibleSpaces === null) ||
		(variant === "business" &&
			accessibleSpaces !== null &&
			uniqueTenantIds(accessibleSpaces).length > 0 &&
			!businessTenantMetaReady) ||
		(variant === "business" &&
			selectableNonPersonalTenants.length > 0 &&
			selectedBusinessTenantId === null);

	const pageError = spacesListError ?? dashboardError ?? null;

	const businessContextNotice = noBusinessContext
		? "No spaces yet — open Organization to create an organization, or join one via an invite."
		: noOrgTenantForBusiness
			? "Business dashboard shows only organization workspaces — create one under Organization, or join via an invite. Your personal spaces stay on the Personal tab."
			: null;

	const currency = dashboardData?.context.currency ?? "USD";

	useEffect(() => {
		if (variant === "personal") {
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
		}
	}, [variant, spendPeriodKind, spendAnchor, heroSelectedSpaceId]);

	useEffect(() => {
		if (variant !== "business") return;
		if (accessibleSpaces === null) return;
		if (businessSortedTenantIds.length === 0) {
			setDashboardData(null);
			setDashboardLoading(false);
			setDashboardError(null);
			return;
		}
		if (selectableNonPersonalTenants.length === 0) {
			setDashboardData(null);
			setDashboardLoading(false);
			setDashboardError(null);
			return;
		}
		if (selectedBusinessTenantId === null) return;
		if (!selectableNonPersonalTenants.includes(selectedBusinessTenantId)) {
			return;
		}

		let cancelled = false;
		setDashboardLoading(true);
		setDashboardError(null);
		void (async () => {
			try {
				const res = await apiClient.dashboard.get({
					variant: "business",
					tenant_id: selectedBusinessTenantId,
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
	}, [
		variant,
		accessibleSpaces,
		businessSortedTenantIds.length,
		selectableNonPersonalTenants,
		selectedBusinessTenantId,
		spendPeriodKind,
		spendAnchor,
		heroSelectedSpaceId,
	]);

	const qc = dashboardData?.quick_capture;
	const cont = dashboardData?.continue;
	const spacesRows = dashboardData?.spaces ?? null;
	const monthly = dashboardData?.monthly_snapshot ?? null;
	const recurring = dashboardData?.recurring_upcoming ?? null;
	const pendingDrafts = dashboardData?.pending_drafts ?? null;
	const recentTx = dashboardData?.recent_transactions ?? null;
	const orgSnap = dashboardData?.org_snapshot ?? null;
	const reviewQ = dashboardData?.review_queue ?? null;
	const spend = dashboardData?.spend_overview ?? null;
	const recentAct = dashboardData?.recent_activity ?? null;

	/** Spaces in the current dashboard scope only (personal tenant vs selected org) — never mix both. */
	const dashboardScopedSpaces = useMemo((): Space[] | null => {
		if (accessibleSpaces === null) return null;
		if (variant === "personal") {
			const tid = dashboardData?.context?.tenant_id;
			if (tid == null || !Number.isFinite(Number(tid))) return null;
			const pt = Number(tid);
			return accessibleSpaces.filter((s) => Number(s.tenant_id) === pt);
		}
		if (variant === "business") {
			if (selectedBusinessTenantId == null) return null;
			const bt = Number(selectedBusinessTenantId);
			return accessibleSpaces.filter((s) => Number(s.tenant_id) === bt);
		}
		return accessibleSpaces;
	}, [
		accessibleSpaces,
		variant,
		dashboardData?.context?.tenant_id,
		selectedBusinessTenantId,
	]);

	const spendScopeHint =
		variant === "personal"
			? "Personal workspace — all spaces for this account."
			: "This organization — all spaces in this workspace.";

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

	const businessActivityItems = useMemo(
		() => normalizeActivityItems(recentAct?.items),
		[recentAct?.items],
	);

	const chatWorkspaceForNav = useMemo((): ChatWorkspaceScope | null => {
		if (!dashboardData?.context) return null;
		if (variant === "personal") {
			return {
				kind: "personal",
				tenantId: dashboardData.context.tenant_id,
				label: "Personal",
			};
		}
		if (selectedBusinessTenantId == null) return null;
		return {
			kind: "organization",
			tenantId: selectedBusinessTenantId,
			label: tenantLabel(selectedBusinessTenantId, tenantMetaById),
		};
	}, [
		dashboardData?.context,
		variant,
		selectedBusinessTenantId,
		tenantMetaById,
	]);

	/** Chat navigation for a specific space (correct org vs personal tenant). */
	const chatWorkspaceForSpace = useCallback(
		(spaceTenantId: number, spaceTenantName?: string): ChatWorkspaceScope => {
			const tid = Number(spaceTenantId);
			const personalTid = dashboardData?.context?.tenant_id;
			if (
				personalTid != null &&
				Number.isFinite(Number(personalTid)) &&
				tid === Number(personalTid)
			) {
				return {
					kind: "personal",
					tenantId: Number(personalTid),
					label: "Personal",
				};
			}
			const meta = tenantMetaById[tid];
			const label =
				meta?.name?.trim() || spaceTenantName?.trim() || `Workspace ${tid}`;
			return {
				kind: "organization",
				tenantId: tid,
				label,
			};
		},
		[dashboardData?.context?.tenant_id, tenantMetaById],
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

	useEffect(() => {
		if (!heroContextSpaces.length) {
			setHeroSelectedSpaceId(null);
			return;
		}
		setHeroSelectedSpaceId((prev) => {
			if (prev != null && heroContextSpaces.some((s) => s.id === prev))
				return prev;
			return heroContextSpaces[0].id;
		});
	}, [heroContextSpaces]);

	const heroSpaceTitle = useMemo(() => {
		if (heroSelectedSpaceId == null) return null;
		const row = heroContextSpaces.find((s) => s.id === heroSelectedSpaceId);
		return row?.name?.trim() ?? null;
	}, [heroContextSpaces, heroSelectedSpaceId]);

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

	const resolvePendingDraftChatWorkspace = useCallback(
		(d: { tenant_id: number }): ChatWorkspaceScope => ({
			kind: variant === "personal" ? "personal" : "organization",
			tenantId: d.tenant_id,
			label:
				variant === "personal"
					? "Personal"
					: tenantLabel(d.tenant_id, tenantMetaById),
		}),
		[variant, tenantMetaById],
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
		<>
			<div className="space-y-4">
				<div className="min-w-0 space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">
						Dashboard
						{heroSpaceTitle ? (
							<span className="font-normal text-[hsl(var(--text-secondary))]">
								{" "}
								· {heroSpaceTitle}
							</span>
						) : null}
					</h1>
					<p className="text-sm text-[hsl(var(--text-secondary))]">
						{variant === "business" ? (
							<>
								Organization dashboard — scoped to one workspace at a time.{" "}
								<Link
									className="font-medium text-[hsl(var(--accent))] underline underline-offset-2"
									to="/console/account"
								>
									Account
								</Link>
								.
							</>
						) : (
							<>
								Personal Ceits workspace.{" "}
								<Link
									className="font-medium text-[hsl(var(--accent))] underline underline-offset-2"
									to="/console/account"
								>
									Account
								</Link>
								.
							</>
						)}
					</p>
				</div>
			</div>

			{intentBanner ? (
				<output
					aria-live="polite"
					className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))] p-4 text-sm"
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

			{businessContextNotice ? (
				<div
					className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))] px-4 py-3 text-sm text-[hsl(var(--text-secondary))]"
					role="status"
				>
					{businessContextNotice}
				</div>
			) : null}

			{variant === "personal" ? (
				<div className={sectionRhythm}>
					<div className={dashboardCaptureHeroBandClass}>
						<div className={dashboardCaptureHeroInnerClass}>
							<div className="lg:col-span-12 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl ring-1 ring-black/40">
								{monthly ? (
									<SpendCoverBand
										currency={currency}
										monthly={monthly}
										onNav={handleSpendNav}
										onPeriodKind={handleSpendPeriodKind}
										onToday={handleSpendToday}
										scopeHint={spendScopeHint}
										spendAnchor={spendAnchor}
										spendPeriodKind={spendPeriodKind}
									/>
								) : null}
								<HeroSpaceContextBar
									currentUserId={user?.id}
									onSelectSpaceId={setHeroSelectedSpaceId}
									selectedSpaceId={heroSelectedSpaceId}
									spaces={heroContextSpaces}
								/>
								<div className="grid grid-cols-1 gap-0 lg:grid-cols-12 lg:divide-x lg:divide-white/10">
									<div className="min-h-0 p-4 sm:p-5 lg:col-span-8">
										<DashboardMergedCaptureBlock
											chatNavState={chatNavState}
											chatWorkspace={chatWorkspaceForNav}
											className="h-full min-h-0"
											cont={cont}
											errorCopy={sharedErrorCopy}
											navigableSpaces={continueNavigableSpaces}
											pageError={pageError}
											pageLoading={pageLoading}
											qc={heroQuickCapture ?? qc}
											selectedSpaceId={heroSelectedSpaceId}
										/>
									</div>
									<div className="min-h-0 border-t border-white/10 bg-zinc-900/30 p-4 sm:p-5 lg:col-span-4 lg:border-t-0">
										<WidgetShell
											className="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none"
											contentClassName="min-h-0"
											descriptionOverride={draftsHeroDescription}
											emptyCopyOverride={draftsHeroEmptyCopy}
											errorCopy={sharedErrorCopy}
											state={deriveWidgetState(
												pageLoading,
												pageError,
												pendingDraftsForHeroSpace.length > 0,
											)}
											titleOverride="Drafts awaiting review"
											shellVariant="darkMuted"
											widgetKey="pending_drafts"
										>
											{pendingDraftsForHeroSpace.length > 0 ? (
												<PendingDraftsList
													currency={currency}
													items={pendingDraftsForHeroSpace}
													resolveChatWorkspace={
														resolvePendingDraftChatWorkspace
													}
													tone="onDark"
												/>
											) : null}
										</WidgetShell>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-2 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch">
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
									pendingDrafts={pendingDrafts}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-6 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(recurring && recurring.length > 0),
							)}
							widgetKey="recurring_upcoming"
						>
							<ul className="space-y-2">
								{recurring?.map((r) => (
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
									reviewQ &&
										(reviewQ.items.length > 0 || reviewQ.total_count > 0),
								),
							)}
							widgetKey="review_queue"
						>
							{reviewQ ? (
								<ReviewQueuePanel
									chatNavState={chatNavState}
									currency={currency}
									formatCurrencyAmount={formatCurrencyAmount}
									formatDateLabel={formatDateLabel}
									queue={reviewQ}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-12 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								spacesForGrid.length > 0,
							)}
							widgetKey="spaces"
						>
							<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{spacesForGrid.map((s) => (
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
								Boolean(recentTx && recentTx.length > 0),
							)}
							widgetKey="recent_transactions"
						>
							<ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
								{recentTx?.map((t) => (
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
					<div className="mt-10 grid grid-cols-1 gap-6">
						<WidgetShell state="empty" widgetKey="ai_teaser" />
					</div>
				</div>
			) : (
				<div className={sectionRhythm}>
					<div className={dashboardCaptureHeroBandClass}>
						<div className={dashboardCaptureHeroInnerClass}>
							<div className="lg:col-span-12 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl ring-1 ring-black/40">
								{monthly ? (
									<SpendCoverBand
										currency={currency}
										monthly={monthly}
										onNav={handleSpendNav}
										onPeriodKind={handleSpendPeriodKind}
										onToday={handleSpendToday}
										scopeHint={spendScopeHint}
										spendAnchor={spendAnchor}
										spendPeriodKind={spendPeriodKind}
									/>
								) : null}
								<HeroSpaceContextBar
									currentUserId={user?.id}
									onSelectSpaceId={setHeroSelectedSpaceId}
									selectedSpaceId={heroSelectedSpaceId}
									spaces={heroContextSpaces}
								/>
								<div className="grid grid-cols-1 gap-0 lg:grid-cols-12 lg:divide-x lg:divide-white/10">
									<div className="min-h-0 p-4 sm:p-5 lg:col-span-8">
										<DashboardMergedCaptureBlock
											chatNavState={chatNavState}
											chatWorkspace={chatWorkspaceForNav}
											className="h-full min-h-0"
											cont={cont}
											errorCopy={sharedErrorCopy}
											navigableSpaces={continueNavigableSpaces}
											pageError={pageError}
											pageLoading={pageLoading}
											qc={heroQuickCapture ?? qc}
											selectedSpaceId={heroSelectedSpaceId}
										/>
									</div>
									<div className="min-h-0 border-t border-white/10 bg-zinc-900/30 p-4 sm:p-5 lg:col-span-4 lg:border-t-0">
										<WidgetShell
											className="!rounded-none !border-0 !bg-transparent !p-0 !shadow-none"
											contentClassName="min-h-0"
											descriptionOverride={draftsHeroDescription}
											emptyCopyOverride={draftsHeroEmptyCopy}
											errorCopy={sharedErrorCopy}
											state={deriveWidgetState(
												pageLoading,
												pageError,
												pendingDraftsForHeroSpace.length > 0,
											)}
											titleOverride="Drafts awaiting review"
											shellVariant="darkMuted"
											widgetKey="pending_drafts"
										>
											{pendingDraftsForHeroSpace.length > 0 ? (
												<PendingDraftsList
													currency={currency}
													items={pendingDraftsForHeroSpace}
													resolveChatWorkspace={
														resolvePendingDraftChatWorkspace
													}
													tone="onDark"
												/>
											) : null}
										</WidgetShell>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="mt-2 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-stretch">
						<WidgetShell
							className="lg:col-span-4 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(orgSnap?.name?.trim()),
							)}
							widgetKey="org_snapshot"
						>
							{orgSnap?.name ? <OrgSnapshotPanel org={orgSnap} /> : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-4 h-full min-h-0"
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
									pendingDrafts={pendingDrafts}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-4 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(
									reviewQ &&
										(reviewQ.items.length > 0 || reviewQ.total_count > 0),
								),
							)}
							widgetKey="review_queue"
						>
							{reviewQ ? (
								<ReviewQueuePanel
									chatNavState={chatNavState}
									currency={currency}
									formatCurrencyAmount={formatCurrencyAmount}
									formatDateLabel={formatDateLabel}
									queue={reviewQ}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-12 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								selectedBusinessTenantId != null,
							)}
							widgetKey="tenant_people"
						>
							<TenantPeoplePanel
								currentUserId={user?.id}
								tenantId={selectedBusinessTenantId}
							/>
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-8 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								spacesForGrid.length > 0,
							)}
							widgetKey="spaces"
						>
							<ul className="grid gap-2 sm:grid-cols-2">
								{spacesForGrid.map((s) => (
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
							className="lg:col-span-4 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(spend != null && Array.isArray(spend.by_tag)),
							)}
							widgetKey="spend_overview"
						>
							{spend != null && Array.isArray(spend.by_tag) ? (
								<SpendByTagPanel
									currency={currency}
									formatCurrencyAmount={formatCurrencyAmount}
									formatDateLabel={formatDateLabel}
									spend={spend}
								/>
							) : null}
						</WidgetShell>

						<WidgetShell
							className="lg:col-span-6 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(recentTx && recentTx.length > 0),
							)}
							widgetKey="recent_transactions"
						>
							<ul className="space-y-2">
								{recentTx?.map((t) => (
									<li className="text-xs" key={t.id}>
										<Link
											className="flex flex-col rounded-md border border-[hsl(var(--border-subtle))] px-3 py-2 transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
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

						<WidgetShell
							className="lg:col-span-6 h-full min-h-0"
							errorCopy={sharedErrorCopy}
							state={deriveWidgetState(
								pageLoading,
								pageError,
								Boolean(recurring && recurring.length > 0),
							)}
							widgetKey="recurring_upcoming"
						>
							<ul className="space-y-2">
								{recurring?.map((r) => (
									<li
										className="flex flex-col gap-0.5 rounded-md border border-[hsl(var(--border-subtle))] px-3 py-2 text-xs"
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
								businessActivityItems.length > 0,
							)}
							widgetKey="recent_activity"
						>
							{businessActivityItems.length > 0 ? (
								<RecentActivityPanel
									chatNavState={chatNavState}
									items={businessActivityItems}
								/>
							) : null}
						</WidgetShell>
					</div>
					<div className="mt-10 grid grid-cols-1 gap-5">
						<WidgetShell state="empty" widgetKey="ai_teaser" />
					</div>
				</div>
			)}
		</>
	);
};

export const DashboardPage = () => {
	const { variant: variantParam } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const [intentBanner, setIntentBanner] = useState<string | null>(null);

	if (variantParam !== undefined && !isDashboardVariant(variantParam)) {
		return <Navigate replace to="/console/dashboard/personal" />;
	}

	const variant = variantParam ?? "personal";

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
				? "You started from the business and teams path — explore Organization and Quota when you are ready."
				: "You started from the personal and family path — shared spaces and splits work great from Spaces and Chat.",
		);
	}, [searchParams, setSearchParams]);

	const handleDismissIntent = () => {
		setIntentBanner(null);
		clearOnboardingIntent();
	};

	const footerChatLinkState = (() => {
		const cw = readChatWorkspaceScope();
		return cw ? { chatWorkspace: cw } : undefined;
	})();

	return (
		<DashboardVariantProvider variant={variant}>
			<div className="space-y-8">
				<DashboardBody
					intentBanner={intentBanner}
					onDismissIntent={handleDismissIntent}
				/>
				<section
					aria-label="Quick navigation"
					className="border-t border-[hsl(var(--border-subtle))] pt-8"
				>
					<p className="mb-3 text-xs font-medium uppercase tracking-wide text-[hsl(var(--text-secondary))]">
						All console areas
					</p>
					<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/drafts"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								Drafts
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Text, photo, or voice capture.
							</div>
						</Link>
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/transactions"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								History
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Confirmed transactions.
							</div>
						</Link>
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							state={footerChatLinkState}
							to="/console/chat"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								Chat
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Space-scoped discussion.
							</div>
						</Link>
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/spaces"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								Spaces
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Manage spaces and members.
							</div>
						</Link>
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/recurring"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								Recurring
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Schedules and pauses.
							</div>
						</Link>
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/organization"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								Organization
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Tenant directory and name.
							</div>
						</Link>
						<Link
							className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-4 text-sm transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							to="/console/quota"
						>
							<div className="font-medium text-[hsl(var(--text-primary))]">
								Quota
							</div>
							<div className="mt-1 text-xs text-[hsl(var(--text-secondary))]">
								Parse limits and blocked state.
							</div>
						</Link>
					</div>
				</section>
			</div>
		</DashboardVariantProvider>
	);
};
