import type { CeitsIconProps } from "./types";
import { CEITS_ICON_STROKE_WIDTH } from "./types";

export const SplitExpenseIcon = ({
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
			<circle
				cx="12"
				cy="7.25"
				fill={acc}
				r="3.35"
				stroke="currentColor"
				strokeWidth={sw}
			/>
			<path
				d="M12 5.2v4.1M10.5 6.35c0-.55.65-.95 1.5-.95s1.5.4 1.5.95-.65.95-1.5.95-1.5.4-1.5.95.65.95 1.5.95 1.5-.4 1.5-.95"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.15}
			/>
			<path
				d="M12 10.6v2.15M8.25 14.75 12 12.75l3.75 2"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={sw}
			/>
			<circle
				cx="8.25"
				cy="17.25"
				fill="none"
				r="2.85"
				stroke={acc}
				strokeWidth={sw}
			/>
			<circle
				cx="15.75"
				cy="17.25"
				fill="none"
				r="2.85"
				stroke={acc}
				strokeWidth={sw}
			/>
		</svg>
	);
};
