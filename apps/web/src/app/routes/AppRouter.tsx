import { type ReactNode, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthEntryPage } from "../../features/auth/AuthEntryPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { RegisterPage } from "../../features/auth/RegisterPage";
import { InviteJoinPage } from "../../features/invite/InviteJoinPage";
import { OnboardingPage } from "../../features/onboarding/OnboardingPage";
import type { SettingsSectionKey } from "../../features/settings/SettingsHubPage";
import { AppShell } from "../layout/AppShell";
import { ConsoleWorkspaceSplit } from "../layout/workspaceSpaces/ConsoleWorkspaceSplit";
import { ConsoleIndexRedirect } from "./ConsoleIndexRedirect";
import { ProtectedRoute } from "./ProtectedRoute";
import { RequireOnboarded } from "./RequireOnboarded";
import { WorkspaceRootRedirect } from "./WorkspaceRootRedirect";

const ChatPage = lazy(() =>
	import("../../pages/chat/ChatPage").then((module) => ({
		default: module.ChatPage,
	})),
);
const GlobalHomePage = lazy(() =>
	import("../../features/home/GlobalHomePage").then((module) => ({
		default: module.GlobalHomePage,
	})),
);
const GlobalSearchPage = lazy(() =>
	import("../../features/search/GlobalSearchPage").then((module) => ({
		default: module.GlobalSearchPage,
	})),
);
const QuotaPage = lazy(() =>
	import("../../features/quota/QuotaPage").then((module) => ({
		default: module.QuotaPage,
	})),
);
const PaymentResolutionPage = lazy(() =>
	import("../../features/payment-resolution/PaymentResolutionPage").then(
		(module) => ({
			default: module.PaymentResolutionPage,
		}),
	),
);
const CeitsReviewFlowPage = lazy(() =>
	import("../../features/review-flow/CeitsReviewFlowPage").then((module) => ({
		default: module.CeitsReviewFlowPage,
	})),
);
const SettingsHubPage = lazy(() =>
	import("../../features/settings/SettingsHubPage").then((module) => ({
		default: module.SettingsHubPage,
	})),
);
const SettingsSpacesPage = lazy(() =>
	import("../../features/settings/SettingsSpacesPage").then((module) => ({
		default: module.SettingsSpacesPage,
	})),
);
const SpaceBenefitsPage = lazy(() =>
	import("../../features/space-benefits/SpaceBenefitsPage").then((module) => ({
		default: module.SpaceBenefitsPage,
	})),
);
const SpaceMembersPage = lazy(() =>
	import("../../features/space-members/SpaceMembersPage").then((module) => ({
		default: module.SpaceMembersPage,
	})),
);
const SpaceOverviewPage = lazy(() =>
	import("../../features/space-overview/SpaceOverviewPage").then((module) => ({
		default: module.SpaceOverviewPage,
	})),
);
const SpaceRecurringPage = lazy(() =>
	import("../../features/space-recurring/SpaceRecurringPage").then(
		(module) => ({
			default: module.SpaceRecurringPage,
		}),
	),
);
const SpaceSettingsPage = lazy(() =>
	import("../../features/space-settings/SpaceSettingsPage").then((module) => ({
		default: module.SpaceSettingsPage,
	})),
);
const SpaceSplitsWorkspacePage = lazy(() =>
	import("../../features/space-splits/SpaceSplitsWorkspacePage").then(
		(module) => ({
			default: module.SpaceSplitsWorkspacePage,
		}),
	),
);
const SpacesPage = lazy(() =>
	import("../../features/spaces/SpacesPage").then((module) => ({
		default: module.SpacesPage,
	})),
);
const RouteLoading = () => (
	<div className="flex min-h-[14rem] items-center justify-center px-4 py-10 text-sm text-muted-foreground">
		Loading page...
	</div>
);

const lazyRoute = (element: ReactNode) => (
	<Suspense fallback={<RouteLoading />}>{element}</Suspense>
);

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
			<Route
				element={lazyRoute(<PaymentResolutionPage />)}
				path="/pay/:token"
			/>

			<Route element={<ProtectedRoute />}>
				<Route element={<OnboardingPage />} path="/onboarding" />
				<Route element={<RequireOnboarded />}>
					<Route element={<AppShell />} path="/console">
						<Route element={<ConsoleWorkspaceSplit />}>
							<Route element={<ConsoleIndexRedirect />} index />
							<Route element={lazyRoute(<GlobalHomePage />)} path="home" />
							<Route
								element={<Navigate replace to="/console/home" />}
								path="dashboard"
							/>
							<Route
								element={<Navigate replace to="/console/home" />}
								path="dashboard/personal"
							/>
							<Route
								element={<Navigate replace to="/console/home" />}
								path="dashboard/business"
							/>
							<Route element={lazyRoute(<SpacesPage />)} path="spaces" />
							<Route
								element={lazyRoute(<SpaceOverviewPage />)}
								path="spaces/:spaceId"
							/>
							<Route
								element={lazyRoute(<SpaceOverviewPage />)}
								path="spaces/:spaceId/overview"
							/>
							<Route
								element={lazyRoute(<ChatPage />)}
								path="spaces/:spaceId/expenses"
							/>
							<Route
								element={lazyRoute(<ChatPage />)}
								path="spaces/:spaceId/chat"
							/>
							<Route
								element={lazyRoute(<SpaceSplitsWorkspacePage />)}
								path="spaces/:spaceId/splits"
							/>
							<Route
								element={lazyRoute(<SpaceBenefitsPage />)}
								path="spaces/:spaceId/benefits"
							/>
							<Route
								element={lazyRoute(<SpaceMembersPage />)}
								path="spaces/:spaceId/members"
							/>
							<Route
								element={lazyRoute(<SpaceRecurringPage />)}
								path="spaces/:spaceId/recurring"
							/>
							<Route
								element={lazyRoute(<SpaceSettingsPage />)}
								path="spaces/:spaceId/settings"
							/>
							<Route element={lazyRoute(<GlobalSearchPage />)} path="search" />
							<Route
								element={lazyRoute(<CeitsReviewFlowPage />)}
								path="review"
							/>
							<Route element={lazyRoute(<QuotaPage />)} path="quota" />
							<Route
								element={<Navigate replace to="/console/settings/account" />}
								path="settings"
							/>
							<Route
								element={lazyRoute(<SettingsSectionRoute section="account" />)}
								path="settings/account"
							/>
							<Route
								element={lazyRoute(
									<SettingsSectionRoute section="appearance" />,
								)}
								path="settings/appearance"
							/>
							<Route
								element={lazyRoute(
									<SettingsSectionRoute section="notifications" />,
								)}
								path="settings/notifications"
							/>
							<Route
								element={lazyRoute(<SettingsSectionRoute section="security" />)}
								path="settings/security"
							/>
							<Route
								element={lazyRoute(<SettingsSectionRoute section="billing" />)}
								path="settings/billing"
							/>
							<Route
								element={lazyRoute(<SettingsSpacesPage />)}
								path="settings/spaces"
							/>
							<Route
								element={lazyRoute(<SpaceSettingsPage surface="settings" />)}
								path="settings/spaces/:spaceId"
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
