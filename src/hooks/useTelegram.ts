import { useEffect, useState } from "react";

declare global {
	interface Window {
		Telegram?: {
			WebApp: {
				initData?: string;
				ready: () => void;
				expand: () => void;
				initDataUnsafe?: {
					user?: {
						id: number;
						first_name: string;
						last_name?: string;
						username?: string;
					};
				};
			};
		};
	}
}

export const useTelegram = () => {
	const [isWebApp, setIsWebApp] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [telegramUser, setTelegramUser] = useState<null | {
		id: number;
		first_name: string;
		last_name?: string;
		username?: string;
	}>(null);
	const [initData, setInitData] = useState<string | undefined>(undefined);

	useEffect(() => {
		try {
			console.log(
				"[useTelegram] Checking for Telegram WebApp context...",
				window.Telegram,
			);
			if (window.Telegram?.WebApp) {
				console.log("[useTelegram] Telegram WebApp detected.");
				window.Telegram.WebApp.ready();
				setIsWebApp(true);
				const user = window.Telegram.WebApp.initDataUnsafe?.user ?? null;
				console.log("[useTelegram] Telegram user:", user);
				setTelegramUser(user);
				const initData = window.Telegram.WebApp.initData;
				console.log("[useTelegram] Telegram initData:", initData);
				setInitData(initData);
			} else {
				console.log("[useTelegram] Not in Telegram WebApp context.");
			}
		} catch (err) {
			setError("Failed to initialize Telegram WebApp");
			console.error("[useTelegram] Telegram WebApp initialization error:", err);
		}
	}, []);

	return { isWebApp, error, telegramUser, initData };
};
