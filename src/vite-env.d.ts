/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly BASE_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// Extend existing Telegram WebApp types
declare global {
	interface Window {
		Telegram?: {
			WebApp: {
				initData?: string;
				initDataUnsafe?: {
					user?: {
						id: number;
						first_name: string;
						last_name?: string;
						username?: string;
						language_code?: string;
						is_premium?: boolean;
					};
					start_param?: string;
					auth_date?: number;
					hash?: string;
				};
				version?: string;
				platform?: string;
				colorScheme?: "light" | "dark";
				themeParams?: Record<string, string>;
				isExpanded?: boolean;
				viewportHeight?: number;
				viewportStableHeight?: number;
				headerColor?: string;
				backgroundColor?: string;
				isClosingConfirmationEnabled?: boolean;

				// Methods
				ready(): void;
				expand(): void;
				close(): void;
				enableClosingConfirmation?(): void;
				disableClosingConfirmation?(): void;
				showAlert(message: string, callback?: () => void): void;
				showConfirm?(
					message: string,
					callback?: (confirmed: boolean) => void,
				): void;
				showPopup?(
					params: {
						title?: string;
						message: string;
						buttons?: Array<{
							id?: string;
							type?: "default" | "ok" | "close" | "cancel" | "destructive";
							text: string;
						}>;
					},
					callback?: (buttonId: string) => void,
				): void;
				sendData?(data: string): void;
				switchInlineQuery?(query: string, choose_chat_types?: string[]): void;
				openLink?(url: string, options?: { try_instant_view?: boolean }): void;
				openTelegramLink?(url: string): void;
				openInvoice?(url: string, callback?: (status: string) => void): void;

				// Events
				onEvent?(eventType: string, eventHandler: () => void): void;
				offEvent?(eventType: string, eventHandler: () => void): void;
			};
		};
	}
}
