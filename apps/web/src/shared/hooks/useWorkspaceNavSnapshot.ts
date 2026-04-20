import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { readActiveOrgTenantId } from "../lib/apiClient";
import { readChatWorkspaceScope } from "../lib/chatWorkspaceScope";
import { resolveHeaderWorkspaceTab } from "../lib/resolveHeaderWorkspaceTab";
import { WORKSPACE_NAV_UPDATED_EVENT } from "../lib/workspaceNavEvents";

/**
 * Re-reads session when workspace scope / org selection changes so the header stays in sync
 * with Chat, dashboard, etc.
 */
export const useWorkspaceNavSnapshot = () => {
	const { pathname } = useLocation();
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
			tab: resolveHeaderWorkspaceTab(pathname),
			chatScope: readChatWorkspaceScope(),
			activeOrgTenantId: readActiveOrgTenantId(),
		};
	}, [pathname, sessionRev]);
};
