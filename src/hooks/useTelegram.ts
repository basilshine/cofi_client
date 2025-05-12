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
			if (window.Telegram?.WebApp) {
				window.Telegram.WebApp.ready();
				setIsWebApp(true);
				setTelegramUser(window.Telegram.WebApp.initDataUnsafe?.user ?? null);
				setInitData(window.Telegram.WebApp.initData);
			}
		} catch (err) {
			setError("Failed to initialize Telegram WebApp");
			console.error("Telegram WebApp initialization error:", err);
		}
	}, []);

	return { isWebApp, error, telegramUser, initData };
};
