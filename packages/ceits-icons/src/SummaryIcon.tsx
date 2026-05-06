import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const SummaryIcon = ({
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
				d="M5.5 7.5h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18V9A1.5 1.5 0 0 1 5.5 7.5Z"
				stroke={acc}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M8 5.5h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H8"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M10.5 12 10.5 9.25A2.75 2.75 0 0 1 14.75 11.5Z"
				fill={acc}
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M10.5 14.5h6M10.5 16.5h4.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
