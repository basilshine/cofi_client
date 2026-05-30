import type { ReactNode } from "react";
import { SpaceTabs } from "../../../app/layout/workspaceSpaces/SpaceTabs";
import { WorkspaceRightSidebar } from "../../../app/layout/workspaceSpaces/WorkspaceRightSidebar";

type NativeChatWorkspaceProps = {
	children: ReactNode;
	errorMessage: string | null;
	feedbackSlot?: ReactNode;
	onRightSidebarExpandedChange: (expanded: boolean) => void;
	rightRail: ReactNode;
	rightSidebarExpanded: boolean;
	rightSidebarTitle: string;
	rightSidebarWorkSurfaceActive?: boolean;
};

export const NativeChatWorkspace = ({
	children,
	errorMessage,
	feedbackSlot = null,
	onRightSidebarExpandedChange,
	rightRail,
	rightSidebarExpanded,
	rightSidebarTitle,
	rightSidebarWorkSurfaceActive = false,
}: NativeChatWorkspaceProps) => {
	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden">
			<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<header className="shrink-0 border-b border-border/80 bg-background px-4 py-2.5 lg:px-6">
					<SpaceTabs />
				</header>

				{errorMessage ? (
					<div className="shrink-0 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-sm text-destructive lg:px-6">
						{errorMessage}
					</div>
				) : null}

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
						<div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-muted/30 to-background">
							{children}
						</div>
					</main>
				</div>

				{feedbackSlot}
			</section>
			<WorkspaceRightSidebar
				expanded={rightSidebarExpanded}
				onExpandedChange={onRightSidebarExpandedChange}
				title={rightSidebarTitle}
				workSurfaceActive={rightSidebarWorkSurfaceActive}
			>
				{rightRail}
			</WorkspaceRightSidebar>
		</div>
	);
};
