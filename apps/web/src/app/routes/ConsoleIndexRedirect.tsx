import { Navigate, useLocation } from "react-router-dom";
import { readOnboardingIntent } from "../../shared/lib/onboardingIntent";
import { resolveHeaderWorkspaceTab } from "../../shared/lib/resolveHeaderWorkspaceTab";

/** Sends `/console` to the right dashboard — welcome funnel, then saved workspace context. */
export const ConsoleIndexRedirect = () => {
	const { pathname, search } = useLocation();
	const params = new URLSearchParams(search);
	const isWelcome = params.get("welcome") === "1";
	const intent = readOnboardingIntent();

	let variant: "personal" | "business";
	if (isWelcome && intent === "business") {
		variant = "business";
	} else if (isWelcome) {
		variant = "personal";
	} else {
		variant = resolveHeaderWorkspaceTab(pathname);
	}

	return <Navigate replace to={{ pathname: `dashboard/${variant}`, search }} />;
};
