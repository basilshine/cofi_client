import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const ConfirmIcon = ({
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
			<circle
				cx="11.5"
				cy="12.5"
				fill="none"
				r="6.5"
				stroke="currentColor"
				strokeWidth={sw}
			/>
			<path
				d="M8.5 12.75 10.5 14.75 15.25 10"
				stroke={pos}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M18.25 5.5 18.6 6.45 19.55 6.8 18.6 7.15 18.25 8.1 17.9 7.15 16.95 6.8 17.9 6.45 18.25 5.5Z"
				fill={pos}
			/>
		</svg>
	);
};
