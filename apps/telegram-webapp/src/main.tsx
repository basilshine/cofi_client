import React from "react";
import ReactDOM from "react-dom/client";
import LogRocket from "logrocket";
import { App } from "./App";
import "./index.css";

if (import.meta.env.VITE_LOGROCKET_ID) {
	LogRocket.init(import.meta.env.VITE_LOGROCKET_ID);
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
