import { useEffect, useMemo, useState } from "react";
import { readActiveOrgTenantId } from "../lib/apiClient";
import { WORKSPACE_NAV_UPDATED_EVENT } from "../lib/workspaceNavEvents";

/**
 * Re-reads session when workspace scope / org selection changes so the header stays in sync
 * with Chat, dashboard, etc.
 */
export const useWorkspaceNavSnapshot = () => {
	const [sessionRev, setSessionRev] = useState(0);

	useEffect(() => {
		const bump = () => setSessionRev((n) => n + 1);
		window.addEventListener(WORKSPACE_NAV_UPDATED_EVENT, bump);
		window.addEventListener("storage", bump);
		return () => {
			window.removeEventListener(WORKSPACE_NAV_UPDATED_EVENT, bump);
			window.removeEventListener("storage", bump);
		};
	}, []);

	return useMemo(() => {
		void sessionRev;
		return {
			activeOrgTenantId: readActiveOrgTenantId(),
		};
	}, [sessionRev]);
};
