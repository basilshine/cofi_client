import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const DraftCardIcon = ({
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
				d="M6 6.5h12a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 18 18.5H6A1.5 1.5 0 0 1 4.5 17V8A1.5 1.5 0 0 1 6 6.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<rect fill={acc} height="3" rx="0.5" width="3" x="7.5" y="8.5" />
			<path
				d="M12 9.5h4.5M12 12.5h4.5M12 15.5h3"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
