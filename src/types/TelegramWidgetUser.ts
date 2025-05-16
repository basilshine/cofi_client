export type TelegramWidgetUser = {
	id: number;
	username: string;
	first_name: string;
	last_name?: string;
	photo_url?: string;
	auth_date: number;
	hash: string;
	language_code?: string;
	country?: string;
};
