import type { DashboardResponse } from "@cofi/api";
import type { ReactNode } from "react";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { RailActionBlock } from "./rightRail/RailActionBlock";
import { RailAttentionBlock } from "./rightRail/RailAttentionBlock";
import { RailContextBlock } from "./rightRail/RailContextBlock";

const formatDayLabel = (iso: string): string => {
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return iso;
		return d.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	} catch {
		return iso;
	}
};

const daysUntil = (iso: string): number | null => {
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return null;
	const now = Date.now();
	const diff = ts - now;
	return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

const formatRelativeUpdate = (iso?: string | null): string | null => {
	if (!iso) return null;
	const ts = Date.parse(iso);
	if (!Number.isFinite(ts)) return null;
	const diffMinutes = Math.max(1, Math.round((Date.now() - ts) / 60000));
	if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) return `Updated ${diffHours}h ago`;
	const diffDays = Math.round(diffHours / 24);
	return `Updated ${diffDays}d ago`;
};

const normalizeRecurringLabel = (
	label: string | undefined,
	index: number,
): string => {
	const fallback = ["Fiber Internet", "Netflix", "Electricity", "Broadband"];
	const trimmed = (label ?? "").trim();
	if (!trimmed || /\(dummy\)/i.test(trimmed)) {
		return fallback[index % fallback.length] ?? "Shared subscription";
	}
	return trimmed;
};

type ApprovalReviewItem = {
	kind: "expense_thread_approval";
	thread_id: number;
	expense_id: number;
	space_id: number;
	space_name: string;
	label: string;
	total: number;
	my_share: number;
	currency: string;
	updated_at: string;
};

const isApprovalItem = (it: unknown): it is ApprovalReviewItem =>
	it != null &&
	typeof it === "object" &&
	"kind" in it &&
	(it as { kind: string }).kind === "expense_thread_approval";

export type OverviewRightRailProps = {
	dashboardData: DashboardResponse | null;
	chatWorkspace: ChatWorkspaceScope | null;
	/** When set, every widget is filtered to this space. */
	spaceId?: number | null;
	/** Used in copy / button labels when scoped. */
	spaceName?: string | null;
	formatMoney: (amount: number) => string;
	className?: string;
	/** Space Overview: hover on decision CTA highlights related activity rows. */
	onSpaceOverviewCtaHover?: (active: boolean) => void;
	/** Optional override for the decision-queue bridge line (main column). */
	spaceOverviewBridgeHint?: string;
	/**
	 * Space Overview: one focused rail (decision queue + bills), no duplicate
	 * “needs attention” list or monthly snapshot (shown on the page body).
	 */
	variant?: "default" | "spaceOverview";
};

const IconBell = ({ className }: { className?: string }) => (
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
		<title>Bell</title>
		<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" />
	</svg>
);

const IconClock = ({ className }: { className?: string }) => (
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
		<title>Clock</title>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 2" />
	</svg>
);

const IconReceipt = ({ className }: { className?: string }) => (
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
		<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
		<path d="M9 8h6M9 12h6M9 16h4" />
	</svg>
);

/**
 * Editorial right utility rail used on Home and Space Overview.
 *
 * Mirrors the household overview design reference: Split Overview (balances +
 * splits-needing-confirmation count), Needs Attention quick-links, Upcoming
 * Bills, and a dark Monthly Snapshot card pinned at the bottom.
 *
 * The widgets read from `DashboardResponse` (already loaded by the parent
 * page) and optionally narrow by `spaceId` so the same component works as a
 * household-wide rail and a single-space rail.
 *
 * Backend gaps documented for future iteration:
 * - `GET /api/v1/finances/splits/balances[?space_id=]` would replace the
 *   "Coming soon" balance line with real "Sarah owes you $X" rows.
 * - `recurring_upcoming` items would benefit from an `autopay` boolean to
 *   render the "Autopay" hint in line with the design reference.
 */
export const OverviewRightRail = ({
	dashboardData,
	chatWorkspace,
	spaceId = null,
	spaceName,
	formatMoney,
	className = "",
	variant = "default",
	onSpaceOverviewCtaHover,
	spaceOverviewBridgeHint,
}: OverviewRightRailProps) => {
	const isSpaceOverview = variant === "spaceOverview" && spaceId != null;
	const monthly = dashboardData?.monthly_snapshot ?? null;

	const recurring = (dashboardData?.recurring_upcoming ?? []).filter(
		(r) =>
			spaceId == null ||
			r.space_id == null ||
			Number(r.space_id) === Number(spaceId),
	);
	const pendingDrafts = (dashboardData?.pending_drafts ?? []).filter(
		(d) => spaceId == null || Number(d.space_id) === Number(spaceId),
	);
	const reviewItems = (dashboardData?.review_queue?.items ?? [])
		.flatMap((it) => (isApprovalItem(it) ? [it] : []))
		.filter((it) => spaceId == null || Number(it.space_id) === Number(spaceId));

	const upcomingSoonCount = recurring.filter((r) => {
		const d = daysUntil(r.next_due);
		return d != null && d >= 0 && d <= 7;
	}).length;

	const monthlyShare =
		monthly != null
			? typeof monthly.selected_space_my_share === "number" && spaceId != null
				? monthly.selected_space_my_share
				: typeof monthly.total_my_share === "number"
					? monthly.total_my_share
					: monthly.total_spent
			: null;

	const deltaRatio =
		monthly?.delta_ratio_my_share ?? monthly?.delta_ratio ?? null;

	const splitsHref =
		spaceId != null
			? `/console/spaces/${encodeURIComponent(String(spaceId))}/splits`
			: "/console/spaces";
	const reviewPrimarySpace = reviewItems
		.slice()
		.sort(
			(left, right) =>
				Date.parse(right.updated_at) - Date.parse(left.updated_at),
		)[0];
	const reviewPrimarySplitsHref =
		reviewPrimarySpace != null
			? `/console/spaces/${encodeURIComponent(String(reviewPrimarySpace.space_id))}/splits`
			: splitsHref;

	const recurringHref =
		spaceId != null
			? `/console/spaces/${encodeURIComponent(String(spaceId))}/recurring`
			: "/console/recurring";

	const draftsHref = "/console/drafts";

	const linkState = chatWorkspace ? { chatWorkspace } : undefined;

	const involvedSpaces = [
		...new Set(
			[
				...reviewItems.map((item) => item.space_name),
				...pendingDrafts.map((item) => item.space_name),
			]
				.map((value) => (value ?? "").trim())
				.filter(Boolean),
		),
	];
	const actionContextLine = isSpaceOverview
		? spaceName
			? `Everything here is in ${spaceName} only.`
			: undefined
		: involvedSpaces.length > 0
			? `Involved spaces: ${involvedSpaces.slice(0, 2).join(", ")}${involvedSpaces.length > 2 ? " +" : ""}`
			: spaceName
				? `Involved space: ${spaceName}`
				: undefined;
	const actionUpdatedAt = [
		...reviewItems.map((item) => item.updated_at),
		...pendingDrafts.map((item) => item.updated_at),
	]
		.filter(
			(value): value is string => typeof value === "string" && value.length > 0,
		)
		.sort((left, right) => Date.parse(right) - Date.parse(left))[0];
	const actionLiveHint = formatRelativeUpdate(actionUpdatedAt);

	const attentionItems: {
		key: string;
		label: string;
		detail: string;
		tone: "warn" | "primary" | "muted";
		icon: ReactNode;
		to: string;
	}[] = [];
	if (upcomingSoonCount > 0) {
		attentionItems.push({
			key: "bills",
			label: `${upcomingSoonCount} bill${upcomingSoonCount === 1 ? "" : "s"} due soon`,
			detail: "Recurring charges approaching this week.",
			tone: "warn",
			icon: <IconBell className="h-3.5 w-3.5 shrink-0" />,
			to: recurringHref,
		});
	}
	if (reviewItems.length > 0) {
		attentionItems.push({
			key: "splits",
			label: `${reviewItems.length} split${reviewItems.length === 1 ? "" : "s"} for review`,
			detail: "Confirm shares and approve pending threads.",
			tone: "primary",
			icon: <IconClock className="h-3.5 w-3.5 shrink-0" />,
			to: reviewPrimarySplitsHref,
		});
	}
	if (pendingDrafts.length > 0) {
		attentionItems.push({
			key: "drafts",
			label: `${pendingDrafts.length} expense${pendingDrafts.length === 1 ? "" : "s"} waiting review`,
			detail: "Parsed drafts are ready for final confirmation.",
			tone: "muted",
			icon: <IconReceipt className="h-3.5 w-3.5 shrink-0" />,
			to: draftsHref,
		});
	}
	const attentionPriority = (tone: "warn" | "primary" | "muted"): number =>
		tone === "primary" ? 0 : tone === "warn" ? 1 : 2;
	const actionSummary =
		reviewItems.length > 0
			? {
					kind: "splits" as const,
					title: `${reviewItems.length} split${reviewItems.length === 1 ? "" : "s"} need confirmation`,
					description: isSpaceOverview
						? `Confirm these so shares and balances in ${spaceName ?? "this space"} stay accurate.`
						: spaceName != null
							? `Resolve split approvals in ${spaceName} so expenses can close cleanly.`
							: "Resolve split approvals to keep household balances accurate.",
					ctaLabel: isSpaceOverview
						? "Open decision queue"
						: spaceName
							? `Review ${spaceName} splits`
							: "Review all splits",
					ctaTo:
						isSpaceOverview && spaceId != null
							? `/console/review?spaceId=${encodeURIComponent(String(spaceId))}`
							: reviewPrimarySplitsHref,
				}
			: pendingDrafts.length > 0
				? {
						kind: "drafts" as const,
						title: `${pendingDrafts.length} draft${pendingDrafts.length === 1 ? "" : "s"} waiting review`,
						description: isSpaceOverview
							? `Finish these in ${spaceName ?? "this space"} so they can post to the ledger.`
							: "Confirm parsed expenses so they move from draft to recorded.",
						ctaLabel: isSpaceOverview ? "Review drafts" : "Review drafts",
						ctaTo: isSpaceOverview
							? `/console/chat?spaceId=${encodeURIComponent(String(spaceId))}&view=activity`
							: draftsHref,
					}
				: upcomingSoonCount > 0
					? {
							kind: "bills" as const,
							title: `${upcomingSoonCount} bill${upcomingSoonCount === 1 ? "" : "s"} due soon`,
							description: isSpaceOverview
								? "Recurring charges with dates in the next week."
								: "Check upcoming recurring payments and avoid late surprises.",
							ctaLabel: "Open recurring",
							ctaTo: recurringHref,
						}
					: {
							kind: "none" as const,
							title: isSpaceOverview
								? "Nothing needs you here"
								: "No urgent actions right now",
							description: isSpaceOverview
								? `You’re up to date in ${spaceName ?? "this space"}. Capture new spending anytime.`
								: "Everything is in good shape. You can still review spaces for context.",
							ctaLabel: isSpaceOverview ? "Go to chat" : "Open spaces",
							ctaTo: isSpaceOverview
								? `/console/chat?spaceId=${encodeURIComponent(String(spaceId))}`
								: "/console/spaces",
						};
	const attentionItemsFiltered = isSpaceOverview
		? []
		: attentionItems
				.filter((item) => item.key !== actionSummary.kind)
				.sort(
					(left, right) =>
						attentionPriority(left.tone) - attentionPriority(right.tone),
				);

	const upcomingBills = recurring.slice(0, 5).map((item) => {
		const dueInDays = daysUntil(item.next_due);
		const dueLabel = formatDayLabel(item.next_due);
		const dueSoonLabel =
			dueInDays != null && dueInDays >= 0 && dueInDays <= 14
				? dueInDays === 0
					? "Due today"
					: `Due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}`
				: undefined;
		return {
			id: `${item.id}-${item.next_due}`,
			name: normalizeRecurringLabel(item.name, item.id),
			amountLabel: formatMoney(item.amount),
			dueLabel,
			dueSoonLabel,
			spaceName: item.space_name ?? null,
			isUrgent: dueInDays != null && dueInDays >= 0 && dueInDays <= 7,
		};
	});

	const monthlyDeltaText =
		deltaRatio != null
			? deltaRatio > 0
				? `You are spending ${Math.round(deltaRatio * 100)}% more than last period.`
				: deltaRatio < 0
					? `You are spending ${Math.round(Math.abs(deltaRatio) * 100)}% less than last period.`
					: "Spend matches last period exactly."
			: null;
	const monthlyContextText =
		spaceName != null
			? `Tracks your share progression in ${spaceName} this month.`
			: "Tracks your share progression across active spaces this month.";

	return (
		<div
			className={[
				"flex flex-col",
				isSpaceOverview ? "gap-8" : "gap-7",
				className,
			]
				.join(" ")
				.trim()}
		>
			<div
				className={
					isSpaceOverview
						? "sticky top-0 z-10 border-b border-[rgba(190,170,130,0.22)] bg-[linear-gradient(180deg,rgba(255,251,244,0.97)_0%,rgba(247,243,235,0.88)_55%,rgba(247,243,235,0)_100%)] pb-3 pt-1 backdrop-blur-[3px]"
						: "sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(248,248,248,0.94)_0%,rgba(248,248,248,0.72)_70%,rgba(248,248,248,0)_100%)] pb-2 pt-1 backdrop-blur-[2px]"
				}
			>
				<RailActionBlock
					bridgeHint={
						isSpaceOverview
							? (spaceOverviewBridgeHint ??
								"These items also appear in What’s happening below — hover the button to spotlight matching rows.")
							: undefined
					}
					cardKicker={isSpaceOverview ? null : "Primary decision"}
					contextLine={actionContextLine}
					ctaLabel={actionSummary.ctaLabel}
					ctaTo={actionSummary.ctaTo}
					description={actionSummary.description}
					elevated={isSpaceOverview}
					liveHint={
						isSpaceOverview
							? (actionLiveHint ??
								"Updates when activity changes in this space")
							: (actionLiveHint ?? "Live state from latest activity")
					}
					onCtaHoverChange={
						isSpaceOverview ? onSpaceOverviewCtaHover : undefined
					}
					sectionLabel={isSpaceOverview ? "Decision queue" : "Action"}
					title={actionSummary.title}
				/>
			</div>
			<div
				className={
					isSpaceOverview
						? "space-y-4 border-t border-[rgba(140,120,95,0.12)] pt-5"
						: "space-y-3"
				}
			>
				{attentionItemsFiltered.length > 0 ? (
					<RailAttentionBlock
						items={attentionItemsFiltered}
						linkState={linkState}
					/>
				) : null}
				<RailContextBlock
					bills={upcomingBills}
					billsSurface={isSpaceOverview ? "spaceMuted" : "default"}
					monthlyAmount={monthlyShare != null ? formatMoney(monthlyShare) : "—"}
					monthlyContext={monthlyContextText}
					monthlyDelta={monthlyDeltaText}
					monthlyLabel={
						spaceName
							? `${spaceName} · your share`
							: "Shared spend · your share"
					}
					recurringHref={recurringHref}
					sectionLabel={isSpaceOverview ? "Bills in this space" : "Context"}
					showMonthlySnapshot={!isSpaceOverview}
				/>
			</div>
		</div>
	);
};
