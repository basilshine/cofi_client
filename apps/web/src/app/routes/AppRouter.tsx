import { Navigate, Route, Routes } from "react-router-dom";
import { AccountPage } from "../../features/auth/AccountPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { RegisterPage } from "../../features/auth/RegisterPage";
import { ChatLogPage } from "../../features/chatlog/ChatLogPage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { DraftsPage } from "../../features/drafts/DraftsPage";
import { ExpenseThreadPage } from "../../features/expense-thread/ExpenseThreadPage";
import { QuotaPage } from "../../features/quota/QuotaPage";
import { RecurringSchedulesPage } from "../../features/recurring/RecurringSchedulesPage";
import { SpacesPage } from "../../features/spaces/SpacesPage";
import { TransactionsPage } from "../../features/transactions/TransactionsPage";
import { AppShell } from "../layout/AppShell";
import { ConsoleWorkspaceSplit } from "../layout/workspaceSpaces/ConsoleWorkspaceSplit";
import { ConsoleIndexRedirect } from "./ConsoleIndexRedirect";
import { ProtectedRoute } from "./ProtectedRoute";
import { WorkspaceRootRedirect } from "./WorkspaceRootRedirect";

export const AppRouter = () => {
	return (
		<Routes>
			<Route element={<WorkspaceRootRedirect />} path="/" />
			<Route element={<LoginPage />} path="/login" />
			<Route element={<RegisterPage />} path="/register" />

			<Route element={<ProtectedRoute />}>
				<Route element={<AppShell />} path="/console">
					<Route element={<ConsoleWorkspaceSplit />}>
						<Route element={<ConsoleIndexRedirect />} index />
						<Route element={<DashboardPage />} path="dashboard" />
						<Route
							element={<Navigate replace to="/console/dashboard" />}
							path="dashboard/personal"
						/>
						<Route
							element={<Navigate replace to="/console/dashboard" />}
							path="dashboard/business"
						/>
						<Route element={<SpacesPage />} path="spaces" />
						<Route element={<DraftsPage />} path="drafts" />
						<Route element={<TransactionsPage />} path="transactions" />
						<Route element={<RecurringSchedulesPage />} path="recurring" />
						<Route element={<ChatLogPage />} path="chat/expenses" />
						<Route element={<ChatLogPage />} path="chat" />
						<Route element={<ExpenseThreadPage />} path="chat/thread" />
						<Route element={<QuotaPage />} path="quota" />
						<Route
							element={<Navigate replace to="/console/dashboard" />}
							path="organization"
						/>
					</Route>
					<Route element={<AccountPage />} path="account" />
				</Route>
			</Route>

			<Route element={<WorkspaceRootRedirect />} path="*" />
		</Routes>
	);
};
