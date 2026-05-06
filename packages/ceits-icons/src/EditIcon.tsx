import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const EditIcon = ({
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
				d="m15 4.5 4.5 4.5L8 19.5H4v-4L15 4.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M13.5 6 18 10.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path d="M7 19.5h5" stroke={acc} strokeLinecap="round" strokeWidth={sw} />
		</svg>
	);
};
