import { Link } from "react-router-dom";

export const ConsoleOverviewPage = () => {
	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Backend MVP Dev Console</h1>
				<p className="text-sm text-muted-foreground">
					This website app is a testing harness for backend features (auth, drafts,
					transactions, quota, spaces, chat log).
				</p>
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/auth"
				>
					<div className="text-sm font-medium">Auth</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Login/register (dev harness) and token status.
					</div>
				</Link>

				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/drafts"
				>
					<div className="text-sm font-medium">Drafts</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Create draft from text/photo/voice; confirm/edit/cancel.
					</div>
				</Link>

				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/transactions"
				>
					<div className="text-sm font-medium">Transactions</div>
					<div className="mt-1 text-xs text-muted-foreground">
						View recent confirmed transactions.
					</div>
				</Link>

				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/quota"
				>
					<div className="text-sm font-medium">Quota</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Check remaining parses and blocked state.
					</div>
				</Link>

				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/spaces"
				>
					<div className="text-sm font-medium">Spaces</div>
					<div className="mt-1 text-xs text-muted-foreground">
						V1 single-owner spaces (default Personal).
					</div>
				</Link>

				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/chat"
				>
					<div className="text-sm font-medium">ChatLog</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Space-scoped discussion about expenses/transactions.
					</div>
				</Link>
			</div>
		</section>
	);
};

