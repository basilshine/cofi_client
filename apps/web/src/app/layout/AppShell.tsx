import { Link, Outlet } from "react-router-dom";
import { DashboardWorkspaceSwitcher } from "../../features/dashboard/components/DashboardWorkspaceSwitcher";
import { ChatBreadcrumbProvider } from "./ChatBreadcrumbContext";
import { ConsoleBreadcrumbs } from "./ConsoleBreadcrumbs";
import { ConsoleUserMenu } from "./ConsoleUserMenu";
import { ConsoleWorkspaceTheme } from "./ConsoleWorkspaceTheme";

export const AppShell = () => {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<ConsoleWorkspaceTheme />
			<header className="border-b border-border">
				<div className="mx-auto flex w-full max-w-6xl flex-nowrap items-center justify-between gap-3 overflow-x-auto px-6 py-4">
					<div className="flex min-w-0 shrink-0 items-center gap-3">
						<Link className="text-sm font-semibold tracking-tight" to="/">
							Ceits
						</Link>
						<span className="hidden text-xs text-muted-foreground sm:inline">
							Web MVP
						</span>
					</div>

					<nav
						aria-label="Console"
						className="flex min-w-0 flex-nowrap items-center justify-end gap-2 sm:gap-3"
					>
						<div className="flex shrink-0 flex-nowrap items-center gap-2">
							<DashboardWorkspaceSwitcher />
						</div>
						<ConsoleUserMenu />
					</nav>
				</div>
			</header>

			<main className="mx-auto w-full max-w-6xl overflow-x-clip px-6 py-8">
				<ChatBreadcrumbProvider>
					<ConsoleBreadcrumbs />
					<Outlet />
				</ChatBreadcrumbProvider>
			</main>
		</div>
	);
};
