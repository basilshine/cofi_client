import { Link } from "react-router-dom";
import { workspaceUrl } from "../../lib/workspaceUrl";

export const LandingPage = () => {
	return (
		<div className="min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
			<header className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))]/95 backdrop-blur">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
					<span className="text-lg font-semibold tracking-tight">Ceits</span>
					<div className="flex items-center gap-2">
						<a
							className="rounded-md px-3 py-2 text-sm font-medium text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							href={workspaceUrl("/login")}
						>
							Sign in
						</a>
						<a
							className="rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] px-4 py-2 text-sm font-medium text-[hsl(var(--text-primary))] transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							href={workspaceUrl("/register")}
						>
							Create account
						</a>
					</div>
				</div>
			</header>

			<main className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-8 lg:py-20">
				<section className="grid gap-10 lg:grid-cols-12 lg:items-center">
					<div className="space-y-6 lg:col-span-7">
						<p className="text-sm font-medium uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]">
							Shared finance, made calm
						</p>
						<h1 className="max-w-2xl font-serif text-4xl tracking-tight text-[hsl(var(--text-primary))] md:text-5xl">
							Clarity for shared money, without the noise.
						</h1>
						<p className="max-w-2xl text-base leading-7 text-[hsl(var(--text-secondary))]">
							Ceits turns scattered receipts, notes, and decisions into one
							editorial workspace for households and teams.
						</p>
						<div className="flex flex-col gap-3 sm:flex-row">
							<a
								className="inline-flex h-11 items-center justify-center rounded-md bg-[hsl(var(--accent))] px-6 text-sm font-medium text-[hsl(var(--accent-contrast))] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								href={workspaceUrl("/register")}
							>
								Start with Ceits
							</a>
							<a
								className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--border-subtle))] px-6 text-sm font-medium text-[hsl(var(--text-primary))] transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								href="#how-it-works"
							>
								Explore how it works
							</a>
						</div>
						<div className="grid gap-3 pt-2 sm:grid-cols-2">
							<Link
								aria-label="Continue with personal and household path"
								className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 transition hover:border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								to="/welcome/personal"
							>
								<p className="text-sm font-medium text-[hsl(var(--text-primary))]">
									For me and my household
								</p>
								<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
									Trips, family budgets, and shared costs with practical
									visibility.
								</p>
							</Link>
							<Link
								aria-label="Continue with team and business path"
								className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 transition hover:border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								to="/welcome/business"
							>
								<p className="text-sm font-medium text-[hsl(var(--text-primary))]">
									For my team or business
								</p>
								<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
									Roles, shared spaces, and operational confidence for every
									finance workflow.
								</p>
							</Link>
						</div>
					</div>
					<div className="space-y-4 lg:col-span-5">
						<div className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 shadow-sm">
							<p className="text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
								Narrative preview
							</p>
							<h2 className="mt-3 text-xl font-semibold tracking-tight">
								One thread, from capture to decision
							</h2>
							<p className="mt-3 text-sm leading-6 text-[hsl(var(--text-secondary))]">
								See what came in, what was structured, and what needs action
								next. Ceits keeps the full decision trail calm and visible.
							</p>
							<div className="mt-5 space-y-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] p-4">
								<p className="text-xs uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
									Editorial moment
								</p>
								<p className="text-sm text-[hsl(var(--text-primary))]">
									"Receipt imported - participants confirmed - split ready to
									send."
								</p>
								<p className="text-sm text-[hsl(var(--text-secondary))]">
									From ambiguity to shared clarity in a single workspace lane.
								</p>
							</div>
						</div>
						<div className="rounded-2xl bg-[hsl(var(--surface-muted))] p-6">
							<p className="text-sm leading-6 text-[hsl(var(--text-secondary))]">
								Privacy-first by default, with paths for both personal and
								organizational use inside the same trusted product experience.
							</p>
						</div>
					</div>
				</section>

				<section className="mt-14 rounded-xl bg-[hsl(var(--surface))] px-6 py-5 lg:mt-16">
					<div className="grid gap-3 text-sm text-[hsl(var(--text-secondary))] md:grid-cols-3">
						<p>Trusted workflows for shared money decisions</p>
						<p>Accessible controls and readable finance context</p>
						<p>Built to move from household to organization readiness</p>
					</div>
				</section>

				<section className="py-14 lg:py-20" id="how-it-works">
					<div className="mb-8 space-y-3">
						<p className="text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
							How it works
						</p>
						<h2 className="text-2xl tracking-tight md:text-3xl">
							How Ceits works
						</h2>
						<p className="max-w-3xl text-base leading-7 text-[hsl(var(--text-secondary))]">
							A calm three-step flow: capture your context, structure what
							matters, then act with confidence.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						<article className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 transition-colors hover:bg-[hsl(var(--surface-muted))]">
							<p className="text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
								Step 1
							</p>
							<h3 className="mt-3 text-lg font-semibold">Capture</h3>
							<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
								Bring receipts, chat notes, and reminders together before
								details get lost.
							</p>
						</article>
						<article className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 transition-colors hover:bg-[hsl(var(--surface-muted))]">
							<p className="text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
								Step 2
							</p>
							<h3 className="mt-3 text-lg font-semibold">Structure</h3>
							<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
								Convert inputs into clean records with clear participants,
								statuses, and values.
							</p>
						</article>
						<article className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 transition-colors hover:bg-[hsl(var(--surface-muted))]">
							<p className="text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
								Step 3
							</p>
							<h3 className="mt-3 text-lg font-semibold">Act</h3>
							<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
								Confirm, share, and move forward with confidence across personal
								or organizational spaces.
							</p>
						</article>
					</div>
				</section>

				<section className="space-y-10 py-14 lg:py-20">
					<div className="grid gap-6 rounded-2xl bg-[hsl(var(--surface))] p-6 lg:grid-cols-2">
						<div className="space-y-3">
							<p className="text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]">
								Editorial highlight
							</p>
							<h2 className="text-2xl tracking-tight md:text-3xl">
								Designed for everyday confidence
							</h2>
							<p className="text-base leading-7 text-[hsl(var(--text-secondary))]">
								Ceits keeps financial context readable so shared decisions feel
								practical, not overwhelming.
							</p>
						</div>
						<div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] p-5 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							One source of truth for what was captured, what changed, and what
							needs action next.
						</div>
					</div>
					<div className="grid gap-6 rounded-2xl bg-[hsl(var(--surface))] p-6 lg:grid-cols-2">
						<div className="order-2 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] p-5 text-sm leading-6 text-[hsl(var(--text-secondary))] lg:order-1">
							Personal and organization paths share one visual language so your
							experience stays coherent as your needs grow.
						</div>
						<div className="order-1 space-y-3 lg:order-2">
							<h2 className="text-2xl tracking-tight md:text-3xl">
								One product, two clear paths
							</h2>
							<p className="text-base leading-7 text-[hsl(var(--text-secondary))]">
								Start where you are today and switch context when needed without
								learning another system.
							</p>
						</div>
					</div>
				</section>

				<section className="py-14 lg:py-16">
					<div className="overflow-hidden rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))]">
						<div className="grid border-b border-[hsl(var(--border-subtle))] text-sm md:grid-cols-3">
							<p className="px-5 py-4 font-medium text-[hsl(var(--text-primary))]">
								Decision signal
							</p>
							<p className="px-5 py-4 font-medium text-[hsl(var(--text-primary))]">
								Traditional tools
							</p>
							<p className="px-5 py-4 font-medium text-[hsl(var(--text-primary))]">
								Ceits
							</p>
						</div>
						<div className="grid divide-y divide-[hsl(var(--border-subtle))] text-sm md:grid-cols-3 md:divide-x md:divide-y-0">
							<p className="px-5 py-4 text-[hsl(var(--text-secondary))]">
								Shared context
							</p>
							<p className="px-5 py-4 text-[hsl(var(--text-secondary))]">
								Siloed across chats and sheets
							</p>
							<p className="px-5 py-4 text-[hsl(var(--text-secondary))]">
								Structured in one calm workspace
							</p>
							<p className="px-5 py-4 text-[hsl(var(--text-secondary))]">
								Path clarity
							</p>
							<p className="px-5 py-4 text-[hsl(var(--text-secondary))]">
								One-size onboarding
							</p>
							<p className="px-5 py-4 text-[hsl(var(--text-secondary))]">
								Dedicated personal and organization entry points
							</p>
						</div>
					</div>
				</section>

				<section className="border-t border-[hsl(var(--border-subtle))] py-14 lg:py-16">
					<div className="space-y-6">
						<h2 className="text-2xl tracking-tight md:text-3xl">
							Ready to begin with Ceits?
						</h2>
						<p className="max-w-3xl text-base leading-7 text-[hsl(var(--text-secondary))]">
							Choose your path now, or sign in if you already have an account.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							<Link
								className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								to="/welcome/personal"
							>
								<p className="text-sm font-medium">For me and my household</p>
							</Link>
							<Link
								className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								to="/welcome/business"
							>
								<p className="text-sm font-medium">For my team or business</p>
							</Link>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row">
							<a
								className="inline-flex h-11 items-center justify-center rounded-md bg-[hsl(var(--accent))] px-6 text-sm font-medium text-[hsl(var(--accent-contrast))] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								href={workspaceUrl("/register")}
							>
								Start with Ceits
							</a>
							<a
								className="inline-flex h-11 items-center justify-center rounded-md px-2 text-sm font-medium text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
								href={workspaceUrl("/login")}
							>
								Sign in
							</a>
						</div>
					</div>
				</section>
			</main>
			<footer className="border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))]">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-[hsl(var(--text-secondary))] sm:flex-row sm:items-center sm:justify-between lg:px-8">
					<p>Ceits</p>
					<div className="flex items-center gap-5">
						<a
							className="transition hover:text-[hsl(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							href={workspaceUrl("/login")}
						>
							Support
						</a>
						<a
							className="transition hover:text-[hsl(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
							href={workspaceUrl("/register")}
						>
							Get started
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
};
