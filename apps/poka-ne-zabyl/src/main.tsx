import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

class AppErrorBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean }
> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Application render failed", error, info.componentStack);
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<main className="app-recovery" role="alert">
				<img src="/assets/poka-ne-zabyl-logo.svg?v=20260717" alt="" />
				<p>Экран не загрузился</p>
				<h1>Данные не потеряны</h1>
				<span>
					Если ошибка появилась после сохранения, расход уже мог попасть в
					историю. Обновите приложение и проверьте его там.
				</span>
				<div>
					<button type="button" onClick={() => window.location.reload()}>
						Обновить
					</button>
					<a href="/app">На главную</a>
				</div>
			</main>
		);
	}
}

const app = (
	<React.StrictMode>
		<AppErrorBoundary>
			<App />
		</AppErrorBoundary>
	</React.StrictMode>
);

if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		void navigator.serviceWorker.register("/sw.js", { scope: "/" });
	});
}
