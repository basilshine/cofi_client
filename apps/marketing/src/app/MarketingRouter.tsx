import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { SeoLandingPage } from "../features/seo/SeoLandingPage";
import { LANDING_PAGES } from "../features/seo/landingPages";

export const MarketingRouter = () => {
	const location = useLocation();

	return (
		<AnimatePresence mode="wait">
			<Routes key={location.pathname} location={location}>
				{Object.values(LANDING_PAGES).map((page) => (
					<Route
						element={<SeoLandingPage page={page} />}
						key={page.slug}
						path={page.slug}
					/>
				))}
				<Route
					element={<Navigate replace to="/for-couples" />}
					path="/welcome/personal"
				/>
				<Route
					element={<Navigate replace to="/for-families" />}
					path="/welcome/business"
				/>
				<Route element={<Navigate replace to="/" />} path="*" />
			</Routes>
		</AnimatePresence>
	);
};
