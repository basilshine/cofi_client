import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const BalanceResultIcon = ({
	size = 24,
	className,
	title,
	accentColor,
	positiveColor: _positiveColor,
}: CeitsIconProps) => {
	void _positiveColor;
	const acc = accentColor ?? "hsl(var(--ceits-icon-accent))";
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
			<path
				d="M12 5v14"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<circle
				cx="12"
				cy="12"
				fill="none"
				r="2.25"
				stroke="currentColor"
				strokeWidth={sw}
			/>
			<path
				d="M10.25 12h3.5M10.25 12.85h3.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<circle cx="6.5" cy="8" fill={acc} r="0.9" />
			<circle cx="6.5" cy="10.5" fill={acc} r="0.9" />
			<circle cx="6.5" cy="13" fill={acc} r="0.9" />
			<circle cx="6.5" cy="15.5" fill={acc} r="0.9" />
			<circle cx="17.5" cy="8" fill={acc} r="0.9" />
			<circle cx="17.5" cy="10.5" fill={acc} r="0.9" />
			<circle cx="17.5" cy="13" fill={acc} r="0.9" />
			<circle cx="17.5" cy="15.5" fill={acc} r="0.9" />
		</svg>
	);
};
