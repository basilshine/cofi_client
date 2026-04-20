import { useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

/**
 * Fetches tenant `name` for header / menus when session scope has no label yet.
 */
export const useTenantDisplayName = (tenantId: number | null) => {
	const [name, setName] = useState<string | null>(null);

	useEffect(() => {
		if (tenantId == null) {
			setName(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const t = await apiClient.tenants.get(tenantId, {
					tenantIdHeader: tenantId,
				});
				if (cancelled) return;
				const n = t?.name?.trim();
				setName(n && n.length > 0 ? n : null);
			} catch {
				if (!cancelled) setName(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [tenantId]);

	return name;
};
