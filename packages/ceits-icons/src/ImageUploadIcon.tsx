import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const ImageUploadIcon = ({
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
				d="M5.5 7.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-9Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M8 14.5 10.5 12l2 1.5L16 11"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M14.5 8.5h.01"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<circle
				cx="16.5"
				cy="16.5"
				fill="none"
				r="2.75"
				stroke={acc}
				strokeWidth={sw}
			/>
			<path
				d="M16.5 18.25V14.5M14.75 15.75 16.5 14l1.75 1.75"
				stroke={acc}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
