import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const SharedSpaceIcon = ({
	size = 24,
	className,
	title,
	accentColor: _a,
	positiveColor: _p,
}: CeitsIconProps) => {
	void _a;
	void _p;
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
				d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 17.5H5A1.5 1.5 0 0 1 3.5 16V8A1.5 1.5 0 0 1 5 6.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M8.5 9.25a1.75 1.75 0 1 0-3.5 0c0 .95.75 1.75 1.75 2.25M8 16.5v-.35a2.75 2.75 0 0 0-2.2-2.7"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M18.5 9.25a1.75 1.75 0 1 0-3.5 0c0 .95.75 1.75 1.75 2.25M16 16.5v-.35a2.75 2.75 0 0 0-2.2-2.7"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
