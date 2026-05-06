import type { ReactNode } from "react";

type AuthDividerProps = {
	children?: ReactNode;
	/** Match parent surface so the label sits on the card (default Ceits auth card). */
	surfaceClassName?: string;
	className?: string;
};

export const AuthDivider = ({
	children = "or",
	surfaceClassName = "bg-[#FDFCFA]",
	className = "",
}: AuthDividerProps) => (
	<div
		className={`relative py-3 ${className}`}
		role="separator"
		aria-orientation="horizontal"
		tabIndex={0}
	>
		<div className="absolute inset-x-0 top-1/2 border-t border-[#E0D9D0]" />
		<span
			className={`relative mx-auto block max-w-[16rem] px-3 text-center text-[11px] font-medium leading-snug tracking-wide text-balance text-[#8A9199] ${surfaceClassName}`}
		>
			{children}
		</span>
	</div>
);
