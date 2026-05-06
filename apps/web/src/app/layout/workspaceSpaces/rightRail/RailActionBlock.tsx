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
		? "rounded-2xl border border-[rgba(175,125,55,0.48)] bg-[linear-gradient(165deg,#fff6e8_0%,#ffeed8_45%,#fff0e0_100%)] p-6 shadow-[0_24px_48px_-22px_rgba(115,75,28,0.42),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-inset ring-white/30 transition-[box-shadow,transform] duration-150 ease-out hover:shadow-[0_26px_52px_-22px_rgba(115,75,28,0.38)]"
		: "rounded-2xl border border-[rgba(189,143,64,0.34)] bg-[linear-gradient(180deg,rgba(255,251,244,0.98)_0%,rgba(255,242,223,0.94)_100%)] p-6 shadow-[0_20px_30px_-24px_rgba(143,104,43,0.85)] transition-shadow duration-150";

	const ctaClass = elevated
		? "mt-5 inline-flex w-full items-center justify-center rounded-xl bg-foreground px-4 py-4 text-sm font-semibold tracking-wide text-background shadow-[0_16px_32px_-14px_rgba(22,24,23,0.45)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-foreground/92 hover:shadow-[0_20px_38px_-14px_rgba(22,24,23,0.42)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		: "mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-[0_12px_24px_-16px_rgba(31,37,35,0.95)] transition-all duration-150 ease-out hover:-translate-y-px hover:bg-primary/92 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

	return (
		<section aria-labelledby="rail-action" className="space-y-3">
			<h4
				className={
					elevated
						? "text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(95,62,16,0.88)]"
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
								? "mt-1.5 text-xl font-bold tracking-tight text-foreground"
								: "text-xl font-bold tracking-tight text-foreground"
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
							? "mt-2.5 text-sm font-medium leading-relaxed text-foreground/82"
							: "mt-2 text-sm leading-relaxed text-foreground/75"
					}
				>
					{description}
				</p>
				{contextLine ? (
					<p
						className={
							elevated
								? "mt-2.5 text-sm font-medium text-[rgba(72,48,12,0.88)]"
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
								? "mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground/72"
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
