import { Link } from "react-router-dom";
import { useWorkspaceNavSnapshot } from "../../../shared/hooks/useWorkspaceNavSnapshot";

const workspaceSwitcherLinkClass = (isActive: boolean) =>
	[
		"flex min-h-0 min-w-0 flex-1 items-center justify-center rounded-md px-2 py-0 text-center text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] sm:px-2.5 sm:text-xs",
		isActive
			? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-contrast))] shadow-sm"
			: "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))]/90 hover:text-[hsl(var(--text-primary))]",
	].join(" ");

/**
 * Personal vs Business dashboard routes — reflects session + URL (Chat scope, org selection).
 */
export const DashboardWorkspaceSwitcher = () => {
	const { tab } = useWorkspaceNavSnapshot();

	return (
		<div
			className="flex h-8 w-[10.5rem] shrink-0 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/60 p-0.5 shadow-sm sm:w-[12rem]"
			role="tablist"
			aria-label="Dashboard workspace"
		>
			<Link
				aria-current={tab === "personal" ? "page" : undefined}
				className={workspaceSwitcherLinkClass(tab === "personal")}
				to="/console/dashboard/personal"
				role="tab"
			>
				Personal
			</Link>
			<Link
				aria-current={tab === "business" ? "page" : undefined}
				className={workspaceSwitcherLinkClass(tab === "business")}
				to="/console/dashboard/business"
				role="tab"
			>
				Business
			</Link>
		</div>
	);
};
