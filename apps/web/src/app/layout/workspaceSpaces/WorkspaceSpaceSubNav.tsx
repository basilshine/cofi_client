import { useMemo } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";

const subLinkClass = (isActive: boolean) =>
	[
		"rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		isActive
			? "bg-primary/15 text-foreground ring-1 ring-primary/25"
			: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
	].join(" ");

/**
 * Space-scoped console links (Overview / Chat / Expenses) for the current sidebar selection.
 */
export const WorkspaceSpaceSubNav = () => {
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const { workspaceScope, selectedSpaceId, setSelectedSpaceId } =
		useWorkspaceSpaces();

	const chatState = useMemo(() => {
		if (workspaceScope == null) return {};
		return { chatWorkspace: workspaceScope };
	}, [workspaceScope]);

	const sid =
		selectedSpaceId != null ? String(selectedSpaceId) : null;

	const isOverviewActive =
		sid != null &&
		location.pathname.startsWith("/console/dashboard") &&
		searchParams.get("spaceId") === sid;

	const isChatActive =
		sid != null &&
		(location.pathname === "/console/chat" ||
			location.pathname === "/console/chat/") &&
		selectedSpaceId != null &&
		String(selectedSpaceId) === sid;

	const isExpensesActive =
		sid != null &&
		location.pathname.startsWith("/console/chat/expenses") &&
		selectedSpaceId != null &&
		String(selectedSpaceId) === sid;

	if (workspaceScope == null || sid == null) {
		return null;
	}

	return (
		<nav
			aria-label="Space console navigation"
			className="flex flex-wrap items-center gap-1.5"
		>
			<span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
				Space
			</span>
			<Link
				className={subLinkClass(isOverviewActive)}
				onClick={() => setSelectedSpaceId(selectedSpaceId)}
				to={`/console/dashboard?spaceId=${encodeURIComponent(sid)}`}
			>
				Overview
			</Link>
			<Link
				className={subLinkClass(isChatActive)}
				onClick={() => setSelectedSpaceId(selectedSpaceId)}
				state={{
					...chatState,
					selectSpaceId: selectedSpaceId,
				}}
				to="/console/chat"
			>
				Chat
			</Link>
			<Link
				className={subLinkClass(isExpensesActive)}
				onClick={() => setSelectedSpaceId(selectedSpaceId)}
				state={{
					...chatState,
					selectSpaceId: selectedSpaceId,
				}}
				to="/console/chat/expenses"
			>
				Expenses
			</Link>
		</nav>
	);
};
