import { parseTgWebAppData } from "@/hooks/useTelegram";
import LogRocket from "logrocket";

// Session storage key for persisting WebApp state
const WEBAPP_STATE_KEY = "cofi_telegram_webapp_detected";

export const isTelegramWebApp = (): boolean => {
	if (typeof window === "undefined") {
		console.log("[isTelegramWebApp] Server-side rendering, returning false");
		return false;
	}

	// Check if we've already detected WebApp mode in this session
	const persistedState = sessionStorage.getItem(WEBAPP_STATE_KEY);

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
		persistedState,
	};

	console.log("[isTelegramWebApp] Detection Debug:", debugInfo);
	LogRocket.log("[isTelegramWebApp] Detection Debug", debugInfo);

	// Check 1: Telegram WebApp object exists
	if (window.Telegram?.WebApp) {
		console.log("[isTelegramWebApp] ✅ Detected via window.Telegram.WebApp");
		LogRocket.log("[isTelegramWebApp] Detected via Telegram WebApp object");
		sessionStorage.setItem(WEBAPP_STATE_KEY, "telegram_object");
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
				sessionStorage.setItem(WEBAPP_STATE_KEY, "hash_data");
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
		sessionStorage.setItem(WEBAPP_STATE_KEY, "startapp_param");
		return true;
	}

	// Check 4: User agent contains Telegram (additional check)
	if (navigator.userAgent.includes("Telegram")) {
		console.log("[isTelegramWebApp] ✅ Detected via Telegram user agent");
		LogRocket.log("[isTelegramWebApp] Detected via Telegram user agent", {
			userAgent: navigator.userAgent,
		});
		sessionStorage.setItem(WEBAPP_STATE_KEY, "user_agent");
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
		sessionStorage.setItem(WEBAPP_STATE_KEY, "referrer");
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
		sessionStorage.setItem(WEBAPP_STATE_KEY, "testing_mode");
		return true;
	}

	// Check 7: Previously detected in this session (fallback for navigation)
	if (persistedState) {
		console.log(
			`[isTelegramWebApp] ✅ Using persisted WebApp state: ${persistedState}`,
		);
		LogRocket.log("[isTelegramWebApp] Using persisted WebApp state", {
			persistedState,
			reason: "Navigation after initial detection",
		});
		return true;
	}

	console.log("[isTelegramWebApp] ❌ Not detected as Telegram WebApp");
	LogRocket.log(
		"[isTelegramWebApp] Not detected as Telegram WebApp",
		debugInfo,
	);
	return false;
};

// Function to clear the persisted WebApp state (useful for testing or logout)
export const clearTelegramWebAppState = (): void => {
	if (typeof window !== "undefined") {
		sessionStorage.removeItem(WEBAPP_STATE_KEY);
		console.log("[clearTelegramWebAppState] WebApp state cleared");
		LogRocket.log("[clearTelegramWebAppState] WebApp state cleared");
	}
};
