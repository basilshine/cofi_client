import { parseTgWebAppData } from "@/hooks/useTelegram";

export const isTelegramWebApp = (): boolean => {
	if (typeof window === "undefined") return false;
	if (window.Telegram?.WebApp) return true;
	if (window.location.hash.includes("tgWebAppData=")) {
		const parsed = parseTgWebAppData(window.location.hash);
		if (parsed.initData) return true;
	}
	// Also check for startapp parameter which indicates Telegram WebApp
	if (window.location.search.includes("startapp=")) return true;
	return false;
};
