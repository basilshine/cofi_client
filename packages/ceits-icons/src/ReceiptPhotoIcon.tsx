import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const ReceiptPhotoIcon = ({
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
				d="M5 5h2M5 5v2M19 5h-2M19 5v2M19 19v-2M19 19h-2M5 19h2M5 19v-2"
				stroke={acc}
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M9 5h6v11.5l-.8-.45-.9.55-.85-.55-.9.55-.85-.55L9 16.5V5Z"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M10.5 8.5h3.5M10.5 10.5h4M10.5 12.5h3M11.5 15a.75.75 0 1 0 0 .01"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
