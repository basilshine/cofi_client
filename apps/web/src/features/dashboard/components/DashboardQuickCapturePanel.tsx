import type { ReactNode } from "react";

export type DashboardQuickCaptureVariant = "personal" | "business";

export type DashboardQuickCaptureProminence = "framed" | "hero";

type DashboardQuickCapturePanelProps = {
	variant: DashboardQuickCaptureVariant;
	children: ReactNode;
	className?: string;
	/** `hero` = high-contrast inverted strip (main capture surface). */
	prominence?: DashboardQuickCaptureProminence;
};

const panelShell: Record<DashboardQuickCaptureVariant, string> = {
	personal:
		"rounded-2xl bg-gradient-to-br from-amber-500/18 via-orange-500/8 to-transparent p-[2px] shadow-[0_1px_0_0_rgba(245,158,11,0.12)_inset]",
	business:
		"rounded-2xl bg-gradient-to-br from-emerald-600/22 via-green-700/12 to-transparent p-[2px] shadow-[0_1px_0_0_rgba(5,150,105,0.2)_inset]",
};

const panelInner: Record<DashboardQuickCaptureVariant, string> = {
	personal: "rounded-[0.875rem] bg-[hsl(var(--surface))]",
	business: "rounded-[0.875rem] bg-[hsl(var(--surface))]",
};

const heroRoot: Record<DashboardQuickCaptureVariant, string> = {
	personal: "dashboard-qc-hero--personal",
	business: "dashboard-qc-hero--business",
};

/**
 * Visual frame for quick capture: optional hero (inverted) vs light framed ring.
 */
export const DashboardQuickCapturePanel = ({
	variant,
	children,
	className = "",
	prominence = "framed",
}: DashboardQuickCapturePanelProps) => {
	if (prominence === "hero") {
		return (
			<div
				className={["min-w-0", heroRoot[variant], className]
					.filter(Boolean)
					.join(" ")}
			>
				<div className="dashboard-qc-hero__inner">{children}</div>
			</div>
		);
	}

	return (
		<div className={["min-w-0", className].filter(Boolean).join(" ")}>
			<div className={panelShell[variant]}>
				<div className={panelInner[variant]}>{children}</div>
			</div>
		</div>
	);
};
