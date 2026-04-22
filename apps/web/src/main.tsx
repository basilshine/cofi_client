import { MotionConfig } from "framer-motion";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../../../src/index.css";
import { WebApp } from "./WebApp";
import { initTheme } from "./shared/theme/theme";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
initTheme();

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<MotionConfig reducedMotion="user">
			<BrowserRouter
				basename={import.meta.env.BASE_URL}
				future={{ v7_relativeSplatPath: true }}
			>
				<WebApp />
			</BrowserRouter>
		</MotionConfig>
	</React.StrictMode>,
);
