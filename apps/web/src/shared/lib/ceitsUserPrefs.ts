import type { User } from "@cofi/api";

export type CeitsQuickAction = { id: string; label: string };

export type CeitsFirstChatPrefs = {
	space_id?: number;
	welcome_text?: string;
	quick_actions?: CeitsQuickAction[];
};

export type CeitsUserPrefs = {
	primary_space_id?: number;
	first_chat?: CeitsFirstChatPrefs;
	start_context?: string;
	space_purpose?: string;
	preferred_capture_mode?: string;
	preferred_tracking_priorities?: string[];
};

export const readCeitsPrefs = (user: User | null): CeitsUserPrefs | null => {
	const raw = user?.userPreferences;
	if (!raw || typeof raw !== "object") return null;
	const ceits = (raw as Record<string, unknown>).ceits;
	if (!ceits || typeof ceits !== "object") return null;
	return ceits as CeitsUserPrefs;
};

export const readCeitsPrimarySpaceId = (user: User | null): number | null => {
	const c = readCeitsPrefs(user);
	const id = c?.primary_space_id;
	return typeof id === "number" && Number.isFinite(id) ? id : null;
};

export const readCeitsFirstChat = (
	user: User | null,
): CeitsFirstChatPrefs | null => {
	return readCeitsPrefs(user)?.first_chat ?? null;
};
