import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { workspacePageVariants } from "../../../shared/lib/appMotion";
import { GlobalComposerDock } from "./GlobalComposerDock";
import { SpaceScopedMembersSidebarBridge } from "./SpaceScopedMembersSidebarBridge";
import { WorkspaceSpaceListNav } from "./WorkspaceSpaceListNav";
import {
	WorkspaceSpacesProvider,
	useWorkspaceSpaces,
} from "./WorkspaceSpacesContext";

const composerCollapsedStorageKey = "ceits.globalComposer.collapsed";
const settingsLikeRoutePattern =
	/^\/console\/(?:settings|account|organization|quota)(?:\/|$)/;
const spaceSettingsRoutePattern = /^\/console\/spaces\/[^/]+\/settings(?:\/|$)/;

const getInitialComposerCollapsed = () => {
	if (typeof window === "undefined") return false;

	const saved = window.localStorage.getItem(composerCollapsedStorageKey);
	if (saved === "true") return true;
	if (saved === "false") return false;

	return window.matchMedia("(max-width: 640px)").matches;
};

const WorkspaceSidebar = () => {
	const { chatSidebarProps, sidebarExpanded } = useWorkspaceSpaces();

	return (
		<aside
			className={[
				"flex min-h-0 shrink-0 flex-col self-stretch border-r border-border/60 bg-background transition-[width,max-width] duration-200 ease-out",
				sidebarExpanded
					? "w-full max-w-[min(100vw,320px)] lg:w-[min(100%,320px)]"
					: "w-full max-w-[4.5rem] lg:w-[4.5rem]",
			].join(" ")}
		>
			<WorkspaceSpaceListNav soloNav={chatSidebarProps == null} />
		</aside>
	);
};

const ConsoleWorkspaceSplitInner = () => {
	const location = useLocation();
	const outlet = useOutlet();
	const [composerCollapsed, setComposerCollapsed] = useState(
		getInitialComposerCollapsed,
	);
	const isSpaceScopedRoute =
		/^\/console\/spaces\/[^/]+(\/|$)/.test(location.pathname) ||
		/^\/console\/dashboard(\/|$)/.test(location.pathname);
	const hasNativeComposer = location.pathname.startsWith("/console/chat");
	const isSettingsLikeRoute =
		settingsLikeRoutePattern.test(location.pathname) ||
		spaceSettingsRoutePattern.test(location.pathname);
	const showGlobalComposer = !hasNativeComposer && !isSettingsLikeRoute;

	useEffect(() => {
		window.localStorage.setItem(
			composerCollapsedStorageKey,
			String(composerCollapsed),
		);
	}, [composerCollapsed]);

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			{isSpaceScopedRoute ? <SpaceScopedMembersSidebarBridge /> : null}
			<WorkspaceSidebar />
			<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<AnimatePresence mode="wait">
					<motion.div
						animate="animate"
						className={[
							"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
							showGlobalComposer
								? composerCollapsed
									? "pb-[5.25rem] sm:pb-[4.75rem]"
									: "pb-[9.25rem] sm:pb-[8.75rem]"
								: "",
						].join(" ")}
						exit="exit"
						initial="initial"
						key={location.pathname}
						variants={workspacePageVariants}
					>
						{outlet}
					</motion.div>
				</AnimatePresence>
				{showGlobalComposer ? (
					<GlobalComposerDock
						isCollapsed={composerCollapsed}
						onCollapsedChange={setComposerCollapsed}
					/>
				) : null}
			</div>
		</div>
	);
};

export const ConsoleWorkspaceSplit = () => {
	return (
		<WorkspaceSpacesProvider>
			<ConsoleWorkspaceSplitInner />
		</WorkspaceSpacesProvider>
	);
};
