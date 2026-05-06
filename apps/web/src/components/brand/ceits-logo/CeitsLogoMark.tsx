import { ceitsLogoVariantClass } from "./ceitsLogoVariantClass";
import type { CeitsLogoMarkProps } from "./types";

/** 64×64 logical grid; viewBox padded so round strokes are not clipped. */
const OUTER_DEFAULT = "M18 50 L18 14 L50 14 M18 50 L50 50";
const INNER_DEFAULT = "M26.5 42.5 L26.5 21.5 L42.5 21.5 M26.5 42.5 L42.5 42.5";
const OUTER_FAVICON = "M4.5 19.5 L4.5 4.5 L19.5 4.5 M4.5 19.5 L19.5 19.5";
const INNER_FAVICON = "M7.5 16.5 L7.5 7.5 L14.5 7.5 M7.5 16.5 L14.5 16.5";

export const CeitsLogoMark = ({
	size = 64,
	className,
	title,
	variant = "auto",
	density = "default",
}: CeitsLogoMarkProps) => {
	const vClass = ceitsLogoVariantClass(variant);
	const isFav = density === "favicon";
	const outer = isFav ? OUTER_FAVICON : OUTER_DEFAULT;
	const inner = isFav ? INNER_FAVICON : INNER_DEFAULT;
	const outerStroke = isFav ? 2.35 : 5;
	const innerStroke = isFav ? 2 : 4.25;
	const vb = isFav ? "-0.5 -0.5 25 25" : "-2 -2 68 68";

	return (
		<span
			className={`inline-flex shrink-0 ${vClass} ${className ?? ""}`.trim()}
		>
			<svg
				aria-hidden={title ? undefined : true}
				aria-label={title}
				className="block max-h-full max-w-full"
				fill="none"
				height={size}
				role={title ? "img" : undefined}
				viewBox={vb}
				width={size}
				xmlns="http://www.w3.org/2000/svg"
			>
				{title ? <title>{title}</title> : null}
				<path
					d={outer}
					stroke="var(--ceits-logo-primary)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={outerStroke}
				/>
				<path
					d={inner}
					stroke="var(--ceits-logo-secondary)"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={innerStroke}
				/>
			</svg>
		</span>
	);
};
