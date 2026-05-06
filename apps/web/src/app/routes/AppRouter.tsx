import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthEntryPage } from "../../features/auth/AuthEntryPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { RegisterPage } from "../../features/auth/RegisterPage";
import { ChatLogPage } from "../../features/chatlog/ChatLogPage";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { DraftsPage } from "../../features/drafts/DraftsPage";
import { ExpenseThreadPage } from "../../features/expense-thread/ExpenseThreadPage";
import { GlobalHomePage } from "../../features/home/GlobalHomePage";
import { InviteJoinPage } from "../../features/invite/InviteJoinPage";
import { OnboardingPage } from "../../features/onboarding/OnboardingPage";
import { QuotaPage } from "../../features/quota/QuotaPage";
import { RecurringSchedulesPage } from "../../features/recurring/RecurringSchedulesPage";
import { CeitsReviewFlowPage } from "../../features/review-flow/CeitsReviewFlowPage";
import {
	SettingsHubPage,
	type SettingsSectionKey,
} from "../../features/settings/SettingsHubPage";
import { SpaceOverviewPage } from "../../features/space-overview/SpaceOverviewPage";
import { SpaceRecurringPage } from "../../features/space-recurring/SpaceRecurringPage";
import { SpaceSettingsPage } from "../../features/space-settings/SpaceSettingsPage";
import { SpaceSplitsWorkspacePage } from "../../features/space-splits/SpaceSplitsWorkspacePage";
import { SpacesPage } from "../../features/spaces/SpacesPage";
import { TransactionsPage } from "../../features/transactions/TransactionsPage";
import { AppShell } from "../layout/AppShell";
import { ConsoleWorkspaceSplit } from "../layout/workspaceSpaces/ConsoleWorkspaceSplit";
import { ConsoleIndexRedirect } from "./ConsoleIndexRedirect";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequireOnboarded } from "./RequireOnboarded";
import { WorkspaceRootRedirect } from "./WorkspaceRootRedirect";

const ChatSectionLayout = () => <Outlet />;
const SettingsSectionRoute = ({ section }: { section: SettingsSectionKey }) => (
	<SettingsHubPage section={section} />
);

export const AppRouter = () => {
	return (
		<Routes>
			<Route element={<WorkspaceRootRedirect />} path="/" />
			<Route element={<AuthEntryPage />} path="/auth" />
			<Route element={<InviteJoinPage />} path="/join" />
			<Route element={<LoginPage />} path="/login" />
			<Route element={<RegisterPage />} path="/register" />

			<Route element={<ProtectedRoute />}>
				<Route element={<OnboardingPage />} path="/onboarding" />
				<Route element={<RequireOnboarded />}>
					<Route element={<AppShell />} path="/console">
						<Route element={<ConsoleWorkspaceSplit />}>
							<Route element={<ConsoleIndexRedirect />} index />
							<Route element={<GlobalHomePage />} path="home" />
							<Route element={<DashboardPage />} path="dashboard" />
							<Route
								element={<Navigate replace to="/console/home" />}
								path="dashboard/personal"
							/>
							<Route
								element={<Navigate replace to="/console/home" />}
								path="dashboard/business"
							/>
							<Route element={<SpacesPage />} path="spaces" />
							<Route element={<SpaceOverviewPage />} path="spaces/:spaceId" />
							<Route
								element={<SpaceOverviewPage />}
								path="spaces/:spaceId/overview"
							/>
							<Route
								element={<SpaceSplitsWorkspacePage />}
								path="spaces/:spaceId/splits"
							/>
							<Route
								element={<SpaceRecurringPage />}
								path="spaces/:spaceId/recurring"
							/>
							<Route
								element={<SpaceSettingsPage />}
								path="spaces/:spaceId/settings"
							/>
							<Route element={<DraftsPage />} path="drafts" />
							<Route element={<CeitsReviewFlowPage />} path="review" />
							<Route element={<TransactionsPage />} path="transactions" />
							<Route element={<RecurringSchedulesPage />} path="recurring" />
							<Route element={<ChatSectionLayout />} path="chat">
								<Route element={<ChatLogPage />} index />
								<Route element={<ChatLogPage />} path="expenses" />
								<Route element={<ExpenseThreadPage />} path="thread" />
							</Route>
							<Route element={<QuotaPage />} path="quota" />
							<Route
								element={<Navigate replace to="/console/settings/account" />}
								path="settings"
							/>
							<Route
								element={<SettingsSectionRoute section="account" />}
								path="settings/account"
							/>
							<Route
								element={<SettingsSectionRoute section="appearance" />}
								path="settings/appearance"
							/>
							<Route
								element={<SettingsSectionRoute section="notifications" />}
								path="settings/notifications"
							/>
							<Route
								element={<SettingsSectionRoute section="security" />}
								path="settings/security"
							/>
							<Route
								element={<SettingsSectionRoute section="billing" />}
								path="settings/billing"
							/>
							<Route
								element={<Navigate replace to="/console/home" />}
								path="organization"
							/>
						</Route>
						<Route
							element={<Navigate replace to="/console/settings/account" />}
							path="account"
						/>
					</Route>
				</Route>
			</Route>

			<Route element={<WorkspaceRootRedirect />} path="*" />
		</Routes>
	);
};
