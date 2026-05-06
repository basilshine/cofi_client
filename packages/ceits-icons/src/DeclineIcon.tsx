import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const DeclineIcon = ({
	size = 24,
	className,
	title,
	accentColor: _accentColor,
	positiveColor: _positiveColor,
}: CeitsIconProps) => {
	void _accentColor;
	void _positiveColor;
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
				fill="none"
				r="6.5"
				stroke="currentColor"
				strokeWidth={sw}
			/>
			<path
				d="M9.25 9.25l5.5 5.5M14.75 9.25l-5.5 5.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
