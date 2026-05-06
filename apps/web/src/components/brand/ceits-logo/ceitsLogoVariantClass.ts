import type { CeitsLogoVariant } from "./types";

/** Maps variant to CSS scope classes that set --ceits-logo-* tokens. */
export const ceitsLogoVariantClass = (
	variant: CeitsLogoVariant | undefined,
) => {
	if (variant === "light") return "ceits-logo-variant-light";
	if (variant === "dark") return "ceits-logo-variant-dark";
	return "";
};
