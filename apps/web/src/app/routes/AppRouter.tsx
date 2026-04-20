import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../layout/AppShell";
import { ConsoleOverviewPage } from "../../features/console/ConsoleOverviewPage";
import { AuthPage } from "../../features/auth/AuthPage";
import { ChatLogPage } from "../../features/chatlog/ChatLogPage";
import { DraftsPage } from "../../features/drafts/DraftsPage";
import { QuotaPage } from "../../features/quota/QuotaPage";
import { SpacesPage } from "../../features/spaces/SpacesPage";
import { TransactionsPage } from "../../features/transactions/TransactionsPage";

export const AppRouter = () => {
	return (
		<Routes>
			<Route element={<Navigate replace to="/console" />} path="/" />

			<Route element={<AppShell />} path="/console">
				<Route element={<ConsoleOverviewPage />} index />
				<Route element={<AuthPage />} path="auth" />
				<Route element={<SpacesPage />} path="spaces" />
				<Route element={<DraftsPage />} path="drafts" />
				<Route element={<TransactionsPage />} path="transactions" />
				<Route element={<ChatLogPage />} path="chat" />
				<Route element={<QuotaPage />} path="quota" />
			</Route>

			<Route element={<Navigate replace to="/console" />} path="*" />
		</Routes>
	);
};

