import type { DashboardVariant } from "@cofi/api";
import { type ReactNode, createContext, useContext, useMemo } from "react";

type DashboardVariantContextValue = {
	variant: DashboardVariant;
};

const DashboardVariantContext =
	createContext<DashboardVariantContextValue | null>(null);

export const DashboardVariantProvider = ({
	variant,
	children,
}: {
	variant: DashboardVariant;
	children: ReactNode;
}) => {
	const value = useMemo(() => ({ variant }), [variant]);
	return (
		<DashboardVariantContext.Provider value={value}>
			{children}
		</DashboardVariantContext.Provider>
	);
};

export const useDashboardVariant = (): DashboardVariantContextValue => {
	const ctx = useContext(DashboardVariantContext);
	if (!ctx) {
		throw new Error(
			"useDashboardVariant must be used within DashboardVariantProvider",
		);
	}
	return ctx;
};
