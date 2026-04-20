import type {
	ChatMessage,
	Draft,
	QuotaStatus,
	Space,
	SpaceInviteCreateResponse,
	SpaceMember,
	Transaction,
	User,
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

export type ApiClientConfig = {
	baseUrl: string;
	getAccessToken?: () => string | null;
};

export const createApiClient = (config: ApiClientConfig) => {
	const withBase = (path: string) => `${config.baseUrl}${path}`;

	const authHeaders = () => {
		const token = config.getAccessToken?.() ?? null;
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		return headers;
	};

	return {
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
		},

		spaces: {
			list: () =>
				fetchJson<Space[]>(withBase("/api/v1/spaces"), {
					method: "GET",
					headers: authHeaders(),
				}),
			create: (payload: { name: string }) =>
				fetchJson<Space>(withBase("/api/v1/spaces"), {
					method: "POST",
					headers: authHeaders(),
					body: payload,
				}),
			listMembers: (spaceId: string | number) =>
				fetchJson<SpaceMember[]>(withBase(`/api/v1/spaces/${spaceId}/members`), {
					method: "GET",
					headers: authHeaders(),
				}),
			createInvite: (spaceId: string | number, payload: { email: string }) =>
				fetchJson<SpaceInviteCreateResponse>(
					withBase(`/api/v1/spaces/${spaceId}/invites`),
					{
						method: "POST",
						headers: authHeaders(),
						body: payload,
					},
				),
			acceptInvite: (token: string) =>
				fetchJson<Space>(withBase(`/api/v1/invites/${token}/accept`), {
					method: "POST",
					headers: authHeaders(),
				}),
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

		transactions: {
			list: (params?: { limit?: number }) => {
				const qs = params?.limit ? `?limit=${params.limit}` : "";
				return fetchJson<Transaction[]>(withBase(`/api/v1/transactions${qs}`), {
					method: "GET",
					headers: authHeaders(),
				});
			},
			getById: (id: string | number) =>
				fetchJson<Transaction>(withBase(`/api/v1/transactions/${id}`), {
					method: "GET",
					headers: authHeaders(),
				}),
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

		quota: {
			get: () =>
				fetchJson<QuotaStatus>(withBase("/api/v1/quota"), {
					method: "GET",
					headers: authHeaders(),
				}),
		},
	};
};

