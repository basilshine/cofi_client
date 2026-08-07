import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";
import { shouldRetryAppRender } from "./app-recovery";
import { isBusinessAppLocation } from "./business-app";
import { initializeMetrika } from "./metrika";
import "./styles.css";

if (isBusinessAppLocation(window.location.hostname, window.location.search)) {
	document.title = "Пока не забыл Бизнес";
	document
		.querySelector<HTMLLinkElement>('link[rel="manifest"]')
		?.setAttribute("href", "/business-manifest.webmanifest");
	document
		.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
		?.setAttribute("content", "#171915");
	document
		.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
		?.setAttribute("content", "ПНЗ Бизнес");
	document
		.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')
		?.setAttribute(
			"href",
			"/assets/poka-ne-zabyl-business-favicon.svg?v=20260803",
		);
	document
		.querySelector<HTMLLinkElement>('link[rel="icon"][sizes="48x48"]')
		?.setAttribute(
			"href",
			"/assets/poka-ne-zabyl-business-icon-48.png?v=20260803",
		);
	document
		.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
		?.setAttribute(
			"href",
			"/assets/poka-ne-zabyl-business-apple-touch-icon.png?v=20260803",
		);
}

initializeMetrika();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

class AppErrorBoundary extends Component<
	{ children: ReactNode },
	{ failed: boolean; recovering: boolean }
> {
	state = { failed: false, recovering: false };
	private reloadTimer?: number;

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Application render failed", error, info.componentStack);
		try {
			const key = "pnz:last-render-retry";
			const now = Date.now();
			const lastRetryAt = Number(window.sessionStorage.getItem(key));
			if (!shouldRetryAppRender(lastRetryAt, now)) return;
			window.sessionStorage.setItem(key, String(now));
			this.setState({ recovering: true });
			this.reloadTimer = window.setTimeout(() => window.location.reload(), 700);
		} catch {
			// Keep the manual recovery screen when session storage is unavailable.
		}
	}

	componentWillUnmount() {
		if (this.reloadTimer) window.clearTimeout(this.reloadTimer);
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<main className="app-recovery" role="alert">
				<img src="/assets/poka-ne-zabyl-logo.svg?v=20260717" alt="" />
				<p>
					{this.state.recovering ? "Догружаем экран…" : "Экран не загрузился"}
				</p>
				<h1>
					{this.state.recovering ? "Уже исправляем" : "Данные не потеряны"}
				</h1>
				<span>
					{this.state.recovering
						? "Результат распознавания сохранён. Приложение откроет его повторно."
						: "Если ошибка появилась после сохранения, расход уже мог попасть в историю. Обновите приложение и проверьте его там."}
				</span>
				{!this.state.recovering && (
					<div>
						<button type="button" onClick={() => window.location.reload()}>
							Обновить
						</button>
						<a href="/app">На главную</a>
					</div>
				)}
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
