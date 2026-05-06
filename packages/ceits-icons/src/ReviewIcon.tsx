import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const ReviewIcon = ({
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
				d="M5.5 5.5h9a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17V7A1.5 1.5 0 0 1 5.5 5.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M7 9.5h6M7 12h5.5M7 14.5h4"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<circle
				cx="16.5"
				cy="16"
				fill="none"
				r="3.25"
				stroke="currentColor"
				strokeWidth={sw}
			/>
			<path
				d="m18.75 18.25 2.25 2.25"
				stroke={acc}
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
