import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { WORKSPACE_NAV_UPDATED_EVENT } from "../../shared/lib/workspaceNavEvents";

export const CONSOLE_WORKSPACE_ATTR = "data-console-workspace" as const;

const applyConsoleWorkspace = (pathname: string) => {
	// Personal-only console: warm accent tint always.
	document.documentElement.setAttribute(CONSOLE_WORKSPACE_ATTR, "personal");

	if (pathname.startsWith("/console")) {
		document.documentElement.setAttribute("data-theme", "ceits-editorial");
	} else {
		document.documentElement.removeAttribute("data-theme");
	}
};

/**
 * Sets console chrome tokens (personal workspace + editorial palette) for `/console/*`.
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
