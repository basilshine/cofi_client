import type { DashboardResponse, DashboardVariant } from "./dashboard";
import {
	type ApplySplitCandidateResponse,
	type BenefitCandidateListResponse,
	type CapturePacketListResponse,
	type ChatMessage,
	type CreateParticipantCandidateResponse,
	type CreatePaymentLinkRequest,
	type CreatePaymentLinkResponse,
	type CreatePromoCodeRequest,
	type CreateRecurringCandidateResponse,
	type DeleteSourceDocumentReviewResponse,
	type DocumentCandidateListResponse,
	type DocumentCandidateState,
	type Draft,
	type ExpenseDetail,
	type ExpensePatch,
	type ExpenseSplitRow,
	type InviteAcceptResult,
	type MyPendingInvitesResponse,
	type MyShareResponse,
	type NotificationChannelsPutBody,
	type NotificationChannelsResponse,
	type PatchPromoCodeRequest,
	type PaymentLinkContext,
	type PaymentLinkListResponse,
	type PaymentLinkSummary,
	type ProfileUpdateRequest,
	type PromoCode,
	type QuotaStatus,
	type RecurringExpense,
	type SaveBenefitCandidatePromoResponse,
	type SearchEntityType,
	type SearchResponse,
	type Space,
	type SpaceActivityListResponse,
	type SpaceActivitySummary,
	type SpaceInviteCreateResponse,
	type SpaceInviteSuggestionsResponse,
	type SpaceMember,
	type SpaceMembersListResponse,
	type SpaceParticipant,
	type SpaceParticipantInviteResponse,
	type SpaceParticipantLink,
	type SpaceParticipantPatch,
	type SpaceParticipantsListResponse,
	type SpacePromoListResponse,
	type SpaceRole,
	type Tenant,
	type TenantInviteCreateResponse,
	type TenantInvitesListResponse,
	type TenantMembersPage,
	type Transaction,
	type UploadPaymentProofResponse,
	type User,
	type Vendor,
	parseInviteAcceptResponse,
} from "./types";

type FetchJsonOptions = {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	headers?: Record<string, string>;
};

const fetchJson = async <T>(
	url: string,
	options: FetchJsonOptions,
): Promise<T> => {
	const res = await fetch(url, {
		method: options.method ?? "GET",
		headers: {
			"Content-Type": "application/json",
			...(options.headers ?? {}),
		},
		body: options.body === undefined ? undefined : JSON.stringify(options.body),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
	}

	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
};

const fetchFormJson = async <T>(
	url: string,
	formData: FormData,
	headers?: Record<string, string>,
): Promise<T> => {
	const res = await fetch(url, {
		method: "POST",
		headers: headers ?? {},
		body: formData,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
	}
	return (await res.json()) as T;
};

export type ApiClientConfig = {
	baseUrl: string;
	getAccessToken?: () => string | null;
	/**
	 * When set, sent as `X-Tenant-Id` on routes that use verified-tenant context (e.g. quota).
	 * Only return a tenant the user explicitly selected; the server rejects invalid IDs.
	 */
	getTenantId?: () => string | number | null;
};

export const createApiClient = (config: ApiClientConfig) => {
	const withBase = (path: string) => `${config.baseUrl}${path}`;

	const authHeaders = () => {
		const token = config.getAccessToken?.() ?? null;
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		return headers;
	};

	const quotaHeaders = (opts?: {
		tenantId?: string | number | null;
	}) => {
		const headers = { ...authHeaders() };
		const tid =
			opts?.tenantId !== undefined
				? opts.tenantId
				: (config.getTenantId?.() ?? null);
		if (tid != null) headers["X-Tenant-Id"] = String(tid);
		return headers;
	};

	return {
		/**
		 * Consolidated dashboard payload (`GET /api/v1/dashboard`).
		 * TODO: Confirm backend availability per environment — endpoint may 404 until implemented.
		 */
		dashboard: {
			get: (params?: {
				variant?: DashboardVariant;
				tenant_id?: number | null;
				/** day | month | year — spend summary window (default month). */
				period?: "day" | "month" | "year";
				/** YYYY-MM-DD UTC anchor for the window. */
				on?: string;
				/** Focus space for “your share in this space” in the summary. */
				space_id?: number | null;
			}) => {
				const qs = new URLSearchParams();
				if (params?.variant != null) qs.set("variant", params.variant);
				if (params?.tenant_id != null)
					qs.set("tenant_id", String(params.tenant_id));
				if (params?.period != null) qs.set("period", params.period);
				if (params?.on != null && params.on.trim() !== "")
					qs.set("on", params.on.trim());
				if (params?.space_id != null && params.space_id > 0)
					qs.set("space_id", String(params.space_id));
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<DashboardResponse>(withBase(`/api/v1/dashboard${q}`), {
					method: "GET",
					headers: quotaHeaders({ tenantId: params?.tenant_id }),
				});
			},
		},

		search: {
			get: (params?: {
				q?: string;
				scope?: "all" | "space" | "tenant" | string;
				spaceId?: string | number | null;
				types?: Array<SearchEntityType | string> | string;
				limit?: number;
			}) => {
				const qs = new URLSearchParams();
				if (params?.q != null && params.q.trim() !== "") {
					qs.set("q", params.q.trim());
				}
				if (params?.scope != null && params.scope.trim() !== "") {
					qs.set("scope", params.scope.trim());
				}
				if (params?.spaceId != null) {
					qs.set("spaceId", String(params.spaceId));
				}
				if (params?.types != null) {
					const types = Array.isArray(params.types)
						? params.types.join(",")
						: params.types;
					if (types.trim() !== "") qs.set("types", types.trim());
				}
				if (params?.limit != null && params.limit > 0) {
					qs.set("limit", String(params.limit));
				}
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<SearchResponse>(withBase(`/api/v1/search${q}`), {
					method: "GET",
					headers: quotaHeaders(),
				});
			},
		},

		paymentLinks: {
			list: (spaceId: string | number) =>
				fetchJson<PaymentLinkListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/payment-links`),
					{
						method: "GET",
						headers: authHeaders(),
					},
				),
			verify: (token: string) =>
				fetchJson<PaymentLinkContext>(
					withBase(
						`/api/v1/payment-links/${encodeURIComponent(String(token))}`,
					),
					{ method: "GET" },
				),
			claimParticipant: (token: string, spaceParticipantId: number) =>
				fetchJson<PaymentLinkContext>(
					withBase(
						`/api/v1/payment-links/${encodeURIComponent(String(token))}/claim-participant`,
					),
					{
						method: "POST",
						body: { space_participant_id: spaceParticipantId },
					},
				),
			markSent: (token: string, obligationId: string) =>
				fetchJson<PaymentLinkContext>(
					withBase(
						`/api/v1/payment-links/${encodeURIComponent(String(token))}/mark-sent`,
					),
					{
						method: "POST",
						body: { obligation_id: obligationId },
					},
				),
			markReceived: (token: string, obligationId: string) =>
				fetchJson<PaymentLinkContext>(
					withBase(
						`/api/v1/payment-links/${encodeURIComponent(String(token))}/mark-received`,
					),
					{
						method: "POST",
						body: { obligation_id: obligationId },
					},
				),
			uploadProof: (token: string, formData: FormData) =>
				fetchFormJson<UploadPaymentProofResponse>(
					withBase(
						`/api/v1/payment-links/${encodeURIComponent(String(token))}/proofs`,
					),
					formData,
				),
			create: (spaceId: string | number, payload?: CreatePaymentLinkRequest) =>
				fetchJson<CreatePaymentLinkResponse>(
					withBase(`/api/v1/spaces/${spaceId}/payment-links`),
					{
						method: "POST",
						headers: authHeaders(),
						body: payload ?? {},
					},
				),
			revoke: (spaceId: string | number, linkId: string | number) =>
				fetchJson<PaymentLinkSummary>(
					withBase(`/api/v1/spaces/${spaceId}/payment-links/${linkId}`),
					{
						method: "DELETE",
						headers: authHeaders(),
					},
				),
		},

		auth: {
			login: (payload: { email: string; password: string }) =>
				fetchJson<{ token: string; refreshToken?: string; user: User }>(
					withBase("/api/v1/auth/login"),
					{ method: "POST", body: payload },
				),
			register: (payload: {
				email: string;
				password: string;
				name: string;
				country: string;
				language: string;
			}) =>
				fetchJson<{ token: string; refreshToken?: string; user: User }>(
					withBase("/api/v1/auth/register"),
					{ method: "POST", body: payload },
				),
			me: () =>
				fetchJson<User>(withBase("/api/v1/auth/me"), {
					method: "GET",
					headers: authHeaders(),
				}),
			updateProfile: (payload: ProfileUpdateRequest) =>
				fetchJson<User>(withBase("/api/v1/auth/profile"), {
					method: "PUT",
					headers: authHeaders(),
					body: payload,
				}),
			refresh: (payload: { refresh_token: string }) =>
				fetchJson<{
					token: string;
					refreshToken?: string;
					refresh_token?: string;
				}>(withBase("/api/v1/auth/refresh"), { method: "POST", body: payload }),
		},

		spaces: {
			/**
			 * List spaces the user belongs to.
			 * - Omit `params` or pass `{}`: legacy — may send `X-Tenant-Id` from `getTenantId()` (session org).
			 * - `{ tenantId: N }`: filter to that tenant (query + header when used with quota middleware).
			 * - `{ tenantId: null }`: **all tenants** — no `tenant_id` query, no `X-Tenant-Id` header (shows every space you are a member of).
			 */
			list: (params?: { tenantId?: number | null }) => {
				const qs = new URLSearchParams();
				if (params?.tenantId != null) {
					qs.set("tenant_id", String(params.tenantId));
				}
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<Space[]>(withBase(`/api/v1/spaces${q}`), {
					method: "GET",
					headers: quotaHeaders(
						params !== undefined ? { tenantId: params.tenantId } : {},
					),
				});
			},
			create: (payload: { name: string }) =>
				fetchJson<Space>(withBase("/api/v1/spaces"), {
					method: "POST",
					headers: authHeaders(),
					body: payload,
				}),
			patch: (
				spaceId: string | number,
				payload: { name?: string; description?: string },
			) =>
				fetchJson<Space>(withBase(`/api/v1/spaces/${spaceId}`), {
					method: "PATCH",
					headers: authHeaders(),
					body: payload,
				}),
			patchSettings: (
				spaceId: string | number,
				payload: {
					settings: {
						appearance?: {
							theme?: "default" | "calm" | "contrast";
							accent?: string;
						};
					};
				},
			) =>
				fetchJson<Space>(withBase(`/api/v1/spaces/${spaceId}/settings`), {
					method: "PATCH",
					headers: authHeaders(),
					body: payload,
				}),
			clone: (spaceId: string | number) =>
				fetchJson<Space>(withBase(`/api/v1/spaces/${spaceId}/clone`), {
					method: "POST",
					headers: authHeaders(),
				}),
			delete: (spaceId: string | number) =>
				fetchJson<void>(withBase(`/api/v1/spaces/${spaceId}`), {
					method: "DELETE",
					headers: authHeaders(),
				}),
			listMembers: (spaceId: string | number) =>
				fetchJson<SpaceMembersListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/members`),
					{
						method: "GET",
						headers: authHeaders(),
					},
				),
			listParticipants: (spaceId: string | number) =>
				fetchJson<SpaceParticipantsListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/participants`),
					{
						method: "GET",
						headers: authHeaders(),
					},
				),
			listCapturePackets: (
				spaceId: string | number,
				params?: {
					includeRecords?: boolean;
					limit?: number;
					sourceDocumentId?: number;
				},
			) => {
				const qs = new URLSearchParams();
				if (params?.limit != null && params.limit > 0) {
					qs.set("limit", String(params.limit));
				}
				if (params?.includeRecords) {
					qs.set("include_records", "true");
				}
				if (params?.sourceDocumentId != null && params.sourceDocumentId > 0) {
					qs.set("source_document_id", String(params.sourceDocumentId));
				}
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<CapturePacketListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/captures${q}`),
					{
						method: "GET",
						headers: authHeaders(),
					},
				);
			},
			patchParticipant: (
				spaceId: string | number,
				participantId: string | number,
				payload: SpaceParticipantPatch,
			) =>
				fetchJson<SpaceParticipant>(
					withBase(
						`/api/v1/spaces/${spaceId}/participants/${encodeURIComponent(String(participantId))}`,
					),
					{
						method: "PATCH",
						headers: authHeaders(),
						body: payload,
					},
				),
			deleteParticipant: (
				spaceId: string | number,
				participantId: string | number,
			) =>
				fetchJson<void>(
					withBase(
						`/api/v1/spaces/${spaceId}/participants/${encodeURIComponent(String(participantId))}`,
					),
					{
						method: "DELETE",
						headers: authHeaders(),
					},
				),
			linkParticipant: (
				spaceId: string | number,
				participantId: string | number,
				payload: SpaceParticipantLink,
			) =>
				fetchJson<SpaceParticipant>(
					withBase(
						`/api/v1/spaces/${spaceId}/participants/${encodeURIComponent(String(participantId))}/link`,
					),
					{
						method: "POST",
						headers: authHeaders(),
						body: payload,
					},
				),
			inviteParticipant: (
				spaceId: string | number,
				participantId: string | number,
			) =>
				fetchJson<SpaceParticipantInviteResponse>(
					withBase(
						`/api/v1/spaces/${spaceId}/participants/${encodeURIComponent(String(participantId))}/invite`,
					),
					{
						method: "POST",
						headers: authHeaders(),
					},
				),
			/** Requires tenant admin + space owner; cannot change the space owner’s role. */
			patchMemberRole: (
				spaceId: string | number,
				userId: string | number,
				payload: { role: SpaceRole },
			) =>
				fetchJson<SpaceMember>(
					withBase(
						`/api/v1/spaces/${spaceId}/members/${encodeURIComponent(String(userId))}`,
					),
					{
						method: "PATCH",
						headers: authHeaders(),
						body: payload,
					},
				),
			/** Remove a member from this space (not the space owner). Tenant admin + space owner. */
			removeMember: (spaceId: string | number, userId: string | number) =>
				fetchJson<void>(
					withBase(
						`/api/v1/spaces/${spaceId}/members/${encodeURIComponent(String(userId))}`,
					),
					{
						method: "DELETE",
						headers: authHeaders(),
					},
				),
			/** Aggregate split amounts for the current user (JWT) in a space over a date range. */
			myShare: (
				spaceId: string | number,
				params: { from: string; to: string },
			) => {
				const qs = new URLSearchParams({
					from: params.from,
					to: params.to,
				});
				return fetchJson<MyShareResponse>(
					withBase(`/api/v1/spaces/${spaceId}/my-share?${qs}`),
					{ method: "GET", headers: authHeaders() },
				);
			},
			createInvite: (spaceId: string | number, payload: { email: string }) =>
				fetchJson<SpaceInviteCreateResponse>(
					withBase(`/api/v1/spaces/${spaceId}/invites`),
					{
						method: "POST",
						headers: authHeaders(),
						body: payload,
					},
				),
			/** Rotate token + extend expiry for one of your pending space invites. */
			resendSpaceInvite: (
				spaceId: string | number,
				inviteId: string | number,
				opts?: { tenantId?: string | number | null },
			) =>
				fetchJson<{ token: string; expires_at: string }>(
					withBase(
						`/api/v1/spaces/${spaceId}/invites/${encodeURIComponent(String(inviteId))}/resend`,
					),
					{
						method: "POST",
						headers: quotaHeaders({ tenantId: opts?.tenantId }),
					},
				),
			cancelSpaceInvite: (
				spaceId: string | number,
				inviteId: string | number,
				opts?: { tenantId?: string | number | null },
			) =>
				fetchJson<void>(
					withBase(
						`/api/v1/spaces/${spaceId}/invites/${encodeURIComponent(String(inviteId))}`,
					),
					{
						method: "DELETE",
						headers: quotaHeaders({ tenantId: opts?.tenantId }),
					},
				),
			/** Actor-circle peers not in this space + your pending email invites; requires tenant admin + space owner. */
			inviteSuggestions: (
				spaceId: string | number,
				opts?: { q?: string; tenantId?: string | number | null },
			) => {
				const qs = new URLSearchParams();
				if (opts?.q != null && opts.q.trim() !== "") qs.set("q", opts.q.trim());
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<SpaceInviteSuggestionsResponse>(
					withBase(`/api/v1/spaces/${spaceId}/invite-suggestions${q}`),
					{
						method: "GET",
						headers: quotaHeaders({ tenantId: opts?.tenantId }),
					},
				);
			},
			activity: {
				list: (spaceId: string | number, opts?: { limit?: number }) => {
					const qs = new URLSearchParams();
					if (opts?.limit != null && opts.limit > 0) {
						qs.set("limit", String(opts.limit));
					}
					const q = qs.size ? `?${qs.toString()}` : "";
					return fetchJson<SpaceActivityListResponse>(
						withBase(`/api/v1/spaces/${spaceId}/activity${q}`),
						{ method: "GET", headers: authHeaders() },
					);
				},
				summary: (spaceId: string | number) =>
					fetchJson<SpaceActivitySummary>(
						withBase(`/api/v1/spaces/${spaceId}/activity/summary`),
						{ method: "GET", headers: authHeaders() },
					),
				markRead: (
					spaceId: string | number,
					payload: { up_to_audit_event_id: number },
				) =>
					fetchJson<void>(withBase(`/api/v1/spaces/${spaceId}/activity/read`), {
						method: "PUT",
						headers: authHeaders(),
						body: payload,
					}),
			},
			recurring: {
				list: (spaceId: string | number) =>
					fetchJson<RecurringExpense[]>(
						withBase(`/api/v1/spaces/${spaceId}/recurring`),
						{
							method: "GET",
							headers: authHeaders(),
						},
					),
				create: (spaceId: string | number, body: RecurringExpense) =>
					fetchJson<RecurringExpense>(
						withBase(`/api/v1/spaces/${spaceId}/recurring`),
						{
							method: "POST",
							headers: authHeaders(),
							body,
						},
					),
				update: (
					spaceId: string | number,
					id: string | number,
					body: RecurringExpense,
				) =>
					fetchJson<RecurringExpense>(
						withBase(
							`/api/v1/spaces/${spaceId}/recurring/${encodeURIComponent(String(id))}`,
						),
						{
							method: "PUT",
							headers: authHeaders(),
							body,
						},
					),
				pause: (spaceId: string | number, id: string | number) =>
					fetchJson<RecurringExpense>(
						withBase(
							`/api/v1/spaces/${spaceId}/recurring/${encodeURIComponent(String(id))}/pause`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				resume: (spaceId: string | number, id: string | number) =>
					fetchJson<RecurringExpense>(
						withBase(
							`/api/v1/spaces/${spaceId}/recurring/${encodeURIComponent(String(id))}/resume`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				remove: (
					spaceId: string | number,
					id: string | number,
					opts?: { purgeExpenses?: boolean },
				) => {
					const qs = opts?.purgeExpenses === true ? "?purge_expenses=1" : "";
					return fetchJson<void>(
						withBase(
							`/api/v1/spaces/${spaceId}/recurring/${encodeURIComponent(String(id))}${qs}`,
						),
						{
							method: "DELETE",
							headers: authHeaders(),
						},
					);
				},
			},
			/** Incoming invites for your login email (e.g. org member invited to a space). */
			listPendingInvitesForMe: () =>
				fetchJson<MyPendingInvitesResponse>(
					withBase("/api/v1/invites/pending-for-me"),
					{ method: "GET", headers: authHeaders() },
				),
			declineMyInvite: (inviteId: string | number) =>
				fetchJson<void>(
					withBase(
						`/api/v1/invites/decline/${encodeURIComponent(String(inviteId))}`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			acceptInvite: async (token: string): Promise<InviteAcceptResult> => {
				const trimmed = token.trim();
				const res = await fetch(
					withBase(`/api/v1/invites/${encodeURIComponent(trimmed)}/accept`),
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...authHeaders(),
						},
					},
				);
				if (!res.ok) {
					const text = await res.text().catch(() => "");
					throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
				}
				const json: unknown = await res.json();
				return parseInviteAcceptResponse(json);
			},
			/** Owner-only; gated by `ALLOW_HARD_PURGE_ALL_MESSAGES` in production. */
			hardPurgeAllMessages: (spaceId: string | number) =>
				fetchJson<{ deleted: number }>(
					withBase(`/api/v1/spaces/${spaceId}/messages/all`),
					{
						method: "DELETE",
						headers: authHeaders(),
					},
				),
			/** Soft-delete one message (owner: any line; member: own user messages only). */
			deleteMessage: (spaceId: string | number, messageId: string | number) =>
				fetchJson<void>(
					withBase(`/api/v1/spaces/${spaceId}/messages/${messageId}`),
					{
						method: "DELETE",
						headers: authHeaders(),
					},
				),
			/** Update text on your own user message. */
			updateMessage: (
				spaceId: string | number,
				messageId: string | number,
				payload: { text: string },
			) =>
				fetchJson<ChatMessage>(
					withBase(`/api/v1/spaces/${spaceId}/messages/${messageId}`),
					{
						method: "PATCH",
						headers: authHeaders(),
						body: payload,
					},
				),
			/** Distinct tag names on approved expenses linked to this space (not limited to transaction list page size). */
			listTransactionTags: (spaceId: string | number) =>
				fetchJson<{ tags: string[] }>(
					withBase(`/api/v1/spaces/${spaceId}/transaction-tags`),
					{
						method: "GET",
						headers: authHeaders(),
					},
				),
			/**
			 * Expense records linked to this space, including drafts.
			 * @deprecated Use `spaces.expenses.list` for space expense records.
			 */
			listTransactions: (
				spaceId: string | number,
				params?: { limit?: number },
			) => {
				const qs = params?.limit
					? `?limit=${encodeURIComponent(String(params.limit))}`
					: "";
				return fetchJson<Transaction[]>(
					withBase(`/api/v1/spaces/${spaceId}/expenses${qs}`),
					{ method: "GET", headers: authHeaders() },
				);
			},
			listPromos: (spaceId: string | number) =>
				fetchJson<SpacePromoListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/benefits/promos`),
					{ method: "GET", headers: authHeaders() },
				),
			createPromo: (spaceId: string | number, body: CreatePromoCodeRequest) =>
				fetchJson<PromoCode>(
					withBase(`/api/v1/spaces/${spaceId}/benefits/promos`),
					{ method: "POST", headers: authHeaders(), body },
				),
			patchPromo: (
				spaceId: string | number,
				promoId: string | number,
				body: PatchPromoCodeRequest,
			) =>
				fetchJson<PromoCode>(
					withBase(
						`/api/v1/spaces/${spaceId}/benefits/promos/${encodeURIComponent(String(promoId))}`,
					),
					{ method: "PATCH", headers: authHeaders(), body },
				),
			deletePromo: (spaceId: string | number, promoId: string | number) =>
				fetchJson<void>(
					withBase(
						`/api/v1/spaces/${spaceId}/benefits/promos/${encodeURIComponent(String(promoId))}`,
					),
					{ method: "DELETE", headers: authHeaders() },
				),
			expenses: {
				list: (spaceId: string | number, params?: { limit?: number }) => {
					const qs = params?.limit
						? `?limit=${encodeURIComponent(String(params.limit))}`
						: "";
					return fetchJson<Transaction[]>(
						withBase(`/api/v1/spaces/${spaceId}/expenses${qs}`),
						{ method: "GET", headers: authHeaders() },
					);
				},
				get: (spaceId: string | number, expenseId: string | number) =>
					fetchJson<ExpenseDetail>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}`),
						{ method: "GET", headers: authHeaders() },
					),
				update: (
					spaceId: string | number,
					expenseId: string | number,
					body: ExpensePatch,
				) =>
					fetchJson<ExpenseDetail>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}`),
						{
							method: "PUT",
							headers: authHeaders(),
							body,
						},
					),
				delete: (spaceId: string | number, expenseId: string | number) =>
					fetchJson<void>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}`),
						{
							method: "DELETE",
							headers: authHeaders(),
						},
					),
				confirm: (spaceId: string | number, expenseId: string | number) =>
					fetchJson<{ message: string }>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}/confirm`),
						{ method: "POST", headers: authHeaders() },
					),
				cancel: (spaceId: string | number, expenseId: string | number) =>
					fetchJson<{ message: string }>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}/cancel`),
						{ method: "POST", headers: authHeaders() },
					),
				listSplits: (spaceId: string | number, expenseId: string | number) =>
					fetchJson<{ splits: ExpenseSplitRow[] }>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}/splits`),
						{ method: "GET", headers: authHeaders() },
					),
				putSplits: (
					spaceId: string | number,
					expenseId: string | number,
					lines: Array<{
						user_id?: number | null;
						space_participant_id?: number | null;
						amount: number;
					}>,
				) =>
					fetchJson<void>(
						withBase(`/api/v1/spaces/${spaceId}/expenses/${expenseId}/splits`),
						{
							method: "PUT",
							headers: authHeaders(),
							body: lines,
						},
					),
			},
			review: {
				listBenefitCandidates: (
					spaceId: string | number,
					params?: { limit?: number; sourceDocumentId?: string | number },
				) => {
					const search = new URLSearchParams();
					if (params?.limit != null) search.set("limit", String(params.limit));
					if (params?.sourceDocumentId != null) {
						search.set("source_document_id", String(params.sourceDocumentId));
					}
					const qs = search.toString() ? `?${search.toString()}` : "";
					return fetchJson<BenefitCandidateListResponse>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/benefit-candidates${qs}`,
						),
						{ method: "GET", headers: authHeaders() },
					);
				},
				saveBenefitCandidatePromo: (
					spaceId: string | number,
					candidateId: string | number,
				) =>
					fetchJson<SaveBenefitCandidatePromoResponse>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/benefit-candidates/${encodeURIComponent(String(candidateId))}/save-promo`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				ignoreBenefitCandidate: (
					spaceId: string | number,
					candidateId: string | number,
				) =>
					fetchJson<{ id: number; status: string }>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/benefit-candidates/${encodeURIComponent(String(candidateId))}/ignore`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				listDocumentCandidates: (
					spaceId: string | number,
					params?: { limit?: number; sourceDocumentId?: string | number },
				) => {
					const search = new URLSearchParams();
					if (params?.limit != null) search.set("limit", String(params.limit));
					if (params?.sourceDocumentId != null) {
						search.set("source_document_id", String(params.sourceDocumentId));
					}
					const qs = search.toString() ? `?${search.toString()}` : "";
					return fetchJson<DocumentCandidateListResponse>(
						withBase(`/api/v1/spaces/${spaceId}/review/candidates${qs}`),
						{ method: "GET", headers: authHeaders() },
					);
				},
				ignoreDocumentCandidate: (
					spaceId: string | number,
					candidateId: string | number,
				) =>
					fetchJson<DocumentCandidateState>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/ignore`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				confirmDocumentCandidate: (
					spaceId: string | number,
					candidateId: string | number,
				) =>
					fetchJson<DocumentCandidateState>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/confirm`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				createParticipantFromCandidate: (
					spaceId: string | number,
					candidateId: string | number,
				) =>
					fetchJson<CreateParticipantCandidateResponse>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/create-participant`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				createRecurringFromCandidate: (
					spaceId: string | number,
					candidateId: string | number,
				) =>
					fetchJson<CreateRecurringCandidateResponse>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/create-recurring`,
						),
						{ method: "POST", headers: authHeaders() },
					),
				applySplitCandidate: (
					spaceId: string | number,
					candidateId: string | number,
					payload: { expense_id: string | number },
				) =>
					fetchJson<ApplySplitCandidateResponse>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/apply-split`,
						),
						{ method: "POST", headers: authHeaders(), body: payload },
					),
				deleteSourceDocumentReview: (
					spaceId: string | number,
					sourceDocumentId: string | number,
				) =>
					fetchJson<DeleteSourceDocumentReviewResponse>(
						withBase(
							`/api/v1/spaces/${spaceId}/review/captures/${encodeURIComponent(String(sourceDocumentId))}`,
						),
						{ method: "DELETE", headers: authHeaders() },
					),
			},
			/** @deprecated Use `spaces.review.listBenefitCandidates`. */
			listBenefitCandidates: (
				spaceId: string | number,
				params?: { limit?: number; sourceDocumentId?: string | number },
			) => {
				const search = new URLSearchParams();
				if (params?.limit != null) search.set("limit", String(params.limit));
				if (params?.sourceDocumentId != null) {
					search.set("source_document_id", String(params.sourceDocumentId));
				}
				const qs = search.toString() ? `?${search.toString()}` : "";
				return fetchJson<BenefitCandidateListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/review/benefit-candidates${qs}`),
					{ method: "GET", headers: authHeaders() },
				);
			},
			/** @deprecated Use `spaces.review.saveBenefitCandidatePromo`. */
			saveBenefitCandidatePromo: (
				spaceId: string | number,
				candidateId: string | number,
			) =>
				fetchJson<SaveBenefitCandidatePromoResponse>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/benefit-candidates/${encodeURIComponent(String(candidateId))}/save-promo`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			/** @deprecated Use `spaces.review.ignoreBenefitCandidate`. */
			ignoreBenefitCandidate: (
				spaceId: string | number,
				candidateId: string | number,
			) =>
				fetchJson<{ id: number; status: string }>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/benefit-candidates/${encodeURIComponent(String(candidateId))}/ignore`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			/** @deprecated Use `spaces.review.listDocumentCandidates`. */
			listDocumentCandidates: (
				spaceId: string | number,
				params?: { limit?: number; sourceDocumentId?: string | number },
			) => {
				const search = new URLSearchParams();
				if (params?.limit != null) search.set("limit", String(params.limit));
				if (params?.sourceDocumentId != null) {
					search.set("source_document_id", String(params.sourceDocumentId));
				}
				const qs = search.toString() ? `?${search.toString()}` : "";
				return fetchJson<DocumentCandidateListResponse>(
					withBase(`/api/v1/spaces/${spaceId}/review/candidates${qs}`),
					{ method: "GET", headers: authHeaders() },
				);
			},
			/** @deprecated Use `spaces.review.ignoreDocumentCandidate`. */
			ignoreDocumentCandidate: (
				spaceId: string | number,
				candidateId: string | number,
			) =>
				fetchJson<DocumentCandidateState>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/ignore`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			/** @deprecated Use `spaces.review.confirmDocumentCandidate`. */
			confirmDocumentCandidate: (
				spaceId: string | number,
				candidateId: string | number,
			) =>
				fetchJson<DocumentCandidateState>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/confirm`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			/** @deprecated Use `spaces.review.createParticipantFromCandidate`. */
			createParticipantFromCandidate: (
				spaceId: string | number,
				candidateId: string | number,
			) =>
				fetchJson<CreateParticipantCandidateResponse>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/create-participant`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			/** @deprecated Use `spaces.review.createRecurringFromCandidate`. */
			createRecurringFromCandidate: (
				spaceId: string | number,
				candidateId: string | number,
			) =>
				fetchJson<CreateRecurringCandidateResponse>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/create-recurring`,
					),
					{ method: "POST", headers: authHeaders() },
				),
			/** @deprecated Use `spaces.review.applySplitCandidate`. */
			applySplitCandidate: (
				spaceId: string | number,
				candidateId: string | number,
				payload: { expense_id: string | number },
			) =>
				fetchJson<ApplySplitCandidateResponse>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/candidates/${encodeURIComponent(String(candidateId))}/apply-split`,
					),
					{ method: "POST", headers: authHeaders(), body: payload },
				),
			/** @deprecated Use `spaces.review.deleteSourceDocumentReview`. */
			deleteSourceDocumentReview: (
				spaceId: string | number,
				sourceDocumentId: string | number,
			) =>
				fetchJson<DeleteSourceDocumentReviewResponse>(
					withBase(
						`/api/v1/spaces/${spaceId}/review/captures/${encodeURIComponent(String(sourceDocumentId))}`,
					),
					{ method: "DELETE", headers: authHeaders() },
				),
		},

		drafts: {
			createFromText: (payload: { space_id?: string | number; text: string }) =>
				fetchJson<Draft>(withBase("/api/v1/drafts/text"), {
					method: "POST",
					headers: authHeaders(),
					body: payload,
				}),
			createFromPhoto: (formData: FormData) =>
				fetch(withBase("/api/v1/drafts/photo"), {
					method: "POST",
					headers: { ...authHeaders() },
					body: formData,
				}).then(async (res) => {
					if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
					return (await res.json()) as Draft;
				}),
			createFromVoice: (formData: FormData) =>
				fetch(withBase("/api/v1/drafts/voice"), {
					method: "POST",
					headers: { ...authHeaders() },
					body: formData,
				}).then(async (res) => {
					if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
					return (await res.json()) as Draft;
				}),
			update: (draftId: string | number, payload: Partial<Draft>) =>
				fetchJson<Draft>(withBase(`/api/v1/drafts/${draftId}`), {
					method: "PATCH",
					headers: authHeaders(),
					body: payload,
				}),
			confirm: (draftId: string | number) =>
				fetchJson<{ transaction: Transaction }>(
					withBase(`/api/v1/drafts/${draftId}/confirm`),
					{ method: "POST", headers: authHeaders() },
				),
			cancel: (draftId: string | number) =>
				fetchJson<{ ok: true }>(withBase(`/api/v1/drafts/${draftId}/cancel`), {
					method: "POST",
					headers: authHeaders(),
				}),
		},

		/** Deprecated compatibility alias. Prefer `spaces.expenses.get(...)`. */
		transactions: {
			getBySpaceAndId: (spaceId: string | number, id: string | number) =>
				fetchJson<Transaction>(
					withBase(`/api/v1/spaces/${spaceId}/expenses/${id}`),
					{
						method: "GET",
						headers: authHeaders(),
					},
				),
		},

		chatlog: {
			listMessages: (
				spaceId: string | number,
				params?: { limit?: number; before?: string | number },
			) => {
				const qsParams = new URLSearchParams();
				if (params?.limit) qsParams.set("limit", String(params.limit));
				if (params?.before) qsParams.set("before", String(params.before));
				const qs = qsParams.size ? `?${qsParams.toString()}` : "";
				return fetchJson<ChatMessage[]>(
					withBase(`/api/v1/spaces/${spaceId}/messages${qs}`),
					{ method: "GET", headers: authHeaders() },
				);
			},
			postNote: (spaceId: string | number, payload: { text: string }) =>
				fetchJson<ChatMessage>(withBase(`/api/v1/spaces/${spaceId}/messages`), {
					method: "POST",
					headers: authHeaders(),
					body: payload,
				}),
		},

		tenants: {
			/**
			 * Create a new organization tenant (owner membership + default space).
			 * Any authenticated user may call this (MVP policy).
			 */
			create: (body: { name: string }) =>
				fetchJson<{
					tenant: Tenant;
					default_space_id: number;
				}>(withBase("/api/v1/tenants"), {
					method: "POST",
					headers: authHeaders(),
					body,
				}),

			/** Read tenant metadata (`id`, `type`, `name`); requires tenant membership. */
			get: (
				tenantId: string | number,
				opts?: {
					tenantIdHeader?: string | number | null;
				},
			) => {
				const headerTid =
					opts?.tenantIdHeader !== undefined ? opts.tenantIdHeader : tenantId;
				return fetchJson<Tenant>(withBase(`/api/v1/tenants/${tenantId}`), {
					method: "GET",
					headers: quotaHeaders({ tenantId: headerTid }),
				});
			},

			createInvite: (
				tenantId: string | number,
				body: {
					email: string;
					invited_tenant_role?: string;
					channel?: string;
				},
			) =>
				fetchJson<TenantInviteCreateResponse>(
					withBase(`/api/v1/tenants/${tenantId}/invites`),
					{
						method: "POST",
						headers: quotaHeaders({ tenantId }),
						body,
					},
				),

			/** Directory listing; send `X-Tenant-Id` matching `tenantId` when using verified-tenant middleware. */
			listMembers: (
				tenantId: string | number,
				opts?: {
					limit?: number;
					offset?: number;
					/** Override header; defaults to same as path `tenantId`. */
					tenantIdHeader?: string | number | null;
				},
			) => {
				const qs = new URLSearchParams();
				if (opts?.limit != null) qs.set("limit", String(opts.limit));
				if (opts?.offset != null) qs.set("offset", String(opts.offset));
				const q = qs.size ? `?${qs.toString()}` : "";
				const headerTid =
					opts?.tenantIdHeader !== undefined ? opts.tenantIdHeader : tenantId;
				return fetchJson<TenantMembersPage>(
					withBase(`/api/v1/tenants/${tenantId}/members${q}`),
					{
						method: "GET",
						headers: quotaHeaders({ tenantId: headerTid }),
					},
				);
			},

			/** Audit list of invites for the tenant (admin+). */
			listInvites: (
				tenantId: string | number,
				opts?: { tenantIdHeader?: string | number | null },
			) => {
				const headerTid =
					opts?.tenantIdHeader !== undefined ? opts.tenantIdHeader : tenantId;
				return fetchJson<TenantInvitesListResponse>(
					withBase(`/api/v1/tenants/${tenantId}/invites`),
					{
						method: "GET",
						headers: quotaHeaders({ tenantId: headerTid }),
					},
				);
			},

			/** Remove a tenant member (admin+). Cannot remove owner or yourself. */
			removeMember: (
				tenantId: string | number,
				userId: string | number,
				opts?: { tenantIdHeader?: string | number | null },
			) => {
				const headerTid =
					opts?.tenantIdHeader !== undefined ? opts.tenantIdHeader : tenantId;
				return fetchJson<void>(
					withBase(
						`/api/v1/tenants/${tenantId}/members/${encodeURIComponent(String(userId))}`,
					),
					{
						method: "DELETE",
						headers: quotaHeaders({ tenantId: headerTid }),
					},
				);
			},

			/** Cancel a pending invite (admin+). */
			cancelInvite: (
				tenantId: string | number,
				inviteId: string | number,
				opts?: { tenantIdHeader?: string | number | null },
			) => {
				const headerTid =
					opts?.tenantIdHeader !== undefined ? opts.tenantIdHeader : tenantId;
				return fetchJson<void>(
					withBase(
						`/api/v1/tenants/${tenantId}/invites/${encodeURIComponent(String(inviteId))}`,
					),
					{
						method: "DELETE",
						headers: quotaHeaders({ tenantId: headerTid }),
					},
				);
			},

			/** Rename organization display name (`tenants.name`); requires tenant admin+. */
			patch: (
				tenantId: string | number,
				body: { name: string },
				opts?: {
					tenantIdHeader?: string | number | null;
				},
			) => {
				const headerTid =
					opts?.tenantIdHeader !== undefined ? opts.tenantIdHeader : tenantId;
				return fetchJson<Tenant>(withBase(`/api/v1/tenants/${tenantId}`), {
					method: "PATCH",
					headers: quotaHeaders({ tenantId: headerTid }),
					body,
				});
			},
		},

		me: {
			getNotificationChannels: () =>
				fetchJson<NotificationChannelsResponse>(
					withBase("/api/v1/me/notification-channels"),
					{
						method: "GET",
						headers: authHeaders(),
					},
				),
			putNotificationChannels: (body: NotificationChannelsPutBody) =>
				fetchJson<NotificationChannelsResponse>(
					withBase("/api/v1/me/notification-channels"),
					{
						method: "PUT",
						headers: authHeaders(),
						body,
					},
				),
		},

		quota: {
			get: (opts?: {
				spaceId?: string | number;
				tenantId?: string | number | null;
			}) => {
				const qs = new URLSearchParams();
				if (opts?.spaceId != null) qs.set("space_id", String(opts.spaceId));
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<QuotaStatus>(withBase(`/api/v1/quota${q}`), {
					method: "GET",
					headers: quotaHeaders({ tenantId: opts?.tenantId }),
				});
			},
			setTestPlan: (
				body: { plan: "basic" | "medium" | "premium" },
				opts?: {
					spaceId?: string | number;
					tenantId?: string | number | null;
				},
			) => {
				const qs = new URLSearchParams();
				if (opts?.spaceId != null) qs.set("space_id", String(opts.spaceId));
				const q = qs.size ? `?${qs.toString()}` : "";
				return fetchJson<QuotaStatus>(withBase(`/api/v1/quota/test-plan${q}`), {
					method: "PATCH",
					headers: quotaHeaders({ tenantId: opts?.tenantId }),
					body,
				});
			},
		},

		/** Finances — `/api/v1/finances/*`. */
		finances: {
			vendors: {
				list: (opts?: { spaceId?: string | number }) => {
					const q =
						opts?.spaceId != null
							? `?space_id=${encodeURIComponent(String(opts.spaceId))}`
							: "";
					return fetchJson<Vendor[]>(withBase(`/api/v1/finances/vendors${q}`), {
						method: "GET",
						headers: authHeaders(),
					});
				},
				create: (body: { name: string; space_id?: number }) =>
					fetchJson<Vendor>(withBase("/api/v1/finances/vendors"), {
						method: "POST",
						headers: authHeaders(),
						body,
					}),
			},
			expenses: {
				get: (id: string | number) =>
					fetchJson<ExpenseDetail>(
						withBase(`/api/v1/finances/expenses/${id}`),
						{ method: "GET", headers: authHeaders() },
					),
				update: (id: string | number, body: ExpensePatch) =>
					fetchJson<ExpenseDetail>(
						withBase(`/api/v1/finances/expenses/${id}`),
						{
							method: "PUT",
							headers: authHeaders(),
							body,
						},
					),
				delete: (id: string | number) =>
					fetchJson<void>(withBase(`/api/v1/finances/expenses/${id}`), {
						method: "DELETE",
						headers: authHeaders(),
					}),
				listSplits: (id: string | number) =>
					fetchJson<{ splits: ExpenseSplitRow[] }>(
						withBase(`/api/v1/finances/expenses/${id}/splits`),
						{ method: "GET", headers: authHeaders() },
					),
				putSplits: (
					id: string | number,
					lines: Array<{
						user_id?: number | null;
						space_participant_id?: number | null;
						amount: number;
					}>,
				) =>
					fetchJson<void>(withBase(`/api/v1/finances/expenses/${id}/splits`), {
						method: "PUT",
						headers: authHeaders(),
						body: lines,
					}),
			},
			recurring: {
				list: () =>
					fetchJson<RecurringExpense[]>(
						withBase("/api/v1/finances/recurring"),
						{
							method: "GET",
							headers: authHeaders(),
						},
					),
				create: (body: RecurringExpense) =>
					fetchJson<RecurringExpense>(withBase("/api/v1/finances/recurring"), {
						method: "POST",
						headers: authHeaders(),
						body,
					}),
				update: (id: string | number, body: RecurringExpense) =>
					fetchJson<RecurringExpense>(
						withBase(`/api/v1/finances/recurring/${id}`),
						{
							method: "PUT",
							headers: authHeaders(),
							body,
						},
					),
				pause: (id: string | number) =>
					fetchJson<RecurringExpense>(
						withBase(`/api/v1/finances/recurring/${id}/pause`),
						{ method: "POST", headers: authHeaders() },
					),
				resume: (id: string | number) =>
					fetchJson<RecurringExpense>(
						withBase(`/api/v1/finances/recurring/${id}/resume`),
						{ method: "POST", headers: authHeaders() },
					),
				remove: (id: string | number, opts?: { purgeExpenses?: boolean }) => {
					const qs = opts?.purgeExpenses === true ? "?purge_expenses=1" : "";
					return fetchJson<void>(
						withBase(`/api/v1/finances/recurring/${id}${qs}`),
						{
							method: "DELETE",
							headers: authHeaders(),
						},
					);
				},
			},
		},
	};
};
