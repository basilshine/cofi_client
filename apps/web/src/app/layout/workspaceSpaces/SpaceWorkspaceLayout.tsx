import type { ReactNode } from "react";
import { SpaceTabs } from "./SpaceTabs";

const joinClassNames = (...parts: Array<string | false | null | undefined>) =>
	parts.filter(Boolean).join(" ");

export type SpaceWorkspaceLayoutProps = {
	children: ReactNode;
	contentClassName?: string;
	mainClassName?: string;
	rightRail?: ReactNode;
	rightRailClassName?: string;
	rightRailInnerClassName?: string;
	rightRailLabel?: string;
	tabsClassName?: string;
};

export const spaceWorkspaceSurfaceClass =
	"bg-[linear-gradient(180deg,#faf8f3_0%,#f3efe6_42%,#f6f2ea_100%)]";

export const spaceWorkspaceRailClass =
	"border-l border-[rgba(190,175,150,0.35)] bg-[linear-gradient(180deg,#f5f1ea_0%,#f0ebe3_100%)]";

export const SpaceWorkspaceLayout = ({
	children,
	contentClassName = "w-full space-y-6 px-4 py-6 lg:px-8 lg:py-8",
	mainClassName = spaceWorkspaceSurfaceClass,
	rightRail,
	rightRailClassName,
	rightRailInnerClassName = "min-h-0 flex-1 overflow-y-auto px-5 py-8",
	rightRailLabel = "Space utility rail",
	tabsClassName,
}: SpaceWorkspaceLayoutProps) => {
	return (
		<div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
			<header className="shrink-0 border-b border-border/80 bg-background px-4 py-3 lg:px-8">
				<SpaceTabs className={tabsClassName} />
			</header>
			<div className="flex min-h-0 w-full min-w-0 flex-1 overflow-hidden">
				<main
					className={joinClassNames(
						"min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden",
						mainClassName,
					)}
				>
					<div className={contentClassName}>{children}</div>
				</main>
				{rightRail ? (
					<aside
						aria-label={rightRailLabel}
						className={joinClassNames(
							"hidden shrink-0 self-stretch flex-col xl:flex xl:w-[20rem]",
							spaceWorkspaceRailClass,
							rightRailClassName,
						)}
					>
						<div className={rightRailInnerClassName}>{rightRail}</div>
					</aside>
				) : null}
			</div>
		</div>
	);
};
