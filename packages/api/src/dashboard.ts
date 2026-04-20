/**
 * Types for `GET /api/v1/dashboard` (proposal — see ceits-dashboard-execution-brief §4).
 * Omitted keys or null are non-breaking per contract.
 */

export type DashboardVariant = "personal" | "business";

export type DashboardContextPayload = {
	tenant_id: number;
	variant: DashboardVariant;
	currency: string;
};

export type DashboardQuickCaptureSpace = {
	id: number;
	name: string;
	tenant_id: number;
	/** Why this space exists — from space settings (optional). */
	description?: string;
};

export type DashboardQuickCapture = {
	default_space_id: number;
	spaces: DashboardQuickCaptureSpace[];
};

export type DashboardContinue = {
	space_id: number;
	space_name: string;
	draft_id: number | null;
	expense_thread_path: string | null;
};

export type DashboardSpaceRow = {
	id: number;
	name: string;
	description?: string;
	tenant_id: number;
	last_activity_at?: string | null;
	member_count?: number | null;
	/** Confirmed approved spend: user's share this calendar month (txn_date). */
	period_spent_preview?: number | null;
	/** User's share of draft expenses in this space (open drafts). */
	draft_my_share_preview?: number | null;
};

export type DashboardMonthlyPeriod = {
	start: string;
	end: string;
};

export type DashboardMonthlyTopSpace = {
	space_id: number;
	name: string;
	amount: number;
};

export type DashboardSpendPeriodKind = "day" | "month" | "year";

export type DashboardMonthlySnapshot = {
	period: DashboardMonthlyPeriod;
	/** day | month | year — window for totals. */
	period_kind?: DashboardSpendPeriodKind | string;
	/** UTC anchor date (YYYY-MM-DD) used with period_kind. */
	anchor_date?: string;
	/** Legacy line-item sum (not split-aware). */
	total_spent: number;
	/** User's attributed share (splits when present). Omitted by older API responses. */
	total_my_share?: number;
	previous_period_total?: number | null;
	previous_period_my_share?: number | null;
	delta_ratio?: number | null;
	delta_ratio_my_share?: number | null;
	top_spaces: DashboardMonthlyTopSpace[];
	selected_space_id?: number | null;
	selected_space_name?: string | null;
	selected_space_my_share?: number;
};

/** Business tenant header (from server OrgSnapshot). */
export type DashboardOrgSnapshot = {
	id: number;
	name: string;
	type: string;
} | null;

/** Open expense thread where the current user has not approved yet (dashboard review queue). */
export type DashboardExpenseThreadApprovalItem = {
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

export type DashboardReviewQueueItem =
	| DashboardExpenseThreadApprovalItem
	| Record<string, unknown>;

export type DashboardReviewQueue = {
	items: DashboardReviewQueueItem[];
	total_count: number;
};

export type DashboardRecurringUpcomingItem = {
	id: number;
	name: string;
	next_due: string;
	amount: number;
	space_id?: number;
	space_name?: string;
};

export type DashboardRecentTransaction = {
	id: number;
	amount: number;
	currency: string;
	occurred_at: string;
	space_id: number;
	space_name: string;
	status: string;
	label: string;
};

/** Draft expense rows awaiting confirm/cancel (from `expenses.status = draft`). */
export type DashboardPendingDraft = {
	id: number;
	tenant_id: number;
	space_id: number;
	space_name: string;
	label: string;
	total: number;
	/** User's share (split rows when present; else full total for owner). */
	my_share?: number;
	currency: string;
	updated_at: string;
};

export type DashboardSpendTagRow = {
	tag: string;
	amount: number;
};

/** Tag rollup for the current month (business + personal). */
export type DashboardSpendOverview = {
	period?: DashboardMonthlyPeriod | null;
	by_tag: DashboardSpendTagRow[];
} | null;

export type DashboardActivityItem = {
	caption: string;
	timestamp: string;
	space_name: string;
	space_id: number;
};

export type DashboardRecentActivity = {
	items?: DashboardActivityItem[];
} | null;

export type DashboardResponse = {
	context: DashboardContextPayload;
	as_of: string;
	quick_capture?: DashboardQuickCapture | null;
	continue?: DashboardContinue | null;
	spaces?: DashboardSpaceRow[] | null;
	monthly_snapshot?: DashboardMonthlySnapshot | null;
	org_snapshot?: DashboardOrgSnapshot;
	review_queue?: DashboardReviewQueue | null;
	recurring_upcoming?: DashboardRecurringUpcomingItem[] | null;
	recent_transactions?: DashboardRecentTransaction[] | null;
	pending_drafts?: DashboardPendingDraft[] | null;
	spend_overview?: DashboardSpendOverview;
	recent_activity?: DashboardRecentActivity;
};

export const isDashboardVariant = (value: string): value is DashboardVariant =>
	value === "personal" || value === "business";
