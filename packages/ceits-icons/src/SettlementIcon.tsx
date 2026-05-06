import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const SettlementIcon = ({
	size = 24,
	className,
	title,
	accentColor,
	positiveColor,
}: CeitsIconProps) => {
	const acc = accentColor ?? "hsl(var(--ceits-icon-accent))";
	const pos = positiveColor ?? "hsl(var(--ceits-icon-positive))";
	const sw = CEITS_ICON_STROKE_WIDTH;
	return (
		<svg
			aria-hidden={title ? undefined : true}
			aria-label={title}
			className={`inline-block shrink-0 text-[hsl(var(--ceits-icon-primary))] ${className ?? ""}`.trim()}
			fill="none"
			height={size}
			role={title ? "img" : undefined}
			viewBox="0 0 24 24"
			width={size}
		>
			{title ? <title>{title}</title> : null}
			<circle
				cx="12"
				cy="12"
				fill={pos}
				r="4.25"
				stroke="currentColor"
				strokeWidth={sw}
			/>
			<path
				d="M12 9.5v5M10.25 11c.25-.7.95-1.15 1.75-1.15s1.5.5 1.5 1.1-.75 1.1-1.5 1.1H11M10.25 13c.25.7.95 1.15 1.75 1.15s1.5-.5 1.5-1.1-.75-1.1-1.5-1.1H11"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.05}
			/>
			<path
				d="M12 5.5a6.5 6.5 0 0 1 5.65 3.35M12 18.5a6.5 6.5 0 0 1-5.65-3.35"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M17.25 15.75 18.5 17 17 18.25"
				stroke={acc}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
