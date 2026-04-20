import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "../features/landing/LandingPage";
import { WelcomeBusinessPage } from "../features/landing/WelcomeBusinessPage";
import { WelcomePersonalPage } from "../features/landing/WelcomePersonalPage";

export const MarketingRouter = () => {
	return (
		<Routes>
			<Route element={<LandingPage />} path="/" />
			<Route element={<WelcomePersonalPage />} path="/welcome/personal" />
			<Route element={<WelcomeBusinessPage />} path="/welcome/business" />
			<Route element={<Navigate replace to="/" />} path="*" />
		</Routes>
	);
};
