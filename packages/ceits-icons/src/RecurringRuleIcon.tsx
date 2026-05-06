import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const RecurringRuleIcon = ({
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
				d="M8 6.5h8a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16.5H8A1.5 1.5 0 0 1 6.5 15V8A1.5 1.5 0 0 1 8 6.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M8 6.5V5M16 6.5V5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M9 11h1.5M12 11h1.5M15 11h1.5M9 13.5h1.5M12 13.5h1.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M12 4.25a7.75 7.75 0 0 1 6.9 4.25M12 19.75a7.75 7.75 0 0 1-6.9-4.25"
				stroke={acc}
				strokeLinecap="round"
				strokeWidth={1.35}
			/>
		</svg>
	);
};
