export type CeitsIconProps = {
	size?: number;
	className?: string;
	title?: string;
	/** Secondary fills/strokes (muted sage). Default: `hsl(var(--ceits-icon-accent))`. */
	accentColor?: string;
	/** Highlights (soft gold). Default: `hsl(var(--ceits-icon-positive))`. */
	positiveColor?: string;
};

export const CEITS_ICON_STROKE_WIDTH = 1.5;
