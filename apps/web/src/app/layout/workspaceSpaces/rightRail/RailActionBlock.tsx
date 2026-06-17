import { Link } from "react-router-dom";

type RailActionBlockProps = {
	title: string;
	description: string;
	contextLine?: string;
	liveHint?: string;
	ctaLabel: string;
	ctaTo: string;
	/** Section label above the card (default: Action). */
	sectionLabel?: string;
	/** Small kicker inside the card (default: Primary decision). */
	cardKicker?: string | null;
	/** Stronger surface + CTA (e.g. Space Overview decision queue). */
	elevated?: boolean;
	/** Ties the rail to content on the main column (e.g. activity list). */
	bridgeHint?: string;
	/** Fires when the primary CTA is hovered (Space Overview ↔ activity highlight). */
	onCtaHoverChange?: (hovered: boolean) => void;
};

export const RailActionBlock = ({
	title,
	description,
	contextLine,
	liveHint,
	ctaLabel,
	ctaTo,
	sectionLabel = "Action",
	cardKicker = "Primary decision",
	elevated = false,
	bridgeHint,
	onCtaHoverChange,
}: RailActionBlockProps) => {
	const cardSurface = elevated
		? "rounded-2xl border border-[rgba(190,175,150,0.42)] bg-[rgba(255,251,244,0.72)] p-5 shadow-[0_16px_34px_-28px_rgba(80,58,32,0.36)] ring-1 ring-inset ring-white/40 transition-shadow duration-150"
		: "rounded-2xl border border-[rgba(189,143,64,0.34)] bg-[linear-gradient(180deg,rgba(255,251,244,0.98)_0%,rgba(255,242,223,0.94)_100%)] p-6 shadow-[0_20px_30px_-24px_rgba(143,104,43,0.85)] transition-shadow duration-150";

	const ctaClass = elevated
		? "mt-4 inline-flex w-full items-center justify-center rounded-xl bg-foreground px-4 py-3.5 text-sm font-semibold tracking-wide text-background shadow-[0_14px_28px_-18px_rgba(22,24,23,0.42)] transition-all duration-150 ease-out hover:bg-foreground/92 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		: "mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[0_12px_24px_-16px_rgba(31,37,35,0.95)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-primary/92 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

	return (
		<section aria-labelledby="rail-action" className="space-y-3">
			<h4
				className={
					elevated
						? "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
						: "eyebrow"
				}
				id="rail-action"
			>
				{sectionLabel}
			</h4>
			<div className={cardSurface}>
				{cardKicker ? (
					<p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgba(111,78,22,0.78)]">
						{cardKicker}
					</p>
				) : null}
				<p
					className={
						elevated
							? cardKicker
								? "mt-1.5 text-lg font-bold tracking-tight text-foreground"
								: "text-lg font-bold tracking-tight text-foreground"
							: cardKicker
								? "mt-1.5 text-lg font-semibold tracking-tight text-foreground"
								: "text-lg font-semibold tracking-tight text-foreground"
					}
				>
					{title}
				</p>
				<p
					className={
						elevated
							? "mt-2 text-sm leading-relaxed text-foreground/76"
							: "mt-2 text-sm leading-relaxed text-foreground/75"
					}
				>
					{description}
				</p>
				{contextLine ? (
					<p
						className={
							elevated
								? "mt-2 text-sm text-foreground/76"
								: "mt-2 text-xs font-medium text-[rgba(111,78,22,0.9)]"
						}
					>
						{contextLine}
					</p>
				) : null}
				{liveHint ? (
					<p
						className={
							elevated
								? "mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
								: "mt-1.5 inline-flex items-center gap-1 text-[11px] text-foreground/65"
						}
					>
						<span
							aria-hidden
							className="inline-flex h-1.5 w-1.5 rounded-full bg-[rgba(142,159,136,0.8)]"
						/>
						<span>{liveHint}</span>
					</p>
				) : null}
				{bridgeHint ? (
					<p className="mt-2.5 text-xs font-medium leading-snug text-[rgba(88,58,14,0.82)]">
						{bridgeHint}
					</p>
				) : null}
				<Link
					className={ctaClass}
					onBlur={() => onCtaHoverChange?.(false)}
					onFocus={() => onCtaHoverChange?.(true)}
					onMouseEnter={() => onCtaHoverChange?.(true)}
					onMouseLeave={() => onCtaHoverChange?.(false)}
					to={ctaTo}
				>
					{ctaLabel}
				</Link>
			</div>
		</section>
	);
};
