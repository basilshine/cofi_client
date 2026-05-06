import type { ReactNode } from "react";

type AuthCardProps = {
	children: ReactNode;
	className?: string;
	role?: string;
	"aria-labelledby"?: string;
};

export const AuthCard = ({
	children,
	className = "",
	role,
	"aria-labelledby": ariaLabelledBy,
}: AuthCardProps) => (
	<div
		aria-labelledby={ariaLabelledBy}
		className={`rounded-2xl border border-[#D4CEC6] bg-[#FDFCFA] p-7 shadow-[0_24px_48px_-28px_rgba(18,32,50,0.12)] md:p-9 ${className}`}
		role={role}
	>
		{children}
	</div>
);
