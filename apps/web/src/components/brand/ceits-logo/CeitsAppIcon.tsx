import { CeitsLogoMark } from "./CeitsLogoMark";
import { ceitsLogoVariantClass } from "./ceitsLogoVariantClass";
import type { CeitsLogoProps } from "./types";

type Props = CeitsLogoProps & {
	/** Outer edge length (squircle). */
	size?: number;
	/** 1px ring using `--ceits-logo-accent` at low opacity. */
	showAccentRing?: boolean;
};

/** Squircle tile: nested C on deep navy (variant `dark`) by default — matches brand reference. */
export const CeitsAppIcon = ({
	className,
	title = "Ceits",
	variant = "dark",
	size = 56,
	showAccentRing = true,
}: Props) => {
	const vClass = ceitsLogoVariantClass(variant);
	const pad = Math.round(size * 0.16);
	const inner = size - pad * 2;
	return (
		<span
			aria-label={title}
			className={`relative inline-flex shrink-0 items-center justify-center rounded-[22%] bg-[var(--ceits-logo-surface)] ${showAccentRing ? "ring-1 ring-[color-mix(in_srgb,var(--ceits-logo-accent)_40%,transparent)]" : ""} ${vClass} ${className ?? ""}`.trim()}
			role="img"
			style={{ height: size, width: size, padding: pad }}
		>
			<CeitsLogoMark density="favicon" size={inner} variant={variant} />
		</span>
	);
};
