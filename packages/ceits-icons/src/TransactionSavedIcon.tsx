import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const TransactionSavedIcon = ({
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
				d="M6 5.5h10a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 16 19.5H6A1.5 1.5 0 0 1 4.5 18V7A1.5 1.5 0 0 1 6 5.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M7.5 9.5h7M7.5 12h7M7.5 14.5h5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M15.5 5.5v3.5l2.25-1.1L20 9V5.5h-4.5Z"
				fill={acc}
				stroke="none"
			/>
		</svg>
	);
};
