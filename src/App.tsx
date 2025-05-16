import { AuthProvider, useAuth } from "@contexts/AuthContext";
import { Analytics } from "@pages/Analytics";
import { Expenses } from "@pages/Expenses";
import { Settings } from "@pages/Settings";
import { ForgotPassword } from "@pages/auth/ForgotPassword";
import { Login } from "@pages/auth/Login";
import { Register } from "@pages/auth/Register";
import { ResetPassword } from "@pages/auth/ResetPassword";
import { TelegramCallback } from "@pages/auth/TelegramCallback";
import * as Sentry from "@sentry/react";
import { browserTracingIntegration } from "@sentry/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useTelegram } from "./hooks/useTelegram";
import { Layout } from "./layouts/Layout";
import { Home } from "./pages/Home";
import { Promo } from "./pages/Promo";
import { QueryProvider } from "./providers/QueryProvider";
import "./i18n/config";

Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN || "", // Set your Sentry DSN in env
	integrations: [browserTracingIntegration()],
	tracesSampleRate: 1.0,
	environment: import.meta.env.VITE_ENVIRONMENT || "development",
});

function AppContent() {
	const { error } = useTelegram();
	const { isAuthenticated, isLoading } = useAuth();

	if (error) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-red-500">Error</h1>
					<p className="mt-2 text-muted-foreground">{error}</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<Routes>
			{/* Public routes */}
			<Route path="/" element={<Promo />} />

			{/* Auth routes */}
			<Route path="/auth">
				<Route
					path="login"
					element={
						!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />
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
				<Route path="telegram/callback" element={<TelegramCallback />} />
			</Route>

			{/* Protected routes */}
			<Route
				path="/dashboard/*"
				element={
					isAuthenticated ? (
						<Layout>
							<Routes>
								<Route path="/" element={<Home />} />
								<Route path="/analytics" element={<Analytics />} />
								<Route path="/settings" element={<Settings />} />
							</Routes>
						</Layout>
					) : (
						<Navigate to="/" replace />
					)
				}
			/>

			{/* Protected standalone routes */}
			<Route
				path="/expenses"
				element={
					isAuthenticated ? (
						<Layout>
							<Expenses />
						</Layout>
					) : (
						<Navigate to="/" replace />
					)
				}
			/>
		</Routes>
	);
}

const App = () => (
	<Sentry.ErrorBoundary
		fallback={
			<div className="text-red-500">
				An unexpected error occurred. Please refresh the page.
			</div>
		}
		showDialog
	>
		<BrowserRouter basename={import.meta.env.BASE_URL}>
			<AuthProvider>
				<QueryProvider>
					<AppContent />
				</QueryProvider>
			</AuthProvider>
		</BrowserRouter>
	</Sentry.ErrorBoundary>
);

export default App;
