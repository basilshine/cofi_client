import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
	fadeUpVariants,
	staggerContainer,
	staggerItem,
} from "../../lib/marketingMotion";
import { workspaceUrl } from "../../lib/workspaceUrl";

const authQuery = `intent=business&returnTo=${encodeURIComponent("/console?welcome=1")}`;
const authRegisterHref = workspaceUrl(`/register?${authQuery}`);
const authLoginHref = workspaceUrl(`/login?${authQuery}`);

const scrollReveal = {
	once: true,
	amount: 0.18,
	margin: "0px 0px -40px 0px",
} as const;

export const WelcomeBusinessPage = () => {
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
				<motion.div
					className="space-y-5"
					initial="hidden"
					variants={fadeUpVariants}
					whileInView="visible"
					viewport={scrollReveal}
				>
					<p className="text-sm font-medium uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]">
						For teams and companies
					</p>
					<h1 className="max-w-3xl font-serif text-4xl tracking-tight md:text-5xl">
						Operational clarity for your organization
					</h1>
					<p className="max-w-3xl text-base leading-7 text-[hsl(var(--text-secondary))]">
						One tenant per billed entity: seats, roles, and shared spaces
						without splitting your books across disconnected tools. Align
						finance workflows with how your business actually runs.
					</p>
				</motion.div>

				<motion.ul
					className="grid gap-4 md:grid-cols-2"
					initial="hidden"
					variants={staggerContainer}
					whileInView="visible"
					viewport={scrollReveal}
				>
					<motion.li
						className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6"
						variants={staggerItem}
						whileHover={{ y: -2, transition: { duration: 0.2 } }}
					>
						<h2 className="text-sm font-semibold">Roles and governance</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Tenant admins invite members, manage the directory, and keep
							sensitive exports and audit surfaces under control (per plan).
						</p>
					</motion.li>
					<motion.li
						className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6"
						variants={staggerItem}
						whileHover={{ y: -2, transition: { duration: 0.2 } }}
					>
						<h2 className="text-sm font-semibold">Shared spaces</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							Projects and departments get their own spaces while billing and
							limits stay attached to the organization.
						</p>
					</motion.li>
					<motion.li
						className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6"
						variants={staggerItem}
						whileHover={{ y: -2, transition: { duration: 0.2 } }}
					>
						<h2 className="text-sm font-semibold">Quota and entitlements</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							AI parse allowances and member caps follow the tenant — ready for
							team growth without surprise overages.
						</p>
					</motion.li>
					<motion.li
						className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6"
						variants={staggerItem}
						whileHover={{ y: -2, transition: { duration: 0.2 } }}
					>
						<h2 className="text-sm font-semibold">Roadmap-friendly</h2>
						<p className="mt-2 text-sm leading-6 text-[hsl(var(--text-secondary))]">
							SSO, verified domains, and deeper policy live on the same tenant
							foundation — no parallel &quot;org&quot; table required.
						</p>
					</motion.li>
				</motion.ul>

				<motion.div
					className="flex flex-col gap-3 border-t border-[hsl(var(--border-subtle))] pt-8 sm:flex-row"
					initial="hidden"
					variants={fadeUpVariants}
					whileInView="visible"
					viewport={scrollReveal}
				>
					<a
						className="inline-flex h-11 items-center justify-center rounded-md bg-[hsl(var(--accent))] px-6 text-sm font-medium text-[hsl(var(--accent-contrast))] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
						href={authRegisterHref}
					>
						Start with Ceits
					</a>
					<Link
						className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--border-subtle))] px-6 text-sm font-medium transition hover:bg-[hsl(var(--surface-muted))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))]"
						to="/welcome/personal"
					>
						Compare personal and family path
					</Link>
				</motion.div>
			</main>
		</div>
	);
};
