import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { readChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import { WORKSPACE_NAV_UPDATED_EVENT } from "../../shared/lib/workspaceNavEvents";

export const CONSOLE_WORKSPACE_ATTR = "data-console-workspace" as const;

const resolveConsoleWorkspace = (pathname: string): "personal" | "business" => {
	if (pathname.includes("/console/dashboard/business")) return "business";
	if (pathname.includes("/console/dashboard/personal")) return "personal";
	const cw = readChatWorkspaceScope();
	if (cw?.kind === "organization") return "business";
	return "personal";
};

const applyConsoleWorkspace = (pathname: string) => {
	const workspace = resolveConsoleWorkspace(pathname);
	document.documentElement.setAttribute(CONSOLE_WORKSPACE_ATTR, workspace);
};

/**
 * Tints the whole console (via :root) so Personal reads warm and Organization reads rich green.
 */
export const ConsoleWorkspaceTheme = () => {
	const { pathname } = useLocation();

	useEffect(() => {
		const handleNavSync = () => {
			applyConsoleWorkspace(window.location.pathname);
		};
		applyConsoleWorkspace(pathname);
		window.addEventListener(WORKSPACE_NAV_UPDATED_EVENT, handleNavSync);
		return () => {
			window.removeEventListener(WORKSPACE_NAV_UPDATED_EVENT, handleNavSync);
		};
	}, [pathname]);

	useEffect(() => {
		return () => {
			document.documentElement.removeAttribute(CONSOLE_WORKSPACE_ATTR);
		};
	}, []);

	return null;
};
