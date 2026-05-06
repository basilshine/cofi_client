import { CeitsLogoMark } from "./CeitsLogoMark";
import type { CeitsLogoMarkProps } from "./types";

type Props = Omit<CeitsLogoMarkProps, "density">;

/** Compact nested C for 16–24px toolbars and favicon-style slots. */
export const CeitsFaviconMark = ({ size = 24, ...rest }: Props) => {
	return <CeitsLogoMark density="favicon" size={size} {...rest} />;
};
