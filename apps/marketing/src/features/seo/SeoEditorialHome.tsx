import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
	fadeUpVariants,
	pageVariants,
	staggerContainer,
	staggerItem,
} from "../../lib/marketingMotion";
import { appUrl } from "../../lib/workspaceUrl";
import type { LandingPageConfig } from "./landingPages";

const viewportScroll = {
	once: true,
	amount: 0.12,
	margin: "0px 0px -40px 0px",
} as const;

/** Self-hosted under `apps/marketing/public/marketing/editorial/` */
const editorialImg = (file: string) =>
	`${import.meta.env.BASE_URL}marketing/editorial/${file}`;

const imgHero = editorialImg("hero.jpg");
const imgReceipt = editorialImg("receipt.jpg");
const imgFlow = editorialImg("flow.jpg");
const imgOcr = editorialImg("ocr.jpg");
const imgScenarioApt = imgHero;
const imgScenarioFamily = editorialImg("scenario-family.jpg");
const imgScenarioTrip = editorialImg("scenario-trip.jpg");
const imgScenarioSubs = editorialImg("scenario-subs.jpg");
const imgHarmony = editorialImg("harmony.jpg");

const IconCamera = () => (
	<svg
		aria-hidden
		className="h-9 w-9 text-[hsl(var(--text-primary))]"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
	>
		<title>Camera</title>
		<path d="M6.827 6.175A2.31 2.31 0 0 0 5.25 8.25v10.5a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25V8.25a2.31 2.31 0 0 0-1.577-2.075l-1.326-.442A2.25 2.25 0 0 0 14.175 5.25h-4.35a2.25 2.25 0 0 0-2.098 1.483l-1.326.442Z" />
		<path d="M15 12.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
	</svg>
);

const IconMic = () => (
	<svg
		aria-hidden
		className="h-9 w-9 text-[hsl(var(--accent-contrast))]"
		fill="currentColor"
		viewBox="0 0 24 24"
	>
		<title>Microphone</title>
		<path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v6a3.75 3.75 0 1 1-7.5v-6ZM12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m12 0a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3m-3-8.25v-4.5" />
	</svg>
);

const IconFolder = () => (
	<svg
		aria-hidden
		className="h-9 w-9 text-[hsl(var(--text-primary))]"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
	>
		<title>Shared folder</title>
		<path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
	</svg>
);

const IconSync = () => (
	<svg
		aria-hidden
		className="h-9 w-9 text-[hsl(var(--text-primary))]"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
	>
		<title>Stay in sync</title>
		<path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
	</svg>
);

const IconCheck = () => (
	<svg
		aria-hidden
		className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--text-secondary))]"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		viewBox="0 0 24 24"
	>
		<title>Check</title>
		<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
	</svg>
);

const IconReceipt = () => (
	<svg
		aria-hidden
		className="h-5 w-5 text-[hsl(var(--text-secondary))]"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
	>
		<title>Receipt</title>
		<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-.375a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
	</svg>
);

const PrimaryCta = ({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) => (
	<a
		className={`inline-flex items-center justify-center rounded-lg bg-[hsl(var(--accent))] px-6 py-3 text-sm font-semibold tracking-wide text-[hsl(var(--accent-contrast))] shadow-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] active:scale-[0.99] ${className}`}
		href={appUrl("/register")}
	>
		{children}
	</a>
);

const SecondaryCta = ({
	children,
	href,
	className = "",
}: {
	children: React.ReactNode;
	href: string;
	className?: string;
}) => (
	<a
		className={`inline-flex items-center justify-center rounded-lg bg-[hsl(var(--surface-muted))] px-6 py-3 text-sm font-semibold tracking-wide text-[hsl(var(--text-primary))] transition hover:bg-[hsl(var(--surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--bg))] ${className}`}
		href={href}
	>
		{children}
	</a>
);

const MotionLink = motion(Link);

const RelatedCard = ({ page }: { page: LandingPageConfig }) => (
	<MotionLink
		className="block rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] p-5 text-sm transition-colors hover:border-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))]"
		to={page.slug}
		whileHover={{ y: -2, transition: { duration: 0.2 } }}
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

type SeoEditorialHomeProps = {
	page: LandingPageConfig;
	relatedPages: LandingPageConfig[];
};

export const SeoEditorialHome = ({
	page,
	relatedPages,
}: SeoEditorialHomeProps) => {
	return (
		<motion.div
			animate="animate"
			className="min-h-screen bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
			exit="exit"
			initial="initial"
			variants={pageVariants}
		>
			<nav
				aria-label="Marketing"
				className="sticky top-0 z-50 border-b border-[hsl(var(--border-subtle))]/60 bg-[hsl(var(--bg))]/85 shadow-[0_10px_40px_rgba(49,51,44,0.06)] backdrop-blur-xl"
			>
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10 lg:py-5">
					<Link
						className="font-serif text-xl font-medium tracking-tight text-[hsl(var(--text-primary))] sm:text-2xl"
						to="/"
					>
						Ceits
					</Link>
					<div className="hidden items-center gap-8 md:flex">
						<a
							className="border-b-2 border-[hsl(var(--text-primary))]/10 text-xs font-bold uppercase tracking-widest text-[hsl(var(--text-primary))] transition hover:opacity-80"
							href="#spaces"
						>
							Shared spaces
						</a>
						<a
							className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))]"
							href="#features"
						>
							Features
						</a>
						<a
							className="text-xs font-medium uppercase tracking-widest text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))]"
							href="#how-it-works"
						>
							How it works
						</a>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<a
							className="hidden h-10 items-center rounded-md px-3 text-sm font-medium text-[hsl(var(--text-secondary))] transition hover:text-[hsl(var(--text-primary))] sm:inline-flex"
							href={appUrl("/login")}
						>
							Sign in
						</a>
						<PrimaryCta className="px-5 py-2.5 text-sm">Get started</PrimaryCta>
					</div>
				</div>
			</nav>

			<header className="relative overflow-hidden px-4 py-16 sm:px-6 md:py-24 lg:px-10 lg:py-32">
				<div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
					<motion.div
						className="z-10"
						initial="hidden"
						variants={fadeUpVariants}
						viewport={viewportScroll}
						whileInView="visible"
					>
						<h1 className="mb-6 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
							Money feels different when you&apos;re{" "}
							<span className="italic">on the same page.</span>
						</h1>
						<p className="mb-8 max-w-xl text-lg font-light leading-relaxed text-[hsl(var(--text-secondary))] md:text-xl">
							Capture shared expenses by text, voice, or receipt photo — and
							keep everything in one shared place.
						</p>
						<div className="mb-10 flex flex-wrap gap-3">
							<PrimaryCta className="px-8 py-3.5">Get started</PrimaryCta>
							<SecondaryCta href="#how-it-works" className="px-8 py-3.5">
								See how it works
							</SecondaryCta>
						</div>
						<div className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.15em] text-[hsl(var(--text-secondary))]/80">
							<span
								aria-hidden
								className="h-px w-8 bg-[hsl(var(--border-subtle))]"
							/>
							Shared spaces for home, bills, trips, and everyday life
						</div>
					</motion.div>
					<motion.div
						className="relative"
						initial="hidden"
						variants={fadeUpVariants}
						viewport={viewportScroll}
						whileInView="visible"
					>
						<div
							aria-hidden
							className="absolute inset-0 -z-10 rounded-full bg-[hsl(var(--surface-muted))]/40 blur-[100px]"
						/>
						<div className="relative rounded-xl bg-[hsl(var(--surface))] p-3 shadow-xl transition-transform duration-700 sm:rotate-1 sm:hover:rotate-0">
							<img
								alt="Warm home workspace with laptop and natural light"
								className="aspect-[4/3] w-full rounded-lg object-cover"
								height={768}
								src={imgHero}
								width={1024}
							/>
							<div className="absolute -bottom-4 -left-2 max-w-[240px] rounded-xl border border-[hsl(var(--border-subtle))]/40 bg-[hsl(var(--bg))] p-5 shadow-lg sm:-bottom-6 sm:-left-6">
								<div className="mb-3 flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--surface-muted))]">
										<IconReceipt />
									</div>
									<div>
										<div className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--text-secondary))]">
											New entry
										</div>
										<div className="font-serif text-sm">Whole Foods Market</div>
									</div>
								</div>
								<div className="font-serif text-2xl font-light">$142.50</div>
							</div>
						</div>
					</motion.div>
				</div>
			</header>

			<section
				aria-labelledby="features-heading"
				className="bg-[hsl(var(--surface-muted))] py-20 sm:py-24 lg:py-32"
				id="features"
			>
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
					<div className="mb-12 lg:mb-20">
						<h2
							className="mb-3 font-serif text-3xl tracking-tight sm:text-4xl md:text-5xl"
							id="features-heading"
						>
							Beyond the spreadsheet.
						</h2>
						<p className="text-lg text-[hsl(var(--text-secondary))]">
							Because household money is more than a list of numbers.
						</p>
					</div>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
						<div className="flex min-h-[22rem] flex-col justify-between rounded-xl bg-[hsl(var(--bg))] p-8 md:col-span-2 md:min-h-[25rem] md:p-10">
							<div>
								<IconCamera />
								<h3 className="mt-4 font-serif text-2xl">Snap receipts</h3>
								<p className="mt-3 max-w-md leading-relaxed text-[hsl(var(--text-secondary))]">
									Turn paper clutter into organized shared expenses. Details
									from receipts land in your shared space so you can stay
									present.
								</p>
							</div>
							<div className="mt-6 overflow-hidden rounded-lg md:mt-8">
								<img
									alt="Phone over a receipt on a wooden table"
									className="h-44 w-full object-cover opacity-90"
									height={192}
									src={imgReceipt}
									width={800}
								/>
							</div>
						</div>
						<div className="flex flex-col justify-between rounded-xl bg-[hsl(var(--text-primary))] p-8 text-[hsl(var(--bg))] md:p-10">
							<div>
								<IconMic />
								<h3 className="mt-4 font-serif text-2xl">Capture your way</h3>
								<p className="mt-3 leading-relaxed text-[hsl(var(--bg))]/85">
									Type, voice, or photo in seconds — in line at the store or on
									the way home.
								</p>
							</div>
							<p className="mt-8 text-xs font-semibold uppercase tracking-widest text-[hsl(var(--bg))]/70 md:mt-12">
								Web + companion capture
							</p>
						</div>
						<div className="rounded-xl bg-[hsl(var(--surface))] p-8 md:p-10">
							<IconFolder />
							<h3 className="mt-4 font-serif text-2xl">Money in context</h3>
							<p className="mt-3 leading-relaxed text-[hsl(var(--text-secondary))]">
								Group by household, trip, or project. Keep goals separate from
								day-to-day noise.
							</p>
						</div>
						<div className="flex flex-col gap-8 rounded-xl border border-[hsl(var(--border-subtle))]/50 bg-[hsl(var(--bg))] p-8 md:col-span-2 md:flex-row md:items-center md:gap-12 md:p-10">
							<div className="flex-1">
								<IconSync />
								<h3 className="mt-4 font-serif text-2xl">Stay aligned</h3>
								<p className="mt-3 leading-relaxed text-[hsl(var(--text-secondary))]">
									See what changed in one thread. Fewer end-of-month “who paid
									for what?” surprises.
								</p>
							</div>
							<div aria-hidden className="hidden w-1/3 space-y-3 md:block">
								<div className="h-2 w-full rounded-full bg-[hsl(var(--border-subtle))]/30" />
								<div className="h-2 w-3/4 rounded-full bg-[hsl(var(--border-subtle))]/30" />
								<div className="h-2 w-1/2 rounded-full bg-[hsl(var(--border-subtle))]/30" />
							</div>
						</div>
					</div>
				</div>
			</section>

			<section
				aria-labelledby="flow-heading"
				className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-32"
				id="how-it-works"
			>
				<div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-2 lg:gap-24">
					<div>
						<h2
							className="mb-4 font-serif text-3xl tracking-tight sm:text-4xl md:text-5xl"
							id="flow-heading"
						>
							A calmer flow for shared everyday money.
						</h2>
						<p className="mb-10 text-lg text-[hsl(var(--text-secondary))]">
							Ceits helps couples and families capture quickly, organize
							naturally, and stay in sync without spreadsheet friction.
						</p>
						<div className="relative space-y-10 before:absolute before:bottom-2 before:left-[1.15rem] before:top-2 before:w-px before:bg-[hsl(var(--border-subtle))]/40 md:space-y-12">
							{[
								{
									n: "1",
									t: "Capture",
									d: "Text, voice, or a receipt photo. Ceits helps turn it into a structured entry in your space.",
								},
								{
									n: "2",
									t: "Organize",
									d: "Route to the right shared space — home, trip, or anything you name.",
								},
								{
									n: "3",
									t: "Stay aligned",
									d: "Activity and recurring bills stay visible so the household shares one picture.",
								},
							].map((step) => (
								<div className="relative pl-12" key={step.n}>
									<div className="absolute left-0 top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[hsl(var(--border-subtle))]/30 bg-[hsl(var(--bg))] font-serif text-sm">
										{step.n}
									</div>
									<h4 className="mb-1 font-serif text-xl">{step.t}</h4>
									<p className="text-[hsl(var(--text-secondary))]">{step.d}</p>
								</div>
							))}
						</div>
						<a
							className="mt-12 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--accent))] transition hover:opacity-80"
							href="#spaces"
						>
							Explore shared spaces
							<span aria-hidden>→</span>
						</a>
					</div>
					<div className="rounded-xl bg-[hsl(var(--surface-muted))] p-6 lg:p-12">
						<img
							alt="Calm app interface mockup"
							className="w-full rounded-xl shadow-2xl"
							height={900}
							src={imgFlow}
							width={1200}
						/>
					</div>
				</div>
			</section>

			<section className="bg-[hsl(var(--bg))] py-20 sm:py-24 lg:py-32">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
					<div className="grid grid-cols-1 items-center gap-12 md:gap-20 lg:grid-cols-2">
						<div className="order-2 lg:order-1">
							<div className="relative">
								<div
									aria-hidden
									className="absolute -inset-2 rounded-full bg-[hsl(var(--surface-muted))]/60 blur-2xl"
								/>
								<img
									alt="Receipt detail on a phone"
									className="relative w-full rounded-xl object-cover shadow-lg aspect-video"
									height={540}
									src={imgOcr}
									width={960}
								/>
							</div>
						</div>
						<div className="order-1 lg:order-2">
							<h2 className="mb-3 font-serif text-3xl md:text-4xl">
								Clear from the first snap.
							</h2>
							<p className="mb-8 text-lg text-[hsl(var(--text-secondary))]">
								Reads receipts into shared spaces so you spend less time on data
								entry.
							</p>
							<ul className="space-y-6">
								{[
									{
										t: "Merchant and amount",
										d: "Ceits pulls the basics so you can confirm in one tap.",
									},
									{
										t: "Suggested structure",
										d: "Entries stay attached to the space they belong to.",
									},
									{
										t: "Receipt on file",
										d: "Proof stays with the expense for returns or taxes.",
									},
								].map((item) => (
									<li className="flex gap-4" key={item.t}>
										<IconCheck />
										<div>
											<span className="block font-semibold text-[hsl(var(--text-primary))]">
												{item.t}
											</span>
											<span className="text-sm text-[hsl(var(--text-secondary))]">
												{item.d}
											</span>
										</div>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>

			<section
				aria-labelledby="spaces-heading"
				className="bg-[hsl(var(--bg))] px-4 py-20 sm:px-6 lg:px-10 lg:py-32"
				id="spaces"
			>
				<div className="mx-auto max-w-7xl">
					<div className="mb-16 text-center lg:mb-24">
						<h2
							className="mb-3 font-serif text-3xl md:text-4xl lg:text-5xl"
							id="spaces-heading"
						>
							Designed for shared living.
						</h2>
						<p className="mx-auto max-w-xl text-[hsl(var(--text-secondary))]">
							Adapts to life&apos;s chapters — from a new place to a growing
							household.
						</p>
					</div>
					<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
						{[
							{
								src: imgScenarioApt,
								title: "New apartment",
								body: "Rent, deposits, and the first shared pantry.",
							},
							{
								src: imgScenarioFamily,
								title: "Growing family",
								body: "Groceries, school costs, and household upkeep.",
							},
							{
								src: imgScenarioTrip,
								title: "Weekend trip",
								body: "Travel, dining, and shared bookings on the go.",
							},
							{
								src: imgScenarioSubs,
								title: "Shared subscriptions",
								body: "Streaming, broadband, utilities — visible and split fairly.",
							},
						].map((card) => (
							<div className="group" key={card.title}>
								<div className="mb-4 overflow-hidden rounded-xl bg-[hsl(var(--surface))]">
									<img
										alt=""
										className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-105"
										height={500}
										src={card.src}
										width={400}
									/>
								</div>
								<h4 className="mb-1 font-serif text-xl">{card.title}</h4>
								<p className="text-sm text-[hsl(var(--text-secondary))]">
									{card.body}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="overflow-hidden bg-[hsl(var(--surface-muted))] py-20 sm:py-24 lg:py-32">
				<div className="mx-auto flex max-w-7xl flex-col items-center gap-14 px-4 sm:px-6 lg:flex-row lg:gap-24 lg:px-10">
					<div className="flex-1">
						<h2 className="mb-4 font-serif text-3xl md:text-4xl lg:text-5xl">
							Keep your household on the same page.
						</h2>
						<p className="mb-10 text-lg text-[hsl(var(--text-secondary))]">
							Bills, activity, and expenses in one calm place — less mental
							math, less digging through messages.
						</p>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
							<div className="rounded-xl bg-[hsl(var(--bg))] p-6 md:p-8">
								<div className="mb-4 text-xs font-bold uppercase tracking-widest text-[hsl(var(--text-primary))]">
									Shared activity
								</div>
								<ul className="space-y-3 text-sm">
									{[
										["Groceries", "$84.20"],
										["Summer camp", "$450.00"],
										["Home project", "$128.50"],
									].map(([label, amt]) => (
										<li
											className="flex justify-between border-b border-[hsl(var(--border-subtle))]/30 pb-2 last:border-0"
											key={label}
										>
											<span>{label}</span>
											<span className="font-serif">{amt}</span>
										</li>
									))}
								</ul>
							</div>
							<div className="rounded-xl bg-[hsl(var(--bg))] p-6 md:p-8">
								<div className="mb-4 text-xs font-bold uppercase tracking-widest text-[hsl(var(--text-primary))]">
									Recurring bills
								</div>
								<ul className="space-y-3 text-sm">
									{[
										["Netflix", "$19.99"],
										["Broadband", "$65.00"],
										["Electricity", "$112.40"],
									].map(([label, amt]) => (
										<li
											className="flex justify-between border-b border-[hsl(var(--border-subtle))]/30 pb-2 last:border-0"
											key={label}
										>
											<span>{label}</span>
											<span className="font-serif">{amt}</span>
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
					<div className="relative flex-1">
						<div
							aria-hidden
							className="absolute -right-20 -top-20 -z-10 h-[min(600px,80vw)] w-[min(600px,80vw)] rounded-full bg-[hsl(var(--surface))]/40 blur-3xl"
						/>
						<img
							alt="Calm desk with stationery and soft light"
							className="relative w-full max-w-lg rotate-2 rounded-xl shadow-2xl lg:max-w-none"
							height={600}
							src={imgHarmony}
							width={800}
						/>
					</div>
				</div>
			</section>

			<section className="px-4 py-20 text-center sm:px-6 md:py-28 lg:py-40">
				<div className="mx-auto max-w-4xl">
					<h2 className="mb-6 font-serif text-4xl tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
						Start managing money together.
					</h2>
					<p className="mb-10 text-lg font-light text-[hsl(var(--text-secondary))] md:text-xl">
						Create your first shared space and bring bills, receipts, and
						household spending together.
					</p>
					<div className="flex flex-wrap justify-center gap-4">
						<PrimaryCta className="px-10 py-4 text-base">
							Get started
						</PrimaryCta>
						<SecondaryCta
							href={appUrl("/login")}
							className="px-10 py-4 text-base"
						>
							Sign in
						</SecondaryCta>
					</div>
				</div>
			</section>

			{page.faq.length > 0 ? (
				<section
					aria-labelledby="faq-heading"
					className="border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-muted))]/50 px-4 py-16 sm:px-6 lg:px-10"
				>
					<div className="mx-auto max-w-3xl">
						<h2
							className="mb-8 text-center font-serif text-3xl tracking-tight"
							id="faq-heading"
						>
							FAQ
						</h2>
						<div className="space-y-3">
							{page.faq.map((item) => (
								<details
									className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg))] p-5"
									key={item.question}
								>
									<summary className="cursor-pointer text-sm font-semibold leading-6">
										{item.question}
									</summary>
									<p className="mt-3 text-sm leading-7 text-[hsl(var(--text-secondary))]">
										{item.answer}
									</p>
								</details>
							))}
						</div>
					</div>
				</section>
			) : null}

			<section
				aria-labelledby="related-heading"
				className="border-t border-[hsl(var(--border-subtle))] px-4 py-14 sm:px-6 lg:px-10"
			>
				<div className="mx-auto max-w-7xl">
					<motion.h2
						className="mb-6 font-serif text-2xl tracking-tight"
						id="related-heading"
						initial="hidden"
						variants={fadeUpVariants}
						viewport={viewportScroll}
						whileInView="visible"
					>
						Related pages
					</motion.h2>
					<motion.div
						className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
						initial="hidden"
						variants={staggerContainer}
						viewport={viewportScroll}
						whileInView="visible"
					>
						{relatedPages.map((relatedPage) => (
							<motion.div key={relatedPage.slug} variants={staggerItem}>
								<RelatedCard page={relatedPage} />
							</motion.div>
						))}
					</motion.div>
				</div>
			</section>

			<footer className="bg-[hsl(var(--surface-muted))] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
				<div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:gap-16">
					<div>
						<div className="mb-4 font-serif text-xl text-[hsl(var(--text-primary))]">
							Ceits
						</div>
						<p className="mb-6 max-w-sm text-sm leading-relaxed text-[hsl(var(--text-secondary))]">
							A calmer way for couples and families to keep shared money in
							context.
						</p>
						<p className="text-sm text-[hsl(var(--text-secondary))]">
							© {new Date().getFullYear()} Ceits
						</p>
					</div>
					<div className="flex flex-col gap-6 md:items-end">
						<div className="flex flex-wrap gap-6 text-sm text-[hsl(var(--text-secondary))] md:justify-end md:gap-8">
							<Link
								className="transition hover:text-[hsl(var(--text-primary))]"
								to="/for-couples"
							>
								For couples
							</Link>
							<Link
								className="transition hover:text-[hsl(var(--text-primary))]"
								to="/for-families"
							>
								For families
							</Link>
							<a
								className="transition hover:text-[hsl(var(--text-primary))]"
								href={appUrl("/login")}
							>
								Sign in
							</a>
						</div>
					</div>
				</div>
			</footer>
		</motion.div>
	);
};
