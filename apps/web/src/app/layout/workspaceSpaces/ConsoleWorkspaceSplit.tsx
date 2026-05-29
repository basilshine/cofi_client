import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { workspacePageVariants } from "../../../shared/lib/appMotion";
import { GlobalComposerDock } from "./GlobalComposerDock";
import { SpaceScopedMembersSidebarBridge } from "./SpaceScopedMembersSidebarBridge";
import { WorkspaceSpaceListNav } from "./WorkspaceSpaceListNav";
import {
	WorkspaceSpacesProvider,
	useWorkspaceSpaces,
} from "./WorkspaceSpacesContext";

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
	const [composerCollapsed, setComposerCollapsed] = useState(false);
	const isSpaceScopedRoute =
		/^\/console\/spaces\/[^/]+(\/|$)/.test(location.pathname) ||
		/^\/console\/dashboard(\/|$)/.test(location.pathname);
	const showGlobalComposer = !location.pathname.startsWith("/console/chat");

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			{isSpaceScopedRoute ? <SpaceScopedMembersSidebarBridge /> : null}
			<WorkspaceSidebar />
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
			</div>
			{showGlobalComposer ? (
				<GlobalComposerDock
					isCollapsed={composerCollapsed}
					onCollapsedChange={setComposerCollapsed}
				/>
			) : null}
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
