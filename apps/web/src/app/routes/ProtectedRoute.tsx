import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export const ProtectedRoute = () => {
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
				Loading session…
			</div>
		);
	}

	if (!isAuthenticated) {
		const returnTo = `${location.pathname}${location.search}`;
		return (
			<Navigate
				replace
				to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
			/>
		);
	}

	return <Outlet />;
};
