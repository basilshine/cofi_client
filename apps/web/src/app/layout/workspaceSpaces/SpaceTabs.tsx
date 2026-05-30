import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import type { ChatWorkspaceScope } from "../../../shared/lib/chatWorkspaceScope";
import { useWorkspaceSpaces } from "./WorkspaceSpacesContext";

const tabClass = (isActive: boolean) =>
	[
		"inline-flex h-9 shrink-0 items-center rounded-xl px-3.5 text-xs tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[13px]",
		isActive
			? "soft-shadow bg-card text-foreground font-bold"
			: "font-medium text-muted-foreground hover:bg-card/60 hover:text-foreground",
	].join(" ");

const compactContextInitial = (name: string | null) => {
	const t = (name ?? "").trim();
	if (!t) return "?";
	return t.charAt(0).toUpperCase();
};

type TabKey =
	| "overview"
	| "chat"
	| "expenses"
	| "benefits"
	| "splits"
	| "recurring";

const tabsOrder: { key: TabKey; label: string }[] = [
	{ key: "overview", label: "Overview" },
	{ key: "chat", label: "Chat" },
	{ key: "expenses", label: "Expenses" },
	{ key: "benefits", label: "Benefits" },
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
		case "chat":
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
					<title>Chat</title>
					<path d="M4 5h16v11H8l-4 3V5z" />
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
	if (/^\/console\/spaces\/[^/]+\/splits/.test(pathname)) return "splits";
	if (/^\/console\/spaces\/[^/]+\/benefits/.test(pathname)) return "benefits";
	if (/^\/console\/spaces\/[^/]+\/recurring/.test(pathname)) return "recurring";
	if (pathname.startsWith("/console/chat/expenses")) return "expenses";
	if (pathname.startsWith("/console/chat")) return "chat";
	if (pathname.startsWith("/console/dashboard")) return "overview";
	if (pathname.startsWith("/console/recurring")) return "recurring";
	return null;
};

export type SpaceTabsProps = {
	/** Compact pill row used inline at the top of any in-space page. */
	className?: string;
};

/**
 * Single source of truth for the in-space tab row.
 * Renders Overview / Chat / Expenses / Splits / Recurring, all scoped to the
 * currently selected space (driven by `WorkspaceSpacesContext`).
 *
 * When no space is selected the row is intentionally hidden so the global
 * shell never shows space-level navigation that would lead nowhere.
 */
export const SpaceTabs = ({ className = "" }: SpaceTabsProps) => {
	const location = useLocation();
	const {
		workspaceScope,
		selectedSpaceId,
		setSelectedSpaceId,
		spaces,
		chatSidebarProps,
	} = useWorkspaceSpaces();

	const sid = selectedSpaceId != null ? String(selectedSpaceId) : null;

	const chatLinkState = useMemo(() => {
		if (workspaceScope == null || selectedSpaceId == null) {
			return undefined;
		}
		const state: {
			chatWorkspace: ChatWorkspaceScope;
			selectSpaceId: string | number;
		} = {
			chatWorkspace: workspaceScope,
			selectSpaceId: selectedSpaceId,
		};
		return state;
	}, [workspaceScope, selectedSpaceId]);

	const spaceName = useMemo(() => {
		if (sid == null || !spaces) return null;
		const s = spaces.find((x) => String(x.id) === sid);
		return s?.name?.trim() ?? null;
	}, [sid, spaces]);

	if (workspaceScope == null || sid == null) {
		return null;
	}

	const active = matchActiveTab(location.pathname);
	const membersCount = chatSidebarProps?.members?.length ?? null;
	const contextSpaceName =
		chatSidebarProps?.selectedSpace?.name?.trim() || spaceName || "Space";

	const hrefByKey: Record<TabKey, string> = {
		overview: `/console/spaces/${encodeURIComponent(sid)}/overview`,
		chat: `/console/chat?spaceId=${encodeURIComponent(sid)}`,
		expenses: `/console/chat/expenses?spaceId=${encodeURIComponent(sid)}`,
		benefits: `/console/spaces/${encodeURIComponent(sid)}/benefits`,
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
							state={
								key === "chat" || key === "expenses" ? chatLinkState : undefined
							}
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
			<div className="hidden shrink-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-2.5 py-1.5 lg:flex">
				<div
					aria-hidden
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-gradient-to-br from-muted to-muted/60 text-[10px] font-semibold text-foreground"
				>
					{compactContextInitial(contextSpaceName)}
				</div>
				<div className="min-w-0">
					<p className="max-w-[8.5rem] truncate text-xs font-medium text-foreground">
						{contextSpaceName}
					</p>
					<p className="text-[10px] text-muted-foreground">
						{membersCount == null
							? "…"
							: `${membersCount} member${membersCount === 1 ? "" : "s"}`}
					</p>
				</div>
				<Link
					aria-label={`Members and invites — open in space settings, ${contextSpaceName}`}
					className="shrink-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => setSelectedSpaceId(selectedSpaceId)}
					to={`/console/spaces/${encodeURIComponent(sid)}/settings#space-settings-members`}
				>
					Manage
				</Link>
			</div>
		</nav>
	);
};
