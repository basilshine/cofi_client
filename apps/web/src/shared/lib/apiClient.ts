import { createApiClient } from "@cofi/api";
import { tokenStorage } from "./tokenStorage";
import { notifyWorkspaceNavUpdated } from "./workspaceNavEvents";

const ACTIVE_ORG_TENANT_KEY = "ceits.activeOrgTenantId";

/** Persisted org scope for API calls that use `getTenantId` (optional `X-Tenant-Id`). */
export const readActiveOrgTenantId = (): number | null => {
	try {
		const raw = sessionStorage.getItem(ACTIVE_ORG_TENANT_KEY);
		if (raw == null || raw === "") return null;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? n : null;
	} catch {
		return null;
	}
};

export const writeActiveOrgTenantId = (tenantId: number | null): void => {
	try {
		if (tenantId == null) sessionStorage.removeItem(ACTIVE_ORG_TENANT_KEY);
		else sessionStorage.setItem(ACTIVE_ORG_TENANT_KEY, String(tenantId));
		notifyWorkspaceNavUpdated();
	} catch {
		/* ignore quota / private mode */
	}
};

export const apiClient = createApiClient({
	// Paths in @cofi/api are `/api/v1/...`. Use empty base + Vite proxy, or full origin (no `/api` suffix).
	baseUrl: import.meta.env.VITE_API_URL?.trim() || "",
	getAccessToken: () => tokenStorage.getToken(),
	getTenantId: () => readActiveOrgTenantId(),
});
