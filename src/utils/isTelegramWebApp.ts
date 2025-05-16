export const isTelegramWebApp = (): boolean =>
	typeof window !== "undefined" && !!window.Telegram?.WebApp;
