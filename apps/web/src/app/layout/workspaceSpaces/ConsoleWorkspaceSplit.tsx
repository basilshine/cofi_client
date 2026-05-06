import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { workspacePageVariants } from "../../../shared/lib/appMotion";
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
	const isSpaceScopedRoute =
		/^\/console\/spaces\/[^/]+(\/|$)/.test(location.pathname) ||
		/^\/console\/dashboard(\/|$)/.test(location.pathname);

	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			{isSpaceScopedRoute ? <SpaceScopedMembersSidebarBridge /> : null}
			<WorkspaceSidebar />
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<AnimatePresence mode="wait">
					<motion.div
						animate="animate"
						className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
						exit="exit"
						initial="initial"
						key={location.pathname}
						variants={workspacePageVariants}
					>
						{outlet}
					</motion.div>
				</AnimatePresence>
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
