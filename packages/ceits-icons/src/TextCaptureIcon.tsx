import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const TextCaptureIcon = ({
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
				d="M7.5 17.5 5 19.5V17a1.5 1.5 0 0 1 1.5-1.5H9"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M7.5 5.5h9A2.5 2.5 0 0 1 19 8v6.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 14.5V8A2.5 2.5 0 0 1 7.5 5.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M8.5 9.5h7M8.5 12h5.5M8.5 14.5h4"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
