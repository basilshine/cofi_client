import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { AuthProvider, useAuth } from '@contexts/AuthContext';
import { QueryProvider } from './providers/QueryProvider';
import { Layout } from './layouts/Layout';
import { Promo } from './pages/Promo';
import { Home } from './pages/Home';
import { Expenses } from '@pages/Expenses';
import { Analytics } from '@pages/Analytics';
import { Settings } from '@pages/Settings';
import { Login } from '@pages/auth/Login';
import { Register } from '@pages/auth/Register';
import { ForgotPassword } from '@pages/auth/ForgotPassword';
import { ResetPassword } from '@pages/auth/ResetPassword';
import './i18n/config';

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

function App() {
	return (
		<BrowserRouter basename={import.meta.env.BASE_URL}>
			<QueryProvider>
				<AuthProvider>
					<AppContent />
				</AuthProvider>
			</QueryProvider>
		</BrowserRouter>
	);
}

export default App;
