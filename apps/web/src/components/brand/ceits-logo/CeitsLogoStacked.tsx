import { CeitsLogoMark } from "./CeitsLogoMark";
import { CeitsWordmark } from "./CeitsWordmark";
import { ceitsLogoVariantClass } from "./ceitsLogoVariantClass";
import type { CeitsLogoProps } from "./types";

type Props = CeitsLogoProps & {
	markSize?: number;
	wordmarkSize?: "sm" | "md" | "lg" | "xl";
};

export const CeitsLogoStacked = ({
	className,
	title = "Ceits",
	variant = "auto",
	markSize = 52,
	wordmarkSize = "md",
}: Props) => {
	const vClass = ceitsLogoVariantClass(variant);
	return (
		<span
			className={`inline-flex flex-col items-center gap-2 text-center ${vClass} ${className ?? ""}`.trim()}
		>
			<CeitsLogoMark size={markSize} title={title} variant={variant} />
			<CeitsWordmark size={wordmarkSize} variant={variant} />
		</span>
	);
};
