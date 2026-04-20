export type AuthTokens = {
	accessToken: string;
	refreshToken?: string;
};

/** Structured JSON in `users.user_preferences` (versioned; optional `tax` when consented). */
export type UserFinancialPreferences = {
	weekStartsOn?: number;
	fiscalYearStartMonth?: number;
	/** Empty string means “use account currency”. */
	reportingCurrency?: string;
};

export type UserTaxPreferences = {
	primaryCountry?: string;
	filingIntent?: "personal" | "business" | "unspecified";
};

export type UserAppearancePreferences = {
	theme?: "legacy-technical" | "ceits-editorial";
};

export type UserPreferencesPayload = {
	version?: number;
	financial?: UserFinancialPreferences;
	tax?: UserTaxPreferences;
	appearance?: UserAppearancePreferences;
};

export type User = {
	id: number;
	email?: string;
	name?: string;
	auth_type?: string;
	authType?: string;
	country?: string;
	language?: string;
	timezone?: string;
	currency?: string;
	dateFormat?: string;
	emailNotifications?: boolean;
	darkMode?: boolean;
	userPreferences?: UserPreferencesPayload | Record<string, unknown>;
	taxPreferencesConsent?: boolean;
};

export type ProfileUpdateRequest = {
	email: string;
	name: string;
	country: string;
	language: string;
	timezone: string;
	currency: string;
	dateFormat: string;
	emailNotifications: boolean;
	darkMode: boolean;
	userPreferences?: UserPreferencesPayload | Record<string, unknown>;
	taxPreferencesConsent?: boolean;
};

export type Space = {
	id: string | number;
	name: string;
	/** Optional context shown on the dashboard and in future space settings. */
	description?: string;
	/** Tenant that owns this space (from API). */
	tenant_id: number;
	/** User who created / owns this space row (not necessarily your space membership role). */
	owner_user_id?: number;
	/** Set on list responses: tenant workspace display name. */
	tenant_name?: string;
	/** Set on list responses: display label for `owner_user_id`. */
	owner_display_name?: string;
	created_at?: string;
	/** Latest activity: main chat, expense-thread posts, or thread updates (ISO 8601). */
	last_activity_at?: string;
};

/** Space role from `space_members.role` (Ceits / ADR-0003). */
export type SpaceRole = "owner" | "admin" | "editor" | "member" | "viewer";

export type SpaceMember = {
	user_id: number;
	email?: string;
	name?: string;
	role: SpaceRole;
};

/** Response body for `GET /api/v1/spaces/:spaceId/members`. */
export type SpaceMembersListResponse = {
	members: SpaceMember[];
	/** True when the current user may change others’ space roles (tenant admin + space owner). */
	can_manage_member_roles: boolean;
};

export type InviteSuggestionUser = {
	user_id: number;
	name: string;
	email?: string;
};

export type PendingInviteBrief = {
	id: number;
	invitee_email: string;
	/** Present for outstanding invites; used for share link and resend. */
	token: string;
	expires_at: string;
	space_id?: number;
	created_at: string;
};

export type SpaceInviteSuggestionsResponse = {
	suggestions: InviteSuggestionUser[];
	pending_invites_for_space: PendingInviteBrief[];
};

/** Invites addressed to your account email (`GET /invites/pending-for-me`). */
export type MyPendingInviteRow = {
	id: number;
	token: string;
	tenant_id: number;
	space_id?: number;
	space_name?: string;
	tenant_name?: string;
	invite_kind: "space" | "tenant_only";
	invited_space_role: string;
	expires_at: string;
	created_at: string;
};

export type MyPendingInvitesResponse = {
	invites: MyPendingInviteRow[];
};

export type TenantInviteRow = {
	id: number;
	invitee_email: string;
	space_id?: number | null;
	expires_at: string;
	accepted_at?: string | null;
	created_at: string;
	invited_space_role: string;
	invited_tenant_role?: string | null;
	inviter_user_id: number;
};

export type TenantInvitesListResponse = {
	invites: TenantInviteRow[];
};

export type SpaceInviteCreateResponse = {
	token: string;
	expires_at: string;
};

export type DraftItem = {
	amount: number;
	name: string;
	emotion?: string;
	tags?: string[];
	/** Optional memo for this line only (distinct from expense-level business notes). */
	notes?: string;
	expense_date?: string;
};

export type Draft = {
	id: string | number;
	space_id: string | number;
	status: "draft";
	items: DraftItem[];
	total: number;
	created_at?: string;
};

/** Optional business fields on a transaction (mirrors expense `business_meta`). */
export type TransactionBusinessMeta = {
	invoice_ref?: string;
	notes?: string;
};

export type Transaction = {
	id: string | number;
	space_id: string | number;
	/** Expense owner; used for Mine / Others filters in shared spaces. */
	user_id?: number;
	type: "expense" | "income";
	status: string;
	/** Short label; aligns with expense header `title`. */
	title?: string;
	/** Raw capture / voice text (global list endpoint). */
	description?: string;
	payee_text?: string;
	currency?: string;
	/** Calendar date of the expense (YYYY-MM-DD). */
	txn_date?: string;
	items: DraftItem[];
	total: number;
	created_at?: string;
	/** Present when this posting was generated from a recurring schedule. */
	recurring_id?: number;
	/** Whether that schedule is currently paused (omitted if unknown). */
	recurring_paused?: boolean;
	vendor_id?: number;
	vendor_name?: string;
	business_meta?: TransactionBusinessMeta;
};

/** Tenant-scoped vendor (`GET/POST /api/v1/finances/vendors`). */
export type Vendor = {
	id: number;
	tenant_id: number;
	name: string;
	created_at?: string;
	updated_at?: string;
};

/** Optional 1:1 business fields for an expense. */
export type ExpenseBusinessMeta = {
	expense_id: number;
	tenant_id: number;
	invoice_ref?: string;
	notes?: string;
	/** Server-defined JSON object; shape is open-ended. */
	extra?: Record<string, unknown>;
};

/** `GET /api/v1/finances/expenses/:id` — line items may include tag objects. */
export type ExpenseDetail = {
	id: number;
	/** Present on thread-scoped expense responses; expense owner id. */
	user_id?: number;
	/** Sum of line amounts (server-computed). */
	amount?: number;
	title?: string;
	payee_text?: string;
	currency?: string;
	/** Calendar date of the expense (YYYY-MM-DD). */
	txn_date?: string;
	description?: string;
	status?: string;
	created_at?: string;
	updated_at?: string;
	items?: Array<{
		id?: number;
		name: string;
		amount: number;
		emotion?: string;
		/** Per-line memo (optional). */
		notes?: string;
		tags?: Array<{ id?: number; name: string }>;
	}>;
	recurring_id?: number;
	recurring_paused?: boolean;
	vendor_id?: number;
	vendor?: { id: number; name: string };
	business_meta?: ExpenseBusinessMeta;
};

/**
 * PUT `/api/v1/finances/expenses/:id` — send only fields to change.
 * Omitted keys are left unchanged on the server. Omit `items` to leave line items unchanged;
 * send `items` (including `[]`) to replace all lines.
 */
export type ExpensePatch = {
	description?: string;
	title?: string;
	payee_text?: string;
	currency?: string;
	/** YYYY-MM-DD. Empty string resets the server to today’s UTC calendar date. */
	txn_date?: string;
	/** Omit to leave unchanged. Allowed transitions: draft→approved, draft→cancelled. */
	status?: string;
	vendor_id?: number;
	/** When true, clears `vendor_id` on the expense. */
	vendor_id_clear?: boolean;
	business_meta?: Partial<
		Pick<ExpenseBusinessMeta, "invoice_ref" | "notes" | "extra">
	>;
	/** When true, deletes the `expense_business_meta` row. */
	business_meta_clear?: boolean;
	items?: ExpenseDetail["items"];
};

/** Parsed line proposal for a thread draft (`/thread/proposals`). */
export type ExpenseThreadItemProposal = {
	id: number;
	thread_id: number;
	space_id: number;
	proposed_by_user_id: number;
	status: "pending" | "accepted" | "rejected";
	description: string;
	items: Array<{
		name: string;
		amount: number;
		tags?: string[];
		emotion?: string;
		notes?: string;
	}>;
	/** From parser when proposal was created (dummy or live). */
	parsed_vendor_name?: string;
	parsed_payee_text?: string;
	created_at: string;
	resolved_at?: string | null;
};

/** Returned on `POST .../proposals/:id/accept` when merged lines may not match draft payee. */
export type PayeeMismatchHint = {
	mismatch: true;
	draft_payee: string;
	incoming_payee: string;
};

/** Expense-scoped discussion thread (see `POST /spaces/:spaceId/expenses/:expenseId/thread`). */
export type ExpenseThread = {
	id: number;
	space_id: number;
	expense_id: number;
	created_by_user_id: number;
	status: string;
	created_at: string;
	updated_at: string;
};

export type ExpenseThreadMessage = {
	id: number;
	thread_id: number;
	space_id: number;
	user_id: number;
	body: string;
	created_at: string;
};

/** `GET /spaces/:spaceId/expenses/:expenseId/thread` */
export type ExpenseThreadSummary = {
	thread: ExpenseThread;
	message_count: number;
	approval_count: number;
	approver_user_ids: number[];
};

export type ExpenseSplitRow = {
	expense_id: number;
	user_id: number;
	amount: number;
	created_at: string;
	updated_at: string;
};

/** `GET /spaces/:spaceId/my-share` */
export type MyShareResponse = {
	total_share: number;
	from: string;
	to: string;
	space_id: number;
};

export type ChatMessage = {
	id: string | number;
	space_id: string | number;
	user_id?: number;
	sender_type: "user" | "bot";
	direction: "in" | "out";
	message_type?:
		| "text"
		| "draft_expense"
		| "confirmed_expense"
		| "recurring_expense"
		| (string & {});
	text: string;
	telegram_message_id?: number;
	related_transaction_id?: string | number;
	related_expense_id?: string | number;
	/** From list messages: expense status for the viewer, `gone` if deleted, `inaccessible` if owned by someone else. */
	related_expense_status?: string;
	created_at?: string;
};

/** `GET /api/v1/quota` — aligns with tenant entitlements + metering fields. */
export type QuotaStatus = {
	tenant_id: number;
	limit: number;
	used: number;
	remaining: number;
	/** Plan label from server (may be arbitrary). */
	plan: string;
	max_spaces: number;
	max_members: number;
	export_enabled: boolean;
	audit_enabled: boolean;
	ai_parse_monthly_limit: number;
};

/** Outcome of `POST /api/v1/invites/:token/accept` (and WS `invites.accept`). */
export type InviteAcceptSpace = { kind: "space"; space: Space };
export type InviteAcceptTenantOnly = {
	kind: "tenant_only";
	tenant_id: number;
	target_tenant_id: number;
};
export type InviteAcceptResult = InviteAcceptSpace | InviteAcceptTenantOnly;

export const parseInviteAcceptResponse = (
	data: unknown,
): InviteAcceptResult => {
	if (typeof data !== "object" || data === null) {
		throw new Error("Invalid invite accept response");
	}
	const o = data as Record<string, unknown>;
	if ("name" in o && "id" in o) {
		return { kind: "space", space: data as Space };
	}
	const tid = o.tenant_id;
	if (tid !== undefined && tid !== null) {
		const n = typeof tid === "number" ? tid : Number(tid);
		if (!Number.isFinite(n)) {
			throw new Error("Invalid tenant_id in invite accept response");
		}
		const tt = o.target_tenant_id;
		const target =
			tt !== undefined && tt !== null
				? typeof tt === "number"
					? tt
					: Number(tt)
				: n;
		return {
			kind: "tenant_only",
			tenant_id: n,
			target_tenant_id: Number.isFinite(target) ? target : n,
		};
	}
	throw new Error("Unrecognized invite accept response shape");
};

/** `POST /api/v1/tenants/:tenantId/invites` */
export type TenantInviteCreateResponse = {
	token: string;
	expires_at: string;
	tenant_id: number;
	target_tenant_id?: number;
	invited_tenant_role?: string;
	channel?: string;
};

/** `GET /api/v1/tenants/:tenantId/members` */
export type TenantMember = {
	user_id: number;
	email?: string;
	name: string;
	role: string;
	/** True when the user has a verified email identity (`user_identities` email provider). */
	identity_verified?: boolean;
};

export type TenantMembersPage = {
	members: TenantMember[];
	limit: number;
	offset: number;
	total: number;
};

/**
 * Tenant row (`GET` read for any member, `PATCH` name requires admin+).
 * `GET /api/v1/tenants/:tenantId` · `PATCH /api/v1/tenants/:tenantId`
 */
export type Tenant = {
	id: number;
	type: string;
	name: string;
	created_at?: string;
	updated_at?: string;
};

export const NOTIFICATION_CHANNEL_KEYS = [
	"in_app",
	"telegram",
	"email",
	"push",
] as const;
export type NotificationChannelKey = (typeof NOTIFICATION_CHANNEL_KEYS)[number];

export type NotificationChannelRow = { channel: string; enabled: boolean };

export type NotificationChannelsResponse = {
	channels: NotificationChannelRow[];
};

export type NotificationChannelsMap = Record<NotificationChannelKey, boolean>;

export type NotificationChannelsPutBody = {
	channels: NotificationChannelsMap;
};

export const isNotificationChannelKey = (
	s: string,
): s is NotificationChannelKey =>
	(NOTIFICATION_CHANNEL_KEYS as readonly string[]).includes(s);

export const defaultNotificationChannelsMap = (): NotificationChannelsMap => ({
	in_app: true,
	telegram: false,
	email: false,
	push: false,
});

export const notificationChannelsMapFromResponse = (
	res: NotificationChannelsResponse,
): NotificationChannelsMap => {
	const m = defaultNotificationChannelsMap();
	for (const row of res.channels) {
		if (isNotificationChannelKey(row.channel)) {
			m[row.channel] = row.enabled;
		}
	}
	return m;
};

/** Production-safe cadences (server always accepts these). */
export const STANDARD_RECURRING_INTERVALS = [
	"daily",
	"weekly",
	"monthly",
	"yearly",
] as const;

/**
 * High-frequency test cadences — server accepts only when
 * `RECURRING_ALLOW_TEST_INTERVALS` is set or the environment is non-production.
 * @see cofi_server/internal/finances/recurring_interval.go
 */
export const TEST_RECURRING_INTERVALS = ["minute", "test"] as const;

export type StandardRecurringInterval =
	| (typeof STANDARD_RECURRING_INTERVALS)[number]
	| (typeof TEST_RECURRING_INTERVALS)[number];

/** Mirrors OpenAPI RecurringExpense; server JSON may use snake_case fields in some paths. */
export type RecurringExpense = {
	id?: number;
	user_id?: number;
	userId?: number;
	/** Telegram chat id for bot notifications; not web space_id */
	chat_id?: number;
	chatId?: number;
	space_id?: number;
	spaceId?: number;
	origin_message_id?: number;
	originMessageId?: number;
	amount?: number;
	name?: string;
	tag_label?: string;
	tagLabel?: string;
	start_date?: string;
	startDate?: string;
	interval?: string;
	next_run?: string;
	nextRun?: string;
	paused?: boolean;
};
