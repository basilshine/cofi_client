import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const InviteParticipantIcon = ({
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
				d="M12 10.5a2.75 2.75 0 1 0-5.5 0c0 1.5 1.25 2.75 2.75 3.5 1.5-.75 2.75-2 2.75-3.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<path
				d="M6.5 18.5v-.5a3.5 3.5 0 0 1 3.5-3.5h.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
			<circle cx="17.5" cy="16.5" fill={acc} r="3.25" />
			<path
				d="M17.5 14.75v3.5M15.75 16.5h3.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth={sw}
			/>
		</svg>
	);
};
