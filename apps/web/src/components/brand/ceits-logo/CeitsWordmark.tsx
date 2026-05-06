import { ceitsLogoVariantClass } from "./ceitsLogoVariantClass";
import type { CeitsLogoProps } from "./types";

type Props = Omit<CeitsLogoProps, "title"> & {
	/** Approximate rendered cap height in px (Tailwind text-* mapping). */
	size?: "sm" | "md" | "lg" | "xl";
};

const sizeClass: Record<NonNullable<Props["size"]>, string> = {
	sm: "text-lg md:text-xl",
	md: "text-2xl md:text-[1.75rem]",
	lg: "text-[1.76rem] md:text-[1.82rem]",
	xl: "text-[2.1rem] md:text-[2.28rem]",
};

/** Serif wordmark using project display stack (Noto Serif / editorial). No font file imports. */
export const CeitsWordmark = ({
	className,
	variant = "auto",
	size = "md",
}: Props) => {
	const vClass = ceitsLogoVariantClass(variant);
	return (
		<span
			className={`font-display font-normal tracking-[0.04em] text-[var(--ceits-logo-primary)] antialiased ${sizeClass[size]} ${vClass} ${className ?? ""}`.trim()}
		>
			Ceits
		</span>
	);
};
