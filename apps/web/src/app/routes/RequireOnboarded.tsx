import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/** Sends users who have not finished Ceits onboarding to `/onboarding`. */
export const RequireOnboarded = () => {
	const { isLoading, onboarding } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
				Loading workspace…
			</div>
		);
	}

	if (onboarding && !onboarding.completed) {
		return (
			<Navigate replace to="/onboarding" state={{ from: location.pathname }} />
		);
	}

	return <Outlet />;
};
