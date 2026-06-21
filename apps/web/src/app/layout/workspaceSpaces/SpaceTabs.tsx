import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";

const tabClass = (isActive: boolean) =>
	[
		"inline-flex h-9 shrink-0 items-center rounded-xl px-3.5 text-xs tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[13px]",
		isActive
			? "soft-shadow bg-card text-foreground font-bold"
			: "font-medium text-muted-foreground hover:bg-card/60 hover:text-foreground",
	].join(" ");

type TabKey =
	| "overview"
	| "review"
	| "expenses"
	| "benefits"
	| "members"
	| "splits"
	| "recurring";

const tabsOrder: { key: TabKey; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "review", label: "Captures" },
	{ key: "expenses", label: "Expenses" },
	{ key: "benefits", label: "Benefits" },
	{ key: "members", label: "Members" },
	{ key: "splits", label: "Splits" },
	{ key: "recurring", label: "Recurring" },
];

const TabIcon = ({ tab }: { tab: TabKey }) => {
	switch (tab) {
		case "overview":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Overview</title>
					<path d="M3 11l9-7 9 7" />
					<path d="M5 10v10h14V10" />
				</svg>
			);
		case "review":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Captures</title>
					<path d="M7 4h10l2 2v14H5V4z" />
					<path d="M9 9h6M9 13h6M9 17h4" />
					<path d="M17 4v4h4" />
				</svg>
			);
		case "expenses":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Expenses</title>
					<path d="M4 7h16M7 4v6M17 4v6M5 10h14v10H5z" />
				</svg>
			);
		case "splits":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Splits</title>
					<path d="M5 7h14M5 17h14M8 7l4 5 4-5" />
				</svg>
			);
		case "benefits":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Benefits</title>
					<path d="M20 12v8H4v-8" />
					<path d="M2 7h20v5H2z" />
					<path d="M12 7v13M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7zM12 7h3.5A2.5 2.5 0 1 0 13 4.5L12 7z" />
				</svg>
			);
		case "members":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Members</title>
					<path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
					<path d="M15.5 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
					<path d="M3.5 19a5 5 0 0 1 10 0" />
					<path d="M13.5 19a4 4 0 0 1 7 0" />
				</svg>
			);
		case "recurring":
			return (
				<svg
					aria-hidden
					className="h-3.5 w-3.5"
					fill="none"
					stroke="currentColor"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth="1.8"
					viewBox="0 0 24 24"
				>
					<title>Recurring</title>
					<path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
					<path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
				</svg>
			);
		default:
			return null;
	}
};

const matchActiveTab = (pathname: string): TabKey | null => {
	if (/^\/console\/spaces\/[^/]+\/overview/.test(pathname)) return "overview";
	if (/^\/console\/spaces\/[^/]+\/expenses/.test(pathname)) return "expenses";
	if (/^\/console\/spaces\/[^/]+\/splits/.test(pathname)) return "splits";
	if (/^\/console\/spaces\/[^/]+\/benefits/.test(pathname)) return "benefits";
	if (/^\/console\/spaces\/[^/]+\/members/.test(pathname)) return "members";
	if (/^\/console\/spaces\/[^/]+\/recurring/.test(pathname)) return "recurring";
	if (pathname.startsWith("/console/review")) return "review";
	if (pathname.startsWith("/console/dashboard")) return "overview";
	return null;
};

export type SpaceTabsProps = {
	/** Compact pill row used inline at the top of any in-space page. */
	className?: string;
};

/**
 * Single source of truth for the in-space tab row.
 * Renders Overview / Captures / Expenses / Splits / Recurring, all scoped to the
 * currently selected space (driven by `WorkspaceSpacesContext`).
 *
 * When no space is selected the row is intentionally hidden so the global
 * shell never shows space-level navigation that would lead nowhere.
 */
export const SpaceTabs = ({ className = "" }: SpaceTabsProps) => {
	const location = useLocation();
	const { workspaceScope, selectedSpaceId, setSelectedSpaceId, spaces } =
		useWorkspaceSpaces();

	const sid = selectedSpaceId != null ? String(selectedSpaceId) : null;

	const spaceName = useMemo(() => {
		if (sid == null || !spaces) return null;
		const s = spaces.find((x) => String(x.id) === sid);
		return s?.name?.trim() ?? null;
	}, [sid, spaces]);

	if (workspaceScope == null || sid == null) {
		return null;
	}

	const active = matchActiveTab(location.pathname);

	const hrefByKey: Record<TabKey, string> = {
		overview: `/console/spaces/${encodeURIComponent(sid)}/overview`,
		review: `/console/review?spaceId=${encodeURIComponent(sid)}`,
		expenses: `/console/spaces/${encodeURIComponent(sid)}/expenses`,
		benefits: `/console/spaces/${encodeURIComponent(sid)}/benefits`,
		members: `/console/spaces/${encodeURIComponent(sid)}/members`,
		splits: `/console/spaces/${encodeURIComponent(sid)}/splits`,
		recurring: `/console/spaces/${encodeURIComponent(sid)}/recurring`,
	};

	return (
		<nav
			aria-label={spaceName ? `${spaceName} navigation` : "Space navigation"}
			className={["flex min-w-0 items-center gap-2", className]
				.join(" ")
				.trim()}
		>
			<div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto">
				{tabsOrder.map(({ key, label }) => {
					const isActive = active === key;
					return (
						<Link
							aria-current={isActive ? "page" : undefined}
							className={tabClass(isActive)}
							key={key}
							onClick={() => setSelectedSpaceId(selectedSpaceId)}
							to={hrefByKey[key]}
						>
							<span className="inline-flex items-center gap-1.5">
								<TabIcon tab={key} />
								<span>{label}</span>
							</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
};
