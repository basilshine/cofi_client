import { DebugInfo } from "@components/DebugInfo";
import { LoadingScreen } from "@components/LoadingScreen";
import { AuthProvider, useAuth } from "@contexts/AuthContext";
import { Analytics } from "@pages/Analytics";
import { Debug } from "@pages/Debug";
import { ExpenseEdit } from "@pages/ExpenseEdit";
import { Expenses } from "@pages/Expenses";
import { Profile } from "@pages/Profile";
import { Settings } from "@pages/Settings";
import { ForgotPassword } from "@pages/auth/ForgotPassword";
import { Login } from "@pages/auth/Login";
import { Register } from "@pages/auth/Register";
import { ResetPassword } from "@pages/auth/ResetPassword";
import { isTelegramWebApp } from "@utils/isTelegramWebApp";
import LogRocket from "logrocket";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./layouts/Layout";
import { WebAppLayout } from "./layouts/WebAppLayout";
import { Home } from "./pages/Home";
import { Promo } from "./pages/Promo";
import { QueryProvider } from "./providers/QueryProvider";
import "./i18n/config";

function AppContent() {
	const { isAuthenticated, isLoading } = useAuth();
	const isWebAppUser = isTelegramWebApp();

	// Log layout detection for debugging
	useEffect(() => {
		const debugInfo = {
			isWebAppUser,
			currentURL: window.location.href,
			userAgent: navigator.userAgent,
			hasTelegramWebApp: !!window.Telegram?.WebApp,
			urlSearch: window.location.search,
			urlHash: window.location.hash,
			startappParam: new URLSearchParams(window.location.search).get(
				"startapp",
			),
			hasHashTgData: window.location.hash.includes("tgWebAppData="),
		};

		console.log("[App] Layout Detection Debug:", debugInfo);
		LogRocket.log("[App] Layout Detection", debugInfo);
	}, [isWebAppUser]);

	// Choose the appropriate layout based on the environment
	const AppLayout = isWebAppUser ? WebAppLayout : Layout;

	// Log which layout is being used
	useEffect(() => {
		const layoutInfo = {
			layoutUsed: isWebAppUser ? "WebAppLayout" : "Layout",
			isWebAppUser,
			isAuthenticated,
			isLoading,
		};
		console.log("[App] Layout Selection:", layoutInfo);
		LogRocket.log("[App] Layout Selection", layoutInfo);
	}, [isWebAppUser, isAuthenticated, isLoading]);

	// Handle startapp parameter preservation for WebApp users
	useEffect(() => {
		if (isWebAppUser && !isAuthenticated && !isLoading) {
			const startappParam = new URLSearchParams(window.location.search).get(
				"startapp",
			);
			const persistedStartappParam = sessionStorage.getItem(
				"cofi_telegram_startapp_param",
			);

			console.log("[App] WebApp authentication state check:", {
				startappParam,
				persistedStartappParam,
				currentPath: window.location.pathname,
				isAuthenticated,
				isLoading,
			});

			// If we have a startapp parameter but user is not authenticated yet,
			// ensure it's preserved in sessionStorage
			if (startappParam && !persistedStartappParam) {
				sessionStorage.setItem("cofi_telegram_startapp_param", startappParam);
				console.log(
					"[App] Preserved startapp parameter in sessionStorage:",
					startappParam,
				);
			}
		}
	}, [isWebAppUser, isAuthenticated, isLoading]);

	if (isLoading) {
		return <LoadingScreen />;
	}

	// For Telegram WebApp users, redirect unauthenticated users to dashboard
	// (they will be auto-logged in by the AuthContext)
	const getUnauthenticatedRedirect = () => {
		if (isWebAppUser) {
			// For WebApp users, check if we have a startapp parameter
			const startappParam = new URLSearchParams(window.location.search).get(
				"startapp",
			);
			const persistedStartappParam = sessionStorage.getItem(
				"cofi_telegram_startapp_param",
			);

			console.log("[App] WebApp unauthenticated redirect check:", {
				startappParam,
				persistedStartappParam,
				currentPath: window.location.pathname,
			});

			// If we have a startapp parameter or are on a specific route, don't redirect yet
			// Let the AuthContext handle the navigation after authentication
			if (
				startappParam ||
				persistedStartappParam ||
				window.location.pathname !== "/"
			) {
				console.log(
					"[App] Preserving current location for WebApp authentication",
				);
				// Return null to prevent redirect, let the current route handle it
				return null;
			}

			// For WebApp users without specific parameters, redirect to dashboard where they'll be auto-logged in
			return <Navigate to="/dashboard" replace />;
		}
		// For regular web users, redirect to promo page
		return <Navigate to="/" replace />;
	};

	return (
		<>
			<DebugInfo />
			<Routes>
				{/* Public routes - only for non-WebApp users */}
				{!isWebAppUser && <Route path="/" element={<Promo />} />}

				{/* For WebApp users, redirect root to dashboard */}
				{isWebAppUser && (
					<Route path="/" element={<Navigate to="/dashboard" replace />} />
				)}

				{/* Auth routes - only for non-WebApp users */}
				{!isWebAppUser && (
					<Route path="/auth">
						<Route
							path="login"
							element={
								!isAuthenticated ? (
									<Login />
								) : (
									<Navigate to="/dashboard" replace />
								)
							}
						/>
						<Route
							path="register"
							element={
								!isAuthenticated ? (
									<Register />
								) : (
									<Navigate to="/dashboard" replace />
								)
							}
						/>
						<Route
							path="forgot-password"
							element={
								!isAuthenticated ? (
									<ForgotPassword />
								) : (
									<Navigate to="/dashboard" replace />
								)
							}
						/>
						<Route
							path="reset-password"
							element={
								!isAuthenticated ? (
									<ResetPassword />
								) : (
									<Navigate to="/dashboard" replace />
								)
							}
						/>
					</Route>
				)}

				{/* Protected routes */}
				<Route
					path="/dashboard/*"
					element={
						isAuthenticated ? (
							<AppLayout title="Dashboard">
								<Routes>
									<Route path="/" element={<Home />} />
									<Route path="/analytics" element={<Analytics />} />
									<Route
										path="/settings"
										element={isWebAppUser ? <Profile /> : <Settings />}
									/>
									<Route path="/debug" element={<Debug />} />
								</Routes>
							</AppLayout>
						) : (
							getUnauthenticatedRedirect() || <LoadingScreen />
						)
					}
				/>

				{/* Protected standalone routes */}
				<Route
					path="/expenses"
					element={
						isAuthenticated ? (
							<AppLayout title="Expenses">
								<Expenses />
							</AppLayout>
						) : (
							getUnauthenticatedRedirect() || <LoadingScreen />
						)
					}
				/>
				<Route
					path="/expenses/add"
					element={
						isAuthenticated ? (
							<AppLayout title="Add Expense" showBackButton={true}>
								<ExpenseEdit />
							</AppLayout>
						) : (
							getUnauthenticatedRedirect() || <LoadingScreen />
						)
					}
				/>
				<Route
					path="/expenses/:id/edit"
					element={
						isAuthenticated ? (
							<AppLayout title="Edit Expense" showBackButton={true}>
								<ExpenseEdit />
							</AppLayout>
						) : (
							getUnauthenticatedRedirect() || <LoadingScreen />
						)
					}
				/>
				<Route
					path="/profile"
					element={
						isAuthenticated ? (
							<AppLayout title="Profile & Settings">
								<Profile />
							</AppLayout>
						) : (
							getUnauthenticatedRedirect() || <LoadingScreen />
						)
					}
				/>

				{/* Catch-all route */}
				<Route
					path="*"
					element={
						isWebAppUser ? (
							<Navigate to="/dashboard" replace />
						) : (
							<Navigate to="/" replace />
						)
					}
				/>
			</Routes>
		</>
	);
}

const App = () => (
	<BrowserRouter basename={import.meta.env.BASE_URL}>
		<AuthProvider>
			<QueryProvider>
				<AppContent />
			</QueryProvider>
		</AuthProvider>
	</BrowserRouter>
);

export default App;
