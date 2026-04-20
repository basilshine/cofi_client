import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export const WorkspaceRootRedirect = () => {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[hsl(var(--bg))] text-sm text-[hsl(var(--text-secondary))]">
				Loading…
			</div>
		);
	}

	if (isAuthenticated) {
		return <Navigate replace to="/console" />;
	}

	return <Navigate replace to="/login" />;
};
