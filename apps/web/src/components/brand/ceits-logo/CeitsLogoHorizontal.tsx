import { CeitsLogoMark } from "./CeitsLogoMark";
import { CeitsWordmark } from "./CeitsWordmark";
import { ceitsLogoVariantClass } from "./ceitsLogoVariantClass";
import type { CeitsLogoProps } from "./types";

type Props = CeitsLogoProps & {
	/** Mark edge length in px. */
	markSize?: number;
	/** Wordmark scale preset. */
	wordmarkSize?: "sm" | "md" | "lg" | "xl";
};

export const CeitsLogoHorizontal = ({
	className,
	title = "Ceits",
	variant = "auto",
	markSize = 36,
	wordmarkSize = "sm",
}: Props) => {
	const vClass = ceitsLogoVariantClass(variant);
	return (
		<span
			className={`inline-flex items-center gap-2.5 ${vClass} ${className ?? ""}`.trim()}
		>
			<CeitsLogoMark size={markSize} title={title} variant={variant} />
			<CeitsWordmark size={wordmarkSize} variant={variant} />
		</span>
	);
};
