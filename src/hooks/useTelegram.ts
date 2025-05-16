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
	}
}

export const useTelegram = () => {
	const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
	const [initData, setInitData] = useState<string>("");

	useEffect(() => {
		// Improved logging for debugging Telegram WebApp context
		console.log("[useTelegram] Checking for Telegram WebApp context...");
		// Use type guards to avoid linter errors
		const win = window as typeof window & {
			Telegram?: {
				WebApp?: {
					initDataUnsafe?: { user?: TelegramUser };
					initData?: string;
				};
			};
		};
		console.log("[useTelegram] window.Telegram:", win.Telegram);
		console.log("[useTelegram] window.Telegram.WebApp:", win.Telegram?.WebApp);

		const isTelegramWebApp =
			typeof window !== "undefined" &&
			typeof win.Telegram !== "undefined" &&
			typeof win.Telegram.WebApp !== "undefined";

		if (isTelegramWebApp && win.Telegram && win.Telegram.WebApp) {
			const tg = win.Telegram.WebApp;
			setTelegramUser(tg.initDataUnsafe?.user || null);
			setInitData(tg.initData || "");
			console.log("[useTelegram] Telegram WebApp context detected.", {
				user: tg.initDataUnsafe?.user,
				initData: tg.initData,
			});
		} else {
			setTelegramUser(null);
			setInitData("");
			console.log("[useTelegram] Not in Telegram WebApp context.");
		}
	}, []);

	return { telegramUser, initData };
};
