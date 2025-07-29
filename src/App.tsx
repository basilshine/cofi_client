import { AuthProvider, useAuth } from "@contexts/AuthContext";
import { Analytics } from "@pages/Analytics";
import { Debug } from "@pages/Debug";
import { ExpenseEdit } from "@pages/ExpenseEdit";
import { Expenses } from "@pages/Expenses";
import { Settings } from "@pages/Settings";
import { ForgotPassword } from "@pages/auth/ForgotPassword";
import { Login } from "@pages/auth/Login";
import { Register } from "@pages/auth/Register";
import { ResetPassword } from "@pages/auth/ResetPassword";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { isTelegramWebApp } from "@utils/isTelegramWebApp";
import { Layout } from "./layouts/Layout";
import { Home } from "./pages/Home";
import { Promo } from "./pages/Promo";
import { QueryProvider } from "./providers/QueryProvider";
import "./i18n/config";

function AppContent() {
	const { isAuthenticated, isLoading, isWebApp } = useAuth();
	const isWebAppUser = isTelegramWebApp();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	// For Telegram WebApp users, redirect unauthenticated users to dashboard
	// (they will be auto-logged in by the AuthContext)
	const getUnauthenticatedRedirect = () => {
		if (isWebAppUser) {
			// For WebApp users, redirect to dashboard where they'll be auto-logged in
			return <Navigate to="/dashboard" replace />;
		} else {
			// For regular web users, redirect to promo page
			return <Navigate to="/" replace />;
		}
	};

	return (
		<Routes>
			{/* Public routes - only for non-WebApp users */}
			{!isWebAppUser && <Route path="/" element={<Promo />} />}
			
			{/* For WebApp users, redirect root to dashboard */}
			{isWebAppUser && (
				<Route 
					path="/" 
					element={<Navigate to="/dashboard" replace />} 
				/>
			)}

			{/* Auth routes - only for non-WebApp users */}
			{!isWebAppUser && (
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
				</Route>
			)}

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
								<Route path="/debug" element={<Debug />} />
							</Routes>
						</Layout>
					) : (
						getUnauthenticatedRedirect()
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
						getUnauthenticatedRedirect()
					)
				}
			/>
			<Route
				path="/expenses/:id/edit"
				element={
					isAuthenticated ? (
						<Layout>
							<ExpenseEdit />
						</Layout>
					) : (
						getUnauthenticatedRedirect()
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
