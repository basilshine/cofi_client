import { Link, Outlet, useLocation } from "react-router-dom";

const navItems = [
	{ to: "/console", label: "Overview" },
	{ to: "/console/auth", label: "Auth" },
	{ to: "/console/spaces", label: "Spaces" },
	{ to: "/console/drafts", label: "Drafts" },
	{ to: "/console/transactions", label: "Transactions" },
	{ to: "/console/chat", label: "ChatLog" },
	{ to: "/console/quota", label: "Quota" },
] as const;

export const AppShell = () => {
	const location = useLocation();

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
					<div className="flex items-center gap-3">
						<Link className="text-sm font-semibold tracking-tight" to="/console">
							Cofilance Dev Console
						</Link>
						<span className="text-xs text-muted-foreground">MVP harness</span>
					</div>

					<nav className="hidden flex-wrap items-center gap-2 md:flex">
						{navItems.map((item) => {
							const isActive = location.pathname === item.to;
							return (
								<Link
									key={item.to}
									className={[
										"rounded-md px-3 py-1.5 text-xs font-medium",
										isActive
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
									].join(" ")}
									to={item.to}
								>
									{item.label}
								</Link>
							);
						})}
					</nav>
				</div>
			</header>

			<main className="mx-auto w-full max-w-6xl px-6 py-8">
				<Outlet />
			</main>
		</div>
	);
};

