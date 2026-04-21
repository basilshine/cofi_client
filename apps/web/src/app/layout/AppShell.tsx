import { Link, Outlet, useLocation } from "react-router-dom";
import { ChatBreadcrumbProvider } from "./ChatBreadcrumbContext";
import { ConsoleBreadcrumbs } from "./ConsoleBreadcrumbs";
import { ConsoleUserMenu } from "./ConsoleUserMenu";
import { ConsoleWorkspaceTheme } from "./ConsoleWorkspaceTheme";

export const AppShell = () => {
	const { pathname } = useLocation();
	const fullBleedWorkspace =
		pathname.startsWith("/console") && !pathname.startsWith("/console/account");

	return (
		<div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground">
			<ConsoleWorkspaceTheme />
			<header className="shrink-0 border-b border-border/80">
				<div className="flex w-full flex-nowrap items-center justify-between gap-3 overflow-x-auto px-6 py-4 lg:px-10">
					<div className="flex min-w-0 shrink-0 items-center gap-3">
						<Link
							className="font-display text-lg font-normal tracking-tight text-foreground"
							to="/console/dashboard"
						>
							Ceits
						</Link>
						<span className="hidden text-xs text-muted-foreground sm:inline">
							Console
						</span>
					</div>

					<nav
						aria-label="Console"
						className="flex min-w-0 flex-nowrap items-center justify-end gap-2 sm:gap-3"
					>
						<ConsoleUserMenu />
					</nav>
				</div>
			</header>

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
