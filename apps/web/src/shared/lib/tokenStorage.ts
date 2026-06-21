const TOKEN_KEY = "cofi_token";
const REFRESH_TOKEN_KEY = "cofi_refresh_token";

const PROFILES_KEY = "cofi_auth_profiles_v1";
const ACTIVE_PROFILE_ID_KEY = "cofi_auth_active_profile_id_v1";

export type AuthProfile = {
	id: string; // stable local id
	label: string; // usually email, but can be any human label
	email?: string;
	userId?: number;
	createdAt: number;
	lastUsedAt: number;
};

type StoredAuthProfile = AuthProfile & {
	accessToken?: string;
	refreshToken?: string | null;
};

const readJson = <T>(key: string): T | null => {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

const writeJson = (key: string, value: unknown) => {
	localStorage.setItem(key, JSON.stringify(value));
};

const makeProfileId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto)
		return crypto.randomUUID();
	return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const sanitizeProfiles = (profiles: StoredAuthProfile[]): AuthProfile[] => {
	return profiles.map((profile) => ({
		id: profile.id,
		label: profile.label,
		email: profile.email,
		userId: profile.userId,
		createdAt: profile.createdAt,
		lastUsedAt: profile.lastUsedAt,
	}));
};

export const tokenStorage = {
	getToken: () => localStorage.getItem(TOKEN_KEY),
	setToken: (token: string | null) => {
		if (!token) {
			localStorage.removeItem(TOKEN_KEY);
			return;
		}
		localStorage.setItem(TOKEN_KEY, token);
	},
	getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
	setRefreshToken: (token: string | null) => {
		if (!token) {
			localStorage.removeItem(REFRESH_TOKEN_KEY);
			return;
		}
		localStorage.setItem(REFRESH_TOKEN_KEY, token);
	},
	listProfiles: (): AuthProfile[] => {
		const raw = readJson<StoredAuthProfile[]>(PROFILES_KEY) ?? [];
		const sanitized = sanitizeProfiles(raw);
		if (JSON.stringify(raw) !== JSON.stringify(sanitized)) {
			writeJson(PROFILES_KEY, sanitized);
		}
		return sanitized;
	},
	getActiveProfileId: (): string | null =>
		localStorage.getItem(ACTIVE_PROFILE_ID_KEY),
	getActiveProfile: (): AuthProfile | null => {
		const activeId = tokenStorage.getActiveProfileId();
		if (!activeId) return null;
		return tokenStorage.listProfiles().find((p) => p.id === activeId) ?? null;
	},
	setActiveProfileId: (profileId: string | null) => {
		if (!profileId) {
			localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
			return;
		}
		localStorage.setItem(ACTIVE_PROFILE_ID_KEY, profileId);
	},
	upsertProfile: (input: {
		label: string;
		email?: string;
		userId?: number;
	}) => {
		const now = Date.now();
		const existing = tokenStorage
			.listProfiles()
			.find(
				(p) =>
					(input.email ? p.email === input.email : false) ||
					p.label === input.label,
			);

		const next: AuthProfile = existing
			? {
					...existing,
					label: input.label,
					email: input.email ?? existing.email,
					userId: input.userId ?? existing.userId,
					lastUsedAt: now,
				}
			: {
					id: makeProfileId(),
					label: input.label,
					email: input.email,
					userId: input.userId,
					createdAt: now,
					lastUsedAt: now,
				};

		const profiles = tokenStorage
			.listProfiles()
			.filter((p) => p.id !== next.id)
			.concat(next)
			.sort((a, b) => b.lastUsedAt - a.lastUsedAt);

		writeJson(PROFILES_KEY, profiles);
		tokenStorage.setActiveProfileId(next.id);
		return next;
	},
	activateProfile: (profileId: string) => {
		const profiles = tokenStorage.listProfiles();
		const profile = profiles.find((p) => p.id === profileId) ?? null;
		if (!profile) return null;

		const now = Date.now();
		const updated: AuthProfile = { ...profile, lastUsedAt: now };
		writeJson(
			PROFILES_KEY,
			profiles
				.map((p) => (p.id === profileId ? updated : p))
				.sort((a, b) => b.lastUsedAt - a.lastUsedAt),
		);

		tokenStorage.setActiveProfileId(profileId);
		return updated;
	},
	removeProfile: (profileId: string) => {
		const profiles = tokenStorage.listProfiles();
		const nextProfiles = profiles.filter((p) => p.id !== profileId);
		writeJson(PROFILES_KEY, nextProfiles);

		const activeId = tokenStorage.getActiveProfileId();
		if (activeId === profileId) {
			tokenStorage.setActiveProfileId(nextProfiles[0]?.id ?? null);
			if (!nextProfiles[0]) {
				tokenStorage.clear();
			}
		}
	},
	clear: () => {
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(REFRESH_TOKEN_KEY);
	},
};
