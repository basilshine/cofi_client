import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const ParseStructureIcon = ({
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
			<rect
				height="3"
				rx="0.6"
				stroke="currentColor"
				strokeWidth={sw}
				width="3"
				x="6"
				y="4"
			/>
			<rect fill={acc} height="3" rx="0.6" width="3" x="10.5" y="4" />
			<rect
				height="3"
				rx="0.6"
				stroke="currentColor"
				strokeWidth={sw}
				width="3"
				x="15"
				y="4"
			/>
			<path
				d="M7.5 7v2.5M12 7v2.5M16.5 7v2.5M9.5 9.5h5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M12 11.5 9.5 14h5L12 11.5Z"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M7.5 14.5v2l2 1.5M12 16.5v-2M16.5 14.5v2l-2 1.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<rect
				height="3"
				rx="0.6"
				stroke="currentColor"
				strokeWidth={sw}
				width="3"
				x="5.5"
				y="17"
			/>
			<rect
				height="3"
				rx="0.6"
				stroke="currentColor"
				strokeWidth={sw}
				width="3"
				x="10.5"
				y="17"
			/>
			<rect
				height="3"
				rx="0.6"
				stroke="currentColor"
				strokeWidth={sw}
				width="3"
				x="15.5"
				y="17"
			/>
		</svg>
	);
};
