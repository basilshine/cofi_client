import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const ThreadDiscussionIcon = ({
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
				d="M5.5 7.5h8a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-2l-1.8 1.6V15H7A1.5 1.5 0 0 1 5.5 13.5V9A1.5 1.5 0 0 1 7 7.5Z"
				stroke={acc}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M9.5 5.5h8A1.5 1.5 0 0 1 19 7v5.5a1.5 1.5 0 0 1-1.5 1.5h-2.2l-1.8 1.6V15H11A1.5 1.5 0 0 1 9.5 13.5V5.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M13 10.75h.01M15.25 10.75h.01M17.5 10.75h.01"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
