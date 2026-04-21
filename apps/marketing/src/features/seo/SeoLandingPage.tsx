import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
	fadeUpVariants,
	pageVariants,
	staggerContainer,
	staggerItem,
} from "../../lib/marketingMotion";
import { appUrl } from "../../lib/workspaceUrl";
import {
	type LandingPageConfig as Config,
	LANDING_PAGES,
	type LandingPageConfig,
} from "./landingPages";
import { useSeoHead } from "./seoHead";

const MotionLink = motion(Link);

const viewportScroll = {
	once: true,
	amount: 0.12,
	margin: "0px 0px -40px 0px",
} as const;

const LinkCard = ({ page }: { page: Config }) => (
	<MotionLink
		className="block rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 text-sm transition-colors hover:border-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))]"
		to={page.slug}
		whileHover={{ y: -3, transition: { duration: 0.2 } }}
		whileTap={{ scale: 0.99 }}
	>
		<p className="font-semibold leading-6 text-[hsl(var(--text-primary))]">
			{page.h1}
		</p>
		<p className="mt-2 leading-6 text-[hsl(var(--text-secondary))]">
			{page.description}
		</p>
	</MotionLink>
);

export const SeoLandingPage = ({ page }: { page: LandingPageConfig }) => {
	useSeoHead(page);
	const relatedPages = page.related
		.map((slug) => LANDING_PAGES[slug])
		.filter(Boolean);

	return (
		<motion.div
			animate="animate"
			className="min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
			exit="exit"
			initial="initial"
			variants={pageVariants}
		>
			<header className="border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))]/95 backdrop-blur">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
					<Link className="font-serif text-xl tracking-[0.01em]" to="/">
						Ceits
					</Link>
					<div className="flex gap-2">
						<a
							className="inline-flex h-10 items-center rounded-md px-3 text-sm font-medium text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))]"
							href={appUrl("/login")}
						>
							Log in
						</a>
						<a
							className="inline-flex h-10 items-center rounded-md border border-[hsl(var(--text-primary))] bg-[hsl(var(--text-primary))] px-4 text-sm font-medium text-[hsl(var(--bg))] transition hover:opacity-90"
							href={appUrl("/register")}
						>
							Get started
						</a>
					</div>
				</div>
			</header>
			<main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
				<motion.section
					className="space-y-6"
					initial="hidden"
					variants={fadeUpVariants}
					viewport={viewportScroll}
					whileInView="visible"
				>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]">
						{page.eyebrow}
					</p>
					<h1 className="max-w-4xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						{page.h1}
					</h1>
					<p className="max-w-2xl text-base leading-8 text-[hsl(var(--text-secondary))] sm:text-lg">
						{page.intro}
					</p>
					<div className="flex flex-col gap-3 pt-3 sm:flex-row">
						<a
							className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--text-primary))] bg-[hsl(var(--text-primary))] px-5 text-sm font-medium text-[hsl(var(--bg))] transition hover:opacity-90"
							href={appUrl("/register")}
						>
							Get started
						</a>
						<a
							className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] px-5 text-sm font-medium transition hover:bg-[hsl(var(--bg))]"
							href={appUrl("/login")}
						>
							Log in
						</a>
					</div>
				</motion.section>

				<motion.section
					className="grid gap-4 lg:grid-cols-2"
					initial="hidden"
					variants={fadeUpVariants}
					viewport={viewportScroll}
					whileInView="visible"
				>
					<article className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 sm:p-8">
						<h2 className="font-serif text-2xl tracking-tight">
							{page.problemTitle}
						</h2>
						<p className="mt-4 leading-8 text-[hsl(var(--text-secondary))]">
							{page.problemBody}
						</p>
					</article>
					<article className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 sm:p-8">
						<h2 className="font-serif text-2xl tracking-tight">
							{page.whyTitle}
						</h2>
						<p className="mt-4 leading-8 text-[hsl(var(--text-secondary))]">
							{page.whyBody}
						</p>
					</article>
				</motion.section>

				<section>
					<motion.h2
						className="font-serif text-3xl tracking-tight"
						initial="hidden"
						variants={fadeUpVariants}
						viewport={viewportScroll}
						whileInView="visible"
					>
						Product strengths
					</motion.h2>
					<motion.ul
						className="mt-4 grid gap-3 md:grid-cols-2"
						initial="hidden"
						variants={staggerContainer}
						viewport={viewportScroll}
						whileInView="visible"
					>
						{page.strengths.map((item) => (
							<motion.li
								className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 text-sm leading-6"
								key={item}
								variants={staggerItem}
							>
								{item}
							</motion.li>
						))}
					</motion.ul>
				</section>

				<section>
					<motion.h2
						className="font-serif text-3xl tracking-tight"
						initial="hidden"
						variants={fadeUpVariants}
						viewport={viewportScroll}
						whileInView="visible"
					>
						Real-life scenarios
					</motion.h2>
					<motion.ul
						className="mt-4 space-y-3"
						initial="hidden"
						variants={staggerContainer}
						viewport={viewportScroll}
						whileInView="visible"
					>
						{page.scenarios.map((item) => (
							<motion.li
								className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 text-sm leading-7 text-[hsl(var(--text-secondary))]"
								key={item}
								variants={staggerItem}
							>
								{item}
							</motion.li>
						))}
					</motion.ul>
				</section>

				<motion.section
					className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 sm:p-8"
					initial="hidden"
					variants={fadeUpVariants}
					viewport={viewportScroll}
					whileInView="visible"
				>
					<h2 className="font-serif text-3xl tracking-tight">
						Why not just a plain tracker?
					</h2>
					<p className="mt-4 text-base leading-8 text-[hsl(var(--text-secondary))]">
						{page.comparison.plain}
					</p>
					<p className="mt-3 text-base leading-8 text-[hsl(var(--text-primary))]">
						{page.comparison.ceits}
					</p>
				</motion.section>

				{page.faq.length > 0 ? (
					<section>
						<motion.h2
							className="font-serif text-3xl tracking-tight"
							initial="hidden"
							variants={fadeUpVariants}
							viewport={viewportScroll}
							whileInView="visible"
						>
							FAQ
						</motion.h2>
						<motion.div
							className="mt-4 space-y-3"
							initial="hidden"
							variants={staggerContainer}
							viewport={viewportScroll}
							whileInView="visible"
						>
							{page.faq.map((item) => (
								<motion.div key={item.question} variants={staggerItem}>
									<details className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5">
										<summary className="cursor-pointer text-sm font-semibold leading-6">
											{item.question}
										</summary>
										<p className="mt-3 text-sm leading-7 text-[hsl(var(--text-secondary))]">
											{item.answer}
										</p>
									</details>
								</motion.div>
							))}
						</motion.div>
					</section>
				) : null}

				<section>
					<motion.h2
						className="font-serif text-2xl tracking-tight"
						initial="hidden"
						variants={fadeUpVariants}
						viewport={viewportScroll}
						whileInView="visible"
					>
						Related pages
					</motion.h2>
					<motion.div
						className="mt-4 grid gap-3 md:grid-cols-3"
						initial="hidden"
						variants={staggerContainer}
						viewport={viewportScroll}
						whileInView="visible"
					>
						{relatedPages.map((relatedPage) => (
							<motion.div key={relatedPage.slug} variants={staggerItem}>
								<LinkCard page={relatedPage} />
							</motion.div>
						))}
					</motion.div>
				</section>

				<motion.section
					className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-6 sm:p-8"
					initial="hidden"
					variants={fadeUpVariants}
					viewport={viewportScroll}
					whileInView="visible"
				>
					<h2 className="font-serif text-3xl tracking-tight">
						Start your shared money space in Ceits
					</h2>
					<p className="mt-4 max-w-2xl text-sm leading-7 text-[hsl(var(--text-secondary))] sm:text-base">
						Use ceits.com to understand the workflow, then move into
						app.ceits.com to sign up and begin.
					</p>
					<div className="mt-5 flex flex-col gap-3 sm:flex-row">
						<a
							className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--text-primary))] bg-[hsl(var(--text-primary))] px-5 text-sm font-medium text-[hsl(var(--bg))] transition hover:opacity-90"
							href={appUrl("/register")}
						>
							Get started
						</a>
						<a
							className="inline-flex h-11 items-center justify-center rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] px-5 text-sm font-medium transition hover:bg-[hsl(var(--surface-muted))]"
							href={appUrl("/login")}
						>
							Log in
						</a>
					</div>
				</motion.section>
			</main>
		</motion.div>
	);
};
