import { useTelegram } from "@hooks/useTelegram";
import { isTelegramWebApp } from "@utils/isTelegramWebApp";
import LogRocket from "logrocket";
import { useEffect, useState } from "react";

interface DebugData {
	isWebApp: boolean;
	telegramUser: unknown;
	initData: string;
	hasTelegramWebApp: boolean;
	telegramWebAppObject: unknown;
	currentURL: string;
	urlSearch: string;
	urlHash: string;
	startappParam: string | null;
	hasHashTgData: boolean;
	userAgent: string;
	referrer: string;
	telegramWebAppInitData?: string;
	telegramWebAppInitDataUnsafe?: unknown;
}

export const DebugInfo = () => {
	const [debugData, setDebugData] = useState<DebugData | null>(null);
	const { telegramUser, initData } = useTelegram();
	const isWebApp = isTelegramWebApp();

	useEffect(() => {
		const data = {
			// Detection results
			isWebApp,
			telegramUser,
			initData,

			// Environment checks
			hasTelegramWebApp: !!window.Telegram?.WebApp,
			telegramWebAppObject: window.Telegram?.WebApp,

			// URL analysis
			currentURL: window.location.href,
			urlSearch: window.location.search,
			urlHash: window.location.hash,
			startappParam: new URLSearchParams(window.location.search).get(
				"startapp",
			),
			hasHashTgData: window.location.hash.includes("tgWebAppData="),

			// User agent
			userAgent: navigator.userAgent,
			referrer: document.referrer,

			// Telegram WebApp specific data
			telegramWebAppInitData: window.Telegram?.WebApp?.initData,
			telegramWebAppInitDataUnsafe: window.Telegram?.WebApp?.initDataUnsafe,
		};

		setDebugData(data);
		console.log("[DebugInfo] Complete debug data:", data);
		LogRocket.log("[DebugInfo] Complete debug data", data);
	}, [isWebApp, telegramUser, initData]);

	// Only show in development or when explicitly requested
	const shouldShow =
		import.meta.env.DEV ||
		new URLSearchParams(window.location.search).has("debug");

	if (!shouldShow) return null;

	return (
		<div className="fixed top-0 left-0 right-0 z-50 bg-yellow-100 border-b-2 border-yellow-300 p-2 text-xs">
			<div className="max-w-4xl mx-auto">
				<div className="font-bold mb-1">🐛 Debug Info (WebApp Detection)</div>
				<div className="grid grid-cols-2 gap-2">
					<div>
						<strong>Layout:</strong>{" "}
						{isWebApp ? "WebAppLayout" : "Regular Layout"}
					</div>
					<div>
						<strong>Telegram WebApp:</strong>{" "}
						{window.Telegram?.WebApp ? "✅" : "❌"}
					</div>
					<div>
						<strong>Start Param:</strong>{" "}
						{new URLSearchParams(window.location.search).get("startapp") ||
							"none"}
					</div>
					<div>
						<strong>Hash TG Data:</strong>{" "}
						{window.location.hash.includes("tgWebAppData=") ? "✅" : "❌"}
					</div>
				</div>
				<details className="mt-2">
					<summary className="cursor-pointer font-semibold">
						Full Debug Data
					</summary>
					<pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
						{JSON.stringify(debugData, null, 2)}
					</pre>
				</details>
			</div>
		</div>
	);
};
