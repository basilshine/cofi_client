import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const NeedsCorrectionIcon = ({
	size = 24,
	className,
	title,
	accentColor: _accentColor,
	positiveColor,
}: CeitsIconProps) => {
	void _accentColor;
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
			<path
				d="M12 6.5a5.5 5.5 0 1 1-1.6 3.9"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M7.5 8.5 6 7l1.25 2"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M15.5 17.5 17 19l-1.25-2"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M14 16.5l2.5-1.5-1 2.5z"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<circle cx="17.5" cy="7.5" fill={pos} r="2.25" />
			<path
				d="M17.5 6.35v1.35M17.5 8.85v.15"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={0.85}
			/>
		</svg>
	);
};
