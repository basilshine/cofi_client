import type { components } from "./openapi-types";

export type CurrencyCode = components["schemas"]["CurrencyCode"];

export type AuthTokens = {
	accessToken: string;
	refreshToken?: string;
};

/** Structured JSON in `users.user_preferences` (versioned; optional `tax` when consented). */
export type UserFinancialPreferences = {
	weekStartsOn?: number;
	fiscalYearStartMonth?: number;
};

export type UserTaxPreferences = {
	primaryCountry?: string;
	filingIntent?: "personal" | "business" | "unspecified";
};

export type UserAppearancePreferences = {
	theme?: "ceits-editorial";
};

/** Ceits web onboarding + first-chat hints stored under `userPreferences.ceits`. */
export type CeitsUserPreferences = {
	start_context?: string;
	space_purpose?: string;
	preferred_capture_mode?: string;
	preferred_tracking_priorities?: string[];
	primary_space_id?: number;
	first_chat?: {
		space_id?: number;
		welcome_text?: string;
		quick_actions?: Array<{ id: string; label: string }>;
	};
};

export type UserPreferencesPayload = {
	version?: number;
	financial?: UserFinancialPreferences;
	tax?: UserTaxPreferences;
	appearance?: UserAppearancePreferences;
	ceits?: CeitsUserPreferences;
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
	currency?: CurrencyCode;
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
	currency: CurrencyCode;
	dateFormat: string;
	emailNotifications: boolean;
	darkMode: boolean;
	userPreferences?: UserPreferencesPayload | Record<string, unknown>;
	taxPreferencesConsent?: boolean;
};

export type Space = {
	id: string | number;
	name: string;
	/** Space reporting currency for summaries, review projections, and display. */
	currency?: CurrencyCode;
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
	/** Latest activity: chat, capture/review work, or expense changes (ISO 8601). */
	last_activity_at?: string;
	/** Space-specific UI and behavior preferences. */
	settings?: {
		appearance?: {
			theme?: "default" | "calm" | "contrast";
			accent?: string;
		};
	};
};

/** Space-scoped activity log entry (audit-backed; not chat). */
export type SpaceActivityReadState = "read" | "pending";

export type SpaceActivityActor = {
	id: number;
	display_name: string;
};

export type SpaceActivityItem = {
	id: number;
	created_at: string;
	action: string;
	entity: string;
	read_state: SpaceActivityReadState;
	actor: SpaceActivityActor;
	metadata: Record<string, unknown>;
};

export type SpaceActivityListResponse = {
	items: SpaceActivityItem[];
};

export type SpaceActivitySummary = {
	has_unread: boolean;
	unread_count: number;
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

export type SpaceParticipant = {
	id: number;
	space_id: number;
	user_id?: number | null;
	display_name: string;
	participant_type: string;
	status: string;
	email?: string;
	telegram_username?: string;
	telegram_user_id?: number | null;
	contact_data?: Record<string, unknown>;
	invitation_id?: number | null;
	linked_user_id?: number | null;
	canonical_participant_id?: number | null;
	source_document_id?: number;
	created_at: string;
	updated_at: string;
};

export type SpaceParticipantsListResponse = {
	participants: SpaceParticipant[];
	limit: number;
	offset: number;
	has_more: boolean;
	next_offset?: number | null;
};

export type PaymentMethodType =
	| "venmo"
	| "cash_app"
	| "paypal"
	| "zelle"
	| "manual";

export type PaymentObligationStatus =
	| "unpaid"
	| "sent"
	| "received"
	| "confirmed"
	| "disputed";

export type PaymentResolutionParticipant = {
	id: number;
	display_name: string;
	participant_type: string;
	status: string;
	detail?: string;
	payment_methods?: PaymentMethod[];
};

export type PaymentMethod = {
	type: PaymentMethodType | string;
	label: string;
	value: string;
	url?: string;
};

export type PaymentResolutionSummary = {
	you_owe: number;
	owed_to_you: number;
	pending_sent_payments: number;
	needs_confirmation: number;
};

export type PaymentObligation = {
	id: string;
	payer_participant: PaymentResolutionParticipant;
	recipient_participant: PaymentResolutionParticipant;
	amount: number;
	currency: CurrencyCode;
	source_expense_id: number;
	source_split_id: number;
	source_document_id?: number | null;
	source_label: string;
	source_detail: string;
	note: string;
	status: PaymentObligationStatus | string;
	payment_methods?: PaymentMethod[];
	proof_required: boolean;
	proofs: PaymentProofRef[];
};

export type PaymentProofRef = {
	id: number;
	media_id: number;
	actor_participant: PaymentResolutionParticipant;
	note?: string;
	original_filename?: string;
	content_type?: string;
	byte_size: number;
	created_at: string;
};

export type PaymentLinkContext = {
	token: string;
	token_status: string;
	proof_policy: "optional" | "required" | string;
	space_id: number;
	space_name: string;
	currency: CurrencyCode;
	expires_at: string;
	claim_required: boolean;
	selected_participant?: PaymentResolutionParticipant | null;
	eligible_participants?: PaymentResolutionParticipant[];
	summary: PaymentResolutionSummary;
	obligations: PaymentObligation[];
};

export type CreatePaymentLinkRequest = {
	space_participant_id?: number | null;
	expires_in_hours?: number | null;
	proof_policy?: "optional" | "required" | string;
};

export type CreatePaymentLinkResponse = {
	token: string;
	url: string;
	space_id: number;
	space_participant_id?: number | null;
	expires_at: string;
	proof_policy: string;
	claim_required: boolean;
	context: PaymentLinkContext;
};

export type PaymentLinkSummary = {
	id: number;
	token: string;
	url: string;
	space_id: number;
	status: string;
	proof_policy: string;
	claim_required: boolean;
	bound_participant?: PaymentResolutionParticipant | null;
	claimed_participant?: PaymentResolutionParticipant | null;
	obligation_count: number;
	snapshot_total: number;
	currency: CurrencyCode;
	unpaid_count: number;
	sent_count: number;
	confirmed_count: number;
	proof_count: number;
	sent_with_proof_count: number;
	needs_confirmation_count: number;
	missing_required_proof_count: number;
	obligations: PaymentLinkObligationRef[];
	is_outdated: boolean;
	outdated_reason?: string;
	outdated_count: number;
	expires_at: string;
	revoked_at?: string | null;
	created_at: string;
};

export type PaymentLinkObligationRef = {
	obligation_id: string;
	source_split_id: number;
	payer_participant_id: number;
	recipient_participant_id: number;
	amount: number;
	currency: CurrencyCode;
	status: PaymentObligationStatus | string;
	proof_required: boolean;
	proof_count: number;
	has_payer_proof: boolean;
	proofs: PaymentProofRef[];
};

export type PaymentLinkListResponse = {
	links: PaymentLinkSummary[];
};

export type UploadPaymentProofResponse = {
	context: PaymentLinkContext;
	proof: PaymentProofRef;
};

export type SpaceParticipantPatch = {
	display_name?: string;
	email?: string;
	telegram_username?: string;
	telegram_user_id?: number | null;
	contact_data?: Record<string, unknown>;
	status?: string;
};

export type SpaceParticipantLink = {
	canonical_participant_id?: number | null;
};

export type SpaceParticipantInviteResponse = {
	token: string;
	expires_at: string;
	participant: SpaceParticipant;
	email_delivery_status?: "sent" | "skipped" | "failed";
	email_delivery_message?: string;
};

export type InviteSuggestionUser = {
	user_id: number;
	name: string;
	email?: string;
	relationship_label?: string;
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

export type PromoCodeStatus =
	| "active"
	| "used"
	| "ignored"
	| "expired"
	| "archived";

export type PromoDiscountType =
	| "percent"
	| "fixed_amount"
	| "cashback"
	| "free_shipping"
	| "gift"
	| "unknown";

export type PromoCode = {
	id: number;
	tenant_id: number;
	space_id?: number | null;
	created_by_user_id: number;
	source_type: string;
	source_document_id?: number | null;
	source_merchant_name?: string;
	redeem_merchant_name?: string;
	redeem_platform?: string;
	promo_code?: string;
	title: string;
	description?: string;
	discount_type: PromoDiscountType | string;
	discount_value?: number | null;
	minimum_order_amount?: number | null;
	currency?: CurrencyCode;
	valid_from?: string | null;
	valid_until?: string | null;
	conditions_text?: string;
	source_text?: string;
	confidence?: number;
	status: PromoCodeStatus | string;
	reminder_at?: string | null;
	used_at?: string | null;
	created_at?: string;
	updated_at?: string;
};

export type PromoBenefitsSummary = {
	candidate_count: number;
};

export type SpacePromoListResponse = {
	promos: PromoCode[];
	summary: PromoBenefitsSummary;
	limit: number;
	offset: number;
	has_more: boolean;
	next_offset?: number | null;
};

export type SearchEntityType =
	| "space"
	| "expense"
	| "expense_item"
	| "promo_code"
	| "participant"
	| "split"
	| "recurring"
	| "source_document";

export type SearchResult = {
	id: string;
	type: SearchEntityType;
	entity_id: number;
	space_id?: number;
	space_name?: string;
	source_document_id?: number;
	title: string;
	subtitle?: string;
	detail?: string;
	href: string;
	matched_fields?: string[];
	status?: string;
	amount?: number;
	currency?: CurrencyCode;
	occurred_at?: string;
	created_at?: string;
};

export type SearchResponse = {
	query: string;
	scope: "space" | "tenant" | "all_accessible" | string;
	types: SearchEntityType[];
	total: number;
	results: SearchResult[];
};

export type CaptureCandidateCounts = {
	expenses: number;
	expense_items: number;
	benefits: number;
	people: number;
	splits: number;
	future: number;
	documents: number;
};

export type CaptureExpenseItemRecord = {
	id: number;
	name: string;
	amount: number;
	source_amount?: number | null;
	source_currency?: CurrencyCode;
	space_amount?: number | null;
	space_currency?: CurrencyCode;
};

export type CaptureExpenseRecord = {
	id: number;
	title: string;
	description?: string;
	status: string;
	currency: CurrencyCode;
	source_currency?: CurrencyCode;
	space_currency?: CurrencyCode;
	exchange_rate?: number | null;
	exchange_rate_as_of?: string | null;
	exchange_rate_provider?: string;
	converted_at?: string | null;
	rounding_mode?: string;
	currency_precision?: number | null;
	conversion_status?: string;
	currency_decision?: string;
	currency_source?: string;
	expense_date: string;
	total_amount: number;
	space_total?: number;
	created_by_user_id: number;
	items?: CaptureExpenseItemRecord[];
};

export type CaptureBenefitRecord = {
	id: number;
	title: string;
	promo_code?: string;
	source_merchant_name?: string;
	redeem_merchant_name?: string;
	redeem_platform?: string;
	discount_type?: string;
	discount_value?: number | null;
	currency?: CurrencyCode;
	valid_until?: string | null;
	status: string;
	created_by_user_id: number;
};

export type CaptureParticipantRecord = {
	id: number;
	display_name: string;
	participant_type?: string;
	status?: string;
	email?: string;
	telegram_username?: string;
	user_id?: number | null;
	linked_user_id?: number | null;
	canonical_participant_id?: number | null;
	created_by_user_id?: number | null;
};

export type CaptureSplitLineRecord = {
	id: number;
	space_participant_id?: number | null;
	display_name?: string;
	user_id?: number | null;
	amount: number;
};

export type CaptureSplitRecord = {
	expense_id: number;
	split_count: number;
	total_amount: number;
	created_by_user_id?: number | null;
	participant_lines?: CaptureSplitLineRecord[];
};

export type CaptureRecurringRecord = {
	id: number;
	name: string;
	amount: number;
	interval?: string;
	next_run?: string | null;
	paused?: boolean;
	created_by_user_id?: number | null;
};

export type CapturePacketRecords = {
	expenses?: CaptureExpenseRecord[];
	benefits?: CaptureBenefitRecord[];
	participants?: CaptureParticipantRecord[];
	splits?: CaptureSplitRecord[];
	recurring?: CaptureRecurringRecord[];
};

export type CapturePacket = {
	id: number;
	source_document_id: number;
	space_id: number;
	created_by_user_id: number;
	media_object_id?: number | null;
	title: string;
	source_type: string;
	input_kind: string;
	document_type: string;
	merchant_text?: string;
	document_date?: string | null;
	total_amount?: number | null;
	currency?: CurrencyCode;
	confidence: number;
	candidate_count: number;
	pending_count: number;
	projected_count: number;
	ignored_count: number;
	candidate_counts: CaptureCandidateCounts;
	candidate_type_counts: Record<string, number>;
	candidate_status_counts: Record<string, number>;
	latest_candidate_at?: string | null;
	records?: CapturePacketRecords;
	created_at: string;
	updated_at: string;
};

export type CapturePacketListResponse = {
	captures: CapturePacket[];
	limit?: number;
	offset?: number;
	has_more?: boolean;
	next_offset?: number | null;
};

export type SpaceExpenseListResponse = {
	expenses: ExpenseRecord[];
	limit?: number;
	offset?: number;
	has_more?: boolean;
	next_offset?: number | null;
};

export type SpaceSplitDecision = {
	expense: ExpenseRecord;
	splits: ExpenseSplitRow[];
	source_document_id?: number | null;
};

export type SpaceSplitDecisionListResponse = {
	decisions: SpaceSplitDecision[];
	limit?: number;
	offset?: number;
	has_more?: boolean;
	next_offset?: number | null;
};

export type DocumentCandidateType =
	| "expense_candidate"
	| "expense_item_candidate"
	| "promo_code_candidate"
	| "loyalty_event_candidate"
	| "payment_proof_candidate"
	| "privacy_signal_candidate"
	| "recurring_candidate"
	| "membership_candidate"
	| "reminder_candidate"
	| "merge_candidate"
	| "supporting_document_candidate"
	| "split_candidate"
	| "participant_placeholder_candidate";

export type DocumentCandidateStatus =
	| "pending_review"
	| "confirmed"
	| "ignored"
	| "merged"
	| "projected"
	| "expired";

export type DocumentCandidate = {
	id: number;
	tenant_id: number;
	source_document_id: number;
	projected_expense_id?: number | null;
	candidate_type: DocumentCandidateType | string;
	title: string;
	structured_data?: Record<string, unknown>;
	confidence: number;
	status: DocumentCandidateStatus | string;
	created_at: string;
	resolved_at?: string | null;
	source_type: string;
	input_kind: string;
	document_type: string;
	merchant_text?: string;
	document_date?: string | null;
	total_amount?: number | null;
	currency?: CurrencyCode;
};

export type DocumentCandidateListResponse = {
	candidates: DocumentCandidate[];
};

export type DocumentCandidateState = {
	id: number;
	status: string;
};

export type DeleteSourceDocumentReviewResponse = {
	source_document_id: number;
	deleted: boolean;
};

export type CreateParticipantCandidateResponse = {
	participant: SpaceParticipant;
	candidate: DocumentCandidateState;
};

export type CreateRecurringCandidateResponse = {
	recurring: RecurringExpense;
	candidate: DocumentCandidateState;
};

export type CurrencyDecisionRequest = {
	transaction_currency?: "space" | "source" | "custom";
	custom_currency?: CurrencyCode;
	source_amount?: number;
	source_currency?: CurrencyCode;
};

export type CreateExpenseCandidateRequest = {
	currency_decision?: CurrencyDecisionRequest;
};

export type CreateExpenseCandidateResponse = {
	expense: ExpenseDetail;
	candidate: DocumentCandidateState;
};

export type ApplySplitCandidateResponse = {
	expense_id: number;
	split_count: number;
	candidate: DocumentCandidateState;
};

export type SavePromoCandidateResponse = {
	promo: PromoCode;
	candidate: DocumentCandidateState;
};

export type PatchPromoCodeRequest = {
	title?: string;
	description?: string;
	status?: PromoCodeStatus | string;
	reminder_at?: string;
	used_at?: string;
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

export type ExpenseRecordItem = {
	amount: number;
	source_amount?: number | null;
	source_currency?: CurrencyCode;
	space_amount?: number | null;
	space_currency?: CurrencyCode;
	name: string;
	emotion?: string;
	tags?: string[];
	/** Optional memo for this line only (distinct from expense-level business notes). */
	notes?: string;
	expense_date?: string;
};

/** Optional business fields on an expense record (mirrors expense `business_meta`). */
export type ExpenseRecordBusinessMeta = {
	invoice_ref?: string;
	notes?: string;
};

export type ExpenseRecord = {
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
	currency?: CurrencyCode;
	source_currency?: CurrencyCode;
	space_currency?: CurrencyCode;
	exchange_rate?: number | null;
	exchange_rate_as_of?: string | null;
	exchange_rate_provider?: string;
	converted_at?: string | null;
	rounding_mode?: string;
	currency_precision?: number | null;
	conversion_status?: string;
	currency_decision?: string;
	currency_source?: string;
	/** Calendar date of the expense (YYYY-MM-DD). */
	expense_date?: string;
	items: ExpenseRecordItem[];
	total: number;
	/** Total in Space reporting currency; falls back to total for legacy rows without space amounts. */
	space_total?: number;
	created_at?: string;
	/** Capture/source document that created this expense record, when available. */
	source_document_id?: number;
	/** Present when this posting was generated from a recurring schedule. */
	recurring_id?: number;
	/** Whether that schedule is currently paused (omitted if unknown). */
	recurring_paused?: boolean;
	vendor_id?: number;
	vendor_name?: string;
	business_meta?: ExpenseRecordBusinessMeta;
};

/** Tenant-scoped vendor managed through a Space vendor catalog. */
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

/** `GET /api/v1/spaces/:spaceId/expenses/:expenseId` — line items may include tag objects. */
export type ExpenseDetail = {
	id: number;
	/** Present on space-scoped expense responses; expense owner id. */
	user_id?: number;
	/** Sum of line amounts (server-computed). */
	amount?: number;
	source_currency?: CurrencyCode;
	space_currency?: CurrencyCode;
	exchange_rate?: number | null;
	exchange_rate_as_of?: string | null;
	exchange_rate_provider?: string;
	converted_at?: string | null;
	rounding_mode?: string;
	currency_precision?: number | null;
	conversion_status?: string;
	currency_decision?: string;
	currency_source?: string;
	title?: string;
	payee_text?: string;
	currency?: CurrencyCode;
	/** Calendar date of the expense (YYYY-MM-DD). */
	expense_date?: string;
	description?: string;
	status?: string;
	created_at?: string;
	updated_at?: string;
	/** Capture/source document that created this expense record, when available. */
	source_document_id?: number;
	items?: Array<{
		id?: number;
		name: string;
		amount: number;
		source_amount?: number | null;
		source_currency?: CurrencyCode;
		space_amount?: number | null;
		space_currency?: CurrencyCode;
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
 * PUT `/api/v1/spaces/:spaceId/expenses/:expenseId` — send only fields to change.
 * Omitted keys are left unchanged on the server. Omit `items` to leave line items unchanged;
 * send `items` (including `[]`) to replace all lines.
 */
export type ExpensePatch = {
	description?: string;
	title?: string;
	payee_text?: string;
	currency?: CurrencyCode;
	/** YYYY-MM-DD. Empty string resets the server to today’s UTC calendar date. */
	expense_date?: string;
	/** Omit to leave unchanged. Saved records can be marked approved or cancelled. */
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

export type ExpenseSplitRow = {
	user_id?: number | null;
	space_participant_id?: number | null;
	participant?: SpaceParticipant | null;
	source_document_id?: number;
	amount: number;
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
		| "confirmed_expense"
		| "recurring_expense"
		| (string & {});
	text: string;
	telegram_message_id?: number;
	related_expense_id?: string | number;
	/** From list messages: expense status for the viewer, `gone` if deleted, `inaccessible` if owned by someone else. */
	related_expense_status?: string;
	media_id?: string | number;
	media_kind?: "image" | "voice" | (string & {});
	media_content_type?: string;
	media_filename?: string;
	source_document_id?: string | number;
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
	capture_monthly_limit: number;
	capabilities?: CapabilitySummary;
};

export type CaptureProfileCapability = {
	profile: "basic" | "smart" | "deep" | (string & {});
	cost_class: "low" | "medium" | "high" | (string & {});
	quota_units: number;
};

export type CaptureCapabilities = {
	max_profile: "basic" | "smart" | "deep" | (string & {});
	deep_allowed: boolean;
	text: CaptureProfileCapability;
	image: CaptureProfileCapability;
	voice: CaptureProfileCapability;
	deep_request: CaptureProfileCapability;
	deep_request_downgraded_to?: string;
	deep_request_reason?: string;
};

export type CapabilitySummary = {
	plan: "basic" | "medium" | "premium" | (string & {});
	capture: CaptureCapabilities;
	features: Record<string, boolean>;
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
	if (o.kind === "space" && typeof o.space === "object" && o.space !== null) {
		return { kind: "space", space: o.space as Space };
	}
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
	source_document_id?: number;
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

export type SpaceRecurringListResponse = {
	recurring: RecurringExpense[];
	limit: number;
	offset: number;
	has_more: boolean;
	next_offset?: number | null;
};
