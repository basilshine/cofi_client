import LogRocket from "logrocket";
import { useEffect, useState } from "react";

type TelegramUser = {
	id: number;
	first_name: string;
	last_name?: string;
	username?: string;
};

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
		TelegramGameProxy?: unknown;
	}
}

export const useTelegram = () => {
	const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
	const [initData, setInitData] = useState<string>("");

	useEffect(() => {
		// Even more detailed debug info
		const win = window as typeof window & {
			Telegram?: {
				WebApp?: {
					initDataUnsafe?: { user?: TelegramUser };
					initData?: string;
				};
			};
			TelegramGameProxy?: unknown;
		};
		const userAgent = navigator.userAgent;
		const referrer = document.referrer;
		const locationHref = window.location.href;
		const tg = win.Telegram?.WebApp;
		const tgUser = tg?.initDataUnsafe?.user;
		const tgInitData = tg?.initData;
		const isTelegramWebApp =
			typeof window !== "undefined" &&
			typeof win.Telegram !== "undefined" &&
			typeof win.Telegram.WebApp !== "undefined";

		const windowKeys = Object.keys(window);
		const telegramKeys = windowKeys.filter((k) => k.startsWith("Telegram"));
		const hasTelegramGameProxy = typeof win.TelegramGameProxy !== "undefined";

		const debugInfo = {
			userAgent,
			referrer,
			locationHref,
			windowTelegram: win.Telegram,
			windowTelegramWebApp: tg,
			tgUser,
			tgInitData,
			isTelegramWebApp,
			windowKeys,
			telegramKeys,
			hasTelegramGameProxy,
		};
		console.log("[useTelegram] Debug info:", debugInfo);
		LogRocket.log("[useTelegram] Debug info:", debugInfo);

		if (typeof window !== "undefined") {
			alert(`window.Telegram: ${typeof win.Telegram}`);
			alert(
				`window.Telegram.WebApp: ${win.Telegram && typeof win.Telegram.WebApp}`,
			);
		}

		if (isTelegramWebApp && tg) {
			setTelegramUser(tgUser || null);
			setInitData(tgInitData || "");
			console.log("[useTelegram] Telegram WebApp context detected.", {
				user: tgUser,
				initData: tgInitData,
			});
			LogRocket.log("[useTelegram] Telegram WebApp context detected.", {
				user: tgUser,
				initData: tgInitData,
			});
		} else {
			setTelegramUser(null);
			setInitData("");
			console.log("[useTelegram] Not in Telegram WebApp context.");
			LogRocket.log("[useTelegram] Not in Telegram WebApp context.");
		}
	}, []);

	return { telegramUser, initData };
};
