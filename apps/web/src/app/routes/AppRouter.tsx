import { Route, Routes } from "react-router-dom";
import { AccountPage } from "../../features/auth/AccountPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { RegisterPage } from "../../features/auth/RegisterPage";
import { ChatLogPage } from "../../features/chatlog/ChatLogPage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { DraftsPage } from "../../features/drafts/DraftsPage";
import { ExpenseThreadPage } from "../../features/expense-thread/ExpenseThreadPage";
import { OrganizationPage } from "../../features/organization/OrganizationPage";
import { QuotaPage } from "../../features/quota/QuotaPage";
import { RecurringSchedulesPage } from "../../features/recurring/RecurringSchedulesPage";
import { SpacesPage } from "../../features/spaces/SpacesPage";
import { TransactionsPage } from "../../features/transactions/TransactionsPage";
import { AppShell } from "../layout/AppShell";
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
					<Route element={<ConsoleIndexRedirect />} index />
					<Route element={<DashboardPage />} path="dashboard/:variant" />
					<Route element={<AccountPage />} path="account" />
					<Route element={<SpacesPage />} path="spaces" />
					<Route element={<DraftsPage />} path="drafts" />
					<Route element={<TransactionsPage />} path="transactions" />
					<Route element={<RecurringSchedulesPage />} path="recurring" />
					<Route element={<ChatLogPage />} path="chat" />
					<Route element={<ExpenseThreadPage />} path="chat/thread" />
					<Route element={<QuotaPage />} path="quota" />
					<Route element={<OrganizationPage />} path="organization" />
				</Route>
			</Route>

			<Route element={<WorkspaceRootRedirect />} path="*" />
		</Routes>
	);
};
