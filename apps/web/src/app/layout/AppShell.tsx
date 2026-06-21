import { Outlet, useLocation } from "react-router-dom";
import { ChatBreadcrumbProvider } from "./ChatBreadcrumbContext";
import { ConsoleBreadcrumbs } from "./ConsoleBreadcrumbs";
import { ConsoleHeaderCenterProvider } from "./ConsoleHeaderCenterContext";
import { ConsoleWorkspaceTheme } from "./ConsoleWorkspaceTheme";

const AppShellChrome = () => {
	const { pathname } = useLocation();
	// Workspace-grade pages (chat, dashboard, space overview, etc.) own their
	// own headers + tabs and don't want a wrapping breadcrumb / inset padding.
	const fullBleedWorkspace =
		pathname.startsWith("/console") && !pathname.startsWith("/console/account");

	return (
		<div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground font-editorial">
			<ConsoleWorkspaceTheme />
			<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<ChatBreadcrumbProvider>
					{fullBleedWorkspace ? null : (
						<div className="shrink-0 px-6 pt-6 lg:px-10">
							<ConsoleBreadcrumbs />
						</div>
					)}
					<div
						className={
							fullBleedWorkspace
								? "flex min-h-0 flex-1 flex-col overflow-hidden"
								: "flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 lg:px-10"
						}
					>
						<Outlet />
					</div>
				</ChatBreadcrumbProvider>
			</main>
		</div>
	);
};

export const AppShell = () => {
	// Some workspace pages still use this provider to publish local header state.
	// The global top header is gone; each page renders its own SpaceHeader / page title.
	return (
		<ConsoleHeaderCenterProvider>
			<AppShellChrome />
		</ConsoleHeaderCenterProvider>
	);
};
