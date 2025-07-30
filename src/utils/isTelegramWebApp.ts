import { parseTgWebAppData } from "@/hooks/useTelegram";
import LogRocket from "logrocket";

export const isTelegramWebApp = (): boolean => {
	if (typeof window === "undefined") {
		console.log("[isTelegramWebApp] Server-side rendering, returning false");
		return false;
	}

	const debugInfo = {
		currentURL: window.location.href,
		userAgent: navigator.userAgent,
		hasTelegramWebApp: !!window.Telegram?.WebApp,
		urlSearch: window.location.search,
		urlHash: window.location.hash,
		startappParam: new URLSearchParams(window.location.search).get("startapp"),
		hasHashTgData: window.location.hash.includes("tgWebAppData="),
		referrer: document.referrer,
		isTelegramUserAgent: navigator.userAgent.includes("Telegram"),
	};

	console.log("[isTelegramWebApp] Detection Debug:", debugInfo);
	LogRocket.log("[isTelegramWebApp] Detection Debug", debugInfo);

	// Check 1: Telegram WebApp object exists
	if (window.Telegram?.WebApp) {
		console.log("[isTelegramWebApp] ✅ Detected via window.Telegram.WebApp");
		LogRocket.log("[isTelegramWebApp] Detected via Telegram WebApp object");
		return true;
	}

	// Check 2: Hash contains tgWebAppData
	if (window.location.hash.includes("tgWebAppData=")) {
		try {
			const parsed = parseTgWebAppData(window.location.hash);
			if (parsed.initData) {
				console.log(
					"[isTelegramWebApp] ✅ Detected via hash tgWebAppData with initData",
				);
				LogRocket.log("[isTelegramWebApp] Detected via hash tgWebAppData", {
					parsed,
				});
				return true;
			}
		} catch (error) {
			console.error("[isTelegramWebApp] Error parsing tgWebAppData:", error);
			LogRocket.error("[isTelegramWebApp] Error parsing tgWebAppData", error);
		}
	}

	// Check 3: URL contains startapp parameter
	if (window.location.search.includes("startapp=")) {
		console.log("[isTelegramWebApp] ✅ Detected via startapp parameter");
		LogRocket.log("[isTelegramWebApp] Detected via startapp parameter", {
			startapp: new URLSearchParams(window.location.search).get("startapp"),
		});
		return true;
	}

	// Check 4: User agent contains Telegram (additional check)
	if (navigator.userAgent.includes("Telegram")) {
		console.log("[isTelegramWebApp] ✅ Detected via Telegram user agent");
		LogRocket.log("[isTelegramWebApp] Detected via Telegram user agent", {
			userAgent: navigator.userAgent,
		});
		return true;
	}

	// Check 5: Referrer is from Telegram (additional check)
	if (
		document.referrer.includes("telegram") ||
		document.referrer.includes("t.me")
	) {
		console.log("[isTelegramWebApp] ✅ Detected via Telegram referrer");
		LogRocket.log("[isTelegramWebApp] Detected via Telegram referrer", {
			referrer: document.referrer,
		});
		return true;
	}

	// Check 6: Force WebApp mode via URL parameter (for testing)
	if (new URLSearchParams(window.location.search).has("webapp")) {
		console.log(
			"[isTelegramWebApp] ✅ Detected via webapp parameter (testing mode)",
		);
		LogRocket.log(
			"[isTelegramWebApp] Detected via webapp parameter (testing mode)",
		);
		return true;
	}

	console.log("[isTelegramWebApp] ❌ Not detected as Telegram WebApp");
	LogRocket.log(
		"[isTelegramWebApp] Not detected as Telegram WebApp",
		debugInfo,
	);
	return false;
};
