export type CeitsLogoVariant = "light" | "dark" | "auto";

export type CeitsLogoProps = {
	className?: string;
	title?: string;
	variant?: CeitsLogoVariant;
};

export type CeitsLogoMarkProps = CeitsLogoProps & {
	size?: number;
	/** "compact" favicon-style geometry (24×24 viewBox). */
	density?: "default" | "favicon";
};
