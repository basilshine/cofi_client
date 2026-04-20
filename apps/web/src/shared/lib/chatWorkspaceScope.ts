import { notifyWorkspaceNavUpdated } from "./workspaceNavEvents";

const STORAGE_KEY = "ceits.chatTenantScope";

export type ChatWorkspaceKind = "personal" | "organization";

/** Single-tenant chat / console workspace (Personal vs one Organization). */
export type ChatWorkspaceScope = {
	kind: ChatWorkspaceKind;
	tenantId: number;
	label?: string;
};

export const isChatWorkspaceScope = (
	value: unknown,
): value is ChatWorkspaceScope => {
	if (value == null || typeof value !== "object") return false;
	const o = value as Record<string, unknown>;
	const kind = o.kind;
	const tid = o.tenantId;
	if (kind !== "personal" && kind !== "organization") return false;
	if (typeof tid !== "number" || !Number.isFinite(tid) || tid <= 0) {
		return false;
	}
	return true;
};

export const readChatWorkspaceScope = (): ChatWorkspaceScope | null => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (raw == null || raw === "") return null;
		const parsed: unknown = JSON.parse(raw);
		if (!isChatWorkspaceScope(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
};

export const writeChatWorkspaceScope = (
	scope: ChatWorkspaceScope | null,
): void => {
	try {
		if (scope == null) {
			sessionStorage.removeItem(STORAGE_KEY);
			notifyWorkspaceNavUpdated();
			return;
		}
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
		notifyWorkspaceNavUpdated();
	} catch {
		/* ignore */
	}
};
