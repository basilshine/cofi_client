import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readChatWorkspaceScope } from "../../shared/lib/chatWorkspaceScope";
import {
	clearOnboardingIntent,
	readOnboardingIntent,
} from "../../shared/lib/onboardingIntent";

export const ConsoleOverviewPage = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [intentBanner, setIntentBanner] = useState<string | null>(null);

	useEffect(() => {
		const welcome = searchParams.get("welcome");
		if (welcome !== "1") return;

		const next = new URLSearchParams(searchParams);
		next.delete("welcome");
		setSearchParams(next, { replace: true });

		const intent = readOnboardingIntent();
		if (!intent) return;

		setIntentBanner(
			intent === "business"
				? "You started from the business and teams path — explore Organization and Quota when you are ready."
				: "You started from the personal and family path — shared spaces and splits work great from Spaces and Chat.",
		);
	}, [searchParams, setSearchParams]);

	const handleDismissIntent = () => {
		setIntentBanner(null);
		clearOnboardingIntent();
	};

	const chatLinkState = (() => {
		const cw = readChatWorkspaceScope();
		return cw ? { chatWorkspace: cw } : undefined;
	})();

	return (
		<section className="space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<p className="text-sm text-muted-foreground">
					Signed-in MVP surfaces: drafts, spaces, confirmed history, quota, and
					space chat. Use{" "}
					<Link className="underline" to="/console/account">
						Account
					</Link>{" "}
					for session details.
				</p>
			</div>

			{intentBanner ? (
				<output
					aria-live="polite"
					className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm"
				>
					<p className="min-w-0 flex-1 text-muted-foreground">{intentBanner}</p>
					<button
						className="shrink-0 rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
						onClick={handleDismissIntent}
						type="button"
					>
						Dismiss
					</button>
				</output>
			) : null}

			<div className="grid gap-3 md:grid-cols-2">
				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/account"
				>
					<div className="text-sm font-medium">Account</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Session, optional saved profiles, token preview.
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
					to="/console/recurring"
				>
					<div className="text-sm font-medium">Recurring</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Pause, resume, or delete scheduled charges.
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
					state={chatLinkState}
					to="/console/chat"
				>
					<div className="text-sm font-medium">ChatLog</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Space-scoped discussion about expenses/transactions.
					</div>
				</Link>

				<Link
					className="rounded-lg border border-border bg-card p-4 hover:bg-accent"
					to="/console/organization"
				>
					<div className="text-sm font-medium">Organization</div>
					<div className="mt-1 text-xs text-muted-foreground">
						Tenant directory and org display name (admin rename).
					</div>
				</Link>
			</div>
		</section>
	);
};
