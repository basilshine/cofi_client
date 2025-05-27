import LogRocket from "logrocket";
import { useEffect, useState } from "react";

type TelegramUser = {
	id: number;
	first_name: string;
	last_name?: string;
	username?: string;
};

export function parseTgWebAppData(hash: string): {
	user?: TelegramUser;
	initData: string;
} {
	// Remove leading #
	const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
	const params = new URLSearchParams(cleanHash);
	const tgWebAppData = params.get("tgWebAppData");
	if (!tgWebAppData) return { initData: "" };
	console.log("[useTelegram] Raw tgWebAppData from URL hash:", tgWebAppData);
	LogRocket.log("[useTelegram] Raw tgWebAppData from URL hash:", tgWebAppData);
	// Try to parse user from tgWebAppData (it's a query string)
	const dataParams = new URLSearchParams(tgWebAppData);
	let user: TelegramUser | undefined = undefined;
	const userStr = dataParams.get("user");
	if (userStr) {
		try {
			let cleanUserStr = decodeURIComponent(userStr);
			// Remove trailing semicolon if present
			if (cleanUserStr.endsWith(";")) {
				cleanUserStr = cleanUserStr.slice(0, -1);
			}
			user = JSON.parse(cleanUserStr);
		} catch (e) {
			console.error("Failed to parse user from tgWebAppData", e);
		}
	}
	return { user, initData: tgWebAppData };
}

declare global {
	interface Window {
		Telegram?: {
			WebApp: {
				initData?: string;
				ready: () => void;
				expand: () => void;
				initDataUnsafe?: {
					user?: TelegramUser;
				};
			};
		};
		// Note: window.TelegramGameProxy is declared for type safety, but is not used in this app.
		// If you ever see errors about receiveEvent, it means some code or library is trying to use Telegram Game API, which is not needed here.
	}
}

export const useTelegram = () => {
	const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
	const [initData, setInitData] = useState<string>("");

	useEffect(() => {
		LogRocket.log("[useTelegram] useEffect triggered");
		const win = window as typeof window & {
			Telegram?: {
				WebApp?: {
					initDataUnsafe?: { user?: TelegramUser };
					initData?: string;
				};
			};
		};
		const userAgent = navigator.userAgent;
		const referrer = document.referrer;
		const locationHref = window.location.href;
		const tg = win.Telegram?.WebApp;
		const tgUser = tg?.initDataUnsafe?.user;
		const tgInitData = tg?.initData;
		let isTelegramWebApp =
			typeof window !== "undefined" &&
			typeof win.Telegram !== "undefined" &&
			typeof win.Telegram.WebApp !== "undefined";

		let fallbackUser: TelegramUser | null = null;
		let fallbackInitData = "";
		if (!isTelegramWebApp && window.location.hash.includes("tgWebAppData=")) {
			const parsed = parseTgWebAppData(window.location.hash);
			if (parsed.initData) {
				isTelegramWebApp = true;
				fallbackUser = parsed.user || null;
				fallbackInitData = parsed.initData;
				LogRocket.log("[useTelegram] Fallback user/initData parsed", {
					fallbackUser,
					fallbackInitData,
				});
			}
		}

		const debugInfo = {
			userAgent,
			referrer,
			locationHref,
			windowTelegram: win.Telegram,
			windowTelegramWebApp: tg,
			tgUser,
			tgInitData,
			isTelegramWebApp,
			fallbackUser,
			fallbackInitData,
		};
		console.log("[useTelegram] Debug info:", debugInfo);
		LogRocket.log("[useTelegram] Debug info:", debugInfo);

		if (isTelegramWebApp && (tg || fallbackInitData)) {
			setTelegramUser(tgUser || fallbackUser || null);
			setInitData(tgInitData || fallbackInitData || "");
			LogRocket.log("[useTelegram] Telegram WebApp context detected.", {
				user: tgUser || fallbackUser,
				initData: tgInitData || fallbackInitData,
			});
		} else {
			setTelegramUser(null);
			setInitData("");
			LogRocket.log("[useTelegram] Not in Telegram WebApp context.");
		}
	}, []);

	useEffect(() => {
		LogRocket.log("[useTelegram] State updated", { telegramUser, initData });
	}, [telegramUser, initData]);

	return { telegramUser, initData };
};
