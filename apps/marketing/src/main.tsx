import { MotionConfig } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../../../src/index.css";
import { MarketingApp } from "./MarketingApp";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<MotionConfig reducedMotion="user">
			<BrowserRouter
				basename={import.meta.env.BASE_URL}
				future={{ v7_relativeSplatPath: true }}
			>
				<MarketingApp />
			</BrowserRouter>
		</MotionConfig>
	</React.StrictMode>,
);
