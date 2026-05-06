import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const VoiceCaptureIcon = ({
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
			<path
				d="M9 4.5h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M10 7h4M10 9h4M10 11h3"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M8 14.5h8M12 14.5v3.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<path
				d="M9 20.5h6"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
