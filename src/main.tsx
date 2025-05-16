import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import LogRocket from "logrocket";

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
