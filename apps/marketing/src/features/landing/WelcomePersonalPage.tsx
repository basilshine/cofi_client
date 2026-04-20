import { Link } from "react-router-dom";
import { workspaceUrl } from "../../lib/workspaceUrl";

const authQuery = `intent=personal&returnTo=${encodeURIComponent("/console?welcome=1")}`;
const authRegisterHref = workspaceUrl(`/register?${authQuery}`);
const authLoginHref = workspaceUrl(`/login?${authQuery}`);

export const WelcomePersonalPage = () => {
	return (
		<div className="min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
			<header className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))]/95 backdrop-blur">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
					<Link className="text-lg font-semibold tracking-tight" to="/">
						Ceits
					</Link>
					<div className="flex items-center gap-2">
						<a
							className="rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							href={authLoginHref}
						>
							Sign in
						</a>
						<a
							className="rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] px-4 py-2 text-sm font-medium transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							href={authRegisterHref}
						>
							Create account
						</a>
					</div>
				</div>
			</header>

			<main className="mx-auto w-full max-w-6xl space-y-12 px-6 py-12 lg:px-8 lg:py-16">
				<div className="space-y-5">
					<p className="text-sm font-medium uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]">
						For households and side projects
					</p>
					<h1 className="max-w-3xl font-serif text-4xl tracking-tight md:text-5xl">
						Your money stories, without the spreadsheet grind
					</h1>
					<p className="max-w-3xl text-base leading-7 text-[hsl(var(--text-secondary))]">
						Start from a personal tenant and shared spaces when you need them —
						splitting bills, planning trips, tracking a renovation, or staying
						aligned with family on recurring costs.
					</p>
				</div>

				<ul className="grid gap-4 md:grid-cols-2">
					<li className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6">
						<h2 className="text-sm font-semibold">
							Splitting and shared costs
						</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Capture who owes what across roommates, partners, or trips — fewer
							arguments, clearer totals.
						</p>
					</li>
					<li className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6">
						<h2 className="text-sm font-semibold">Travel and events</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							One space per trip or event keeps receipts and decisions in
							context while you stay on budget.
						</p>
					</li>
					<li className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6">
						<h2 className="text-sm font-semibold">
							Construction and big projects
						</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Track deposits, milestones, and vendor lines alongside chat so
							nothing gets lost in messages.
						</p>
					</li>
					<li className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6">
						<h2 className="text-sm font-semibold">Family-first defaults</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							A personal tenant stays simple for solo use; invite others when
							you are ready without changing products.
						</p>
					</li>
				</ul>

				<div className="flex flex-col gap-3 border-t border-[hsl(var(--border-subtle))] pt-8 sm:flex-row">
					<a
						className="inline-flex h-11 items-center justify-center rounded-md bg-[hsl(var(--accent))] px-6 text-sm font-medium text-[hsl(var(--accent-contrast))] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
						href={authRegisterHref}
					>
						Start with Ceits
					</a>
					<Link
						className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--border-subtle))] px-6 text-sm font-medium transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
						to="/welcome/business"
					>
						Compare team and business path
					</Link>
				</div>
			</main>
		</div>
	);
};
