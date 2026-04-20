export type AuthTokens = {
	accessToken: string;
	refreshToken?: string;
};

export type User = {
	id: number;
	email?: string;
	name?: string;
	auth_type?: string;
	country?: string;
	language?: string;
};

export type Space = {
	id: string | number;
	name: string;
	created_at?: string;
};

export type SpaceMember = {
	user_id: number;
	email?: string;
	name?: string;
	role: "owner" | "member";
};

export type SpaceInviteCreateResponse = {
	token: string;
	expires_at: string;
};

export type DraftItem = {
	amount: number;
	name: string;
	emotion?: string;
	tags?: string[];
	expense_date?: string;
};

export type Draft = {
	id: string | number;
	space_id: string | number;
	status: "draft";
	items: DraftItem[];
	total: number;
	created_at?: string;
};

export type Transaction = {
	id: string | number;
	space_id: string | number;
	type: "expense" | "income";
	status: "confirmed";
	items: DraftItem[];
	total: number;
	created_at?: string;
};

export type ChatMessage = {
	id: string | number;
	space_id: string | number;
	user_id?: number;
	sender_type: "user" | "bot";
	direction: "in" | "out";
	message_type?: "text" | "draft_expense" | "confirmed_expense" | (string & {});
	text: string;
	telegram_message_id?: number;
	related_transaction_id?: string | number;
	related_expense_id?: string | number;
	created_at?: string;
};

export type QuotaStatus = {
	limit: number;
	used: number;
	remaining: number;
	plan: "free" | "plus";
};

